import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    // Get current year and last year data
    // Current year: July 2025 to June 2026
    // Last year: July 2024 to June 2025
    // Use date strings directly to avoid timezone issues
    const currentYearStart = '2025-07-01'
    const currentYearEnd = '2026-06-30'
    const lastYearStart = '2024-07-01'
    const lastYearEnd = '2025-06-30'

    // Use RPC or aggregate query to get sums grouped by client_group
    // This avoids the 1000 record limit by aggregating in the database
    
    // Fetch current year invoices - get all records using pagination
    let currentYearData: any[] = []
    let currentYearPage = 0
    const pageSize = 1000
    let hasMoreCurrentYear = true
    
    while (hasMoreCurrentYear) {
      const { data: pageData, error: pageError } = await supabase
        .from('invoice_uploads')
        .select('client_group, amount, account_manager, job_manager')
        .eq('organization_id', organizationId)
        .gte('date', currentYearStart)
        .lte('date', currentYearEnd)
        .range(currentYearPage * pageSize, (currentYearPage + 1) * pageSize - 1)
      
      if (pageError) {
        return NextResponse.json(
          { error: 'Failed to fetch current year data', details: pageError.message },
          { status: 500 }
        )
      }
      
      if (pageData && pageData.length > 0) {
        currentYearData = currentYearData.concat(pageData)
        currentYearPage++
        hasMoreCurrentYear = pageData.length === pageSize
      } else {
        hasMoreCurrentYear = false
      }
    }

    // Fetch last year invoices - get all records using pagination
    let lastYearData: any[] = []
    let lastYearPage = 0
    let hasMoreLastYear = true
    
    while (hasMoreLastYear) {
      const { data: pageData, error: pageError } = await supabase
        .from('invoice_uploads')
        .select('client_group, amount, account_manager, job_manager')
        .eq('organization_id', organizationId)
        .gte('date', lastYearStart)
        .lte('date', lastYearEnd)
        .range(lastYearPage * pageSize, (lastYearPage + 1) * pageSize - 1)
      
      if (pageError) {
        return NextResponse.json(
          { error: 'Failed to fetch last year data', details: pageError.message },
          { status: 500 }
        )
      }
      
      if (pageData && pageData.length > 0) {
        lastYearData = lastYearData.concat(pageData)
        lastYearPage++
        hasMoreLastYear = pageData.length === pageSize
      } else {
        hasMoreLastYear = false
      }
    }

    // Debug: Log query results
    console.log(`[DEBUG] Organization ID: ${organizationId}`)
    console.log(`[DEBUG] Last year date range: ${lastYearStart} to ${lastYearEnd}`)
    console.log(`[DEBUG] Last year total records: ${lastYearData?.length || 0}`)
    console.log(`[DEBUG] Current year date range: ${currentYearStart} to ${currentYearEnd}`)
    console.log(`[DEBUG] Current year total records: ${currentYearData?.length || 0}`)
    
    // Debug: Check all unique client groups
    const allClientGroups = new Set<string>()
    lastYearData?.forEach((inv: any) => {
      if (inv.client_group) allClientGroups.add(inv.client_group)
    })
    currentYearData?.forEach((inv: any) => {
      if (inv.client_group) allClientGroups.add(inv.client_group)
    })
    console.log(`[DEBUG] All client groups found:`, Array.from(allClientGroups))
    
    // Debug: Log query results for JBS&G
    const jbsgLastYear = lastYearData?.filter((inv: any) => 
      inv.client_group && inv.client_group.toLowerCase().includes('jbs')
    ) || []
    
    console.log(`[DEBUG] JBS&G last year records: ${jbsgLastYear.length}`)
    if (jbsgLastYear.length > 0) {
      console.log(`[DEBUG] JBS&G last year sample (first 3):`, JSON.stringify(jbsgLastYear.slice(0, 3), null, 2))
      const jbsgTotal = jbsgLastYear.reduce((sum: number, inv: any) => {
        const amt = parseFloat(inv.amount || '0')
        console.log(`[DEBUG] JBS&G amount: ${inv.amount} -> parsed: ${amt}`)
        return sum + amt
      }, 0)
      console.log(`[DEBUG] JBS&G last year total: ${jbsgTotal}`)
    } else {
      console.log(`[DEBUG] No JBS&G records found in last year data`)
      // Check if there are any records with similar names
      const similarNames = lastYearData?.filter((inv: any) => 
        inv.client_group && (
          inv.client_group.toLowerCase().includes('jbs') ||
          inv.client_group.toLowerCase().includes('g')
        )
      ) || []
      console.log(`[DEBUG] Records with similar names:`, similarNames.slice(0, 5))
    }

    // Aggregate by client_group
    // Store account_manager and job_manager (use the most common one for each group)
    const clientGroupMap = new Map<string, { 
      currentYear: number
      lastYear: number
      accountManager: string | null
      jobManager: string | null
    }>()
    
    // Track managers for each client group (to find most common)
    const managerMap = new Map<string, {
      accountManagers: Map<string, number>
      jobManagers: Map<string, number>
    }>()

    // Process current year data
    if (currentYearData) {
      currentYearData.forEach((invoice) => {
        const clientGroup = invoice.client_group || 'Uncategorized'
        // Handle both string and number types for amount
        let amount = 0
        if (typeof invoice.amount === 'number') {
          amount = invoice.amount
        } else if (typeof invoice.amount === 'string') {
          amount = parseFloat(invoice.amount) || 0
        }
        
        if (!clientGroupMap.has(clientGroup)) {
          clientGroupMap.set(clientGroup, { 
            currentYear: 0, 
            lastYear: 0,
            accountManager: null,
            jobManager: null
          })
          managerMap.set(clientGroup, {
            accountManagers: new Map(),
            jobManagers: new Map()
          })
        }
        
        const group = clientGroupMap.get(clientGroup)!
        group.currentYear += amount
        
        // Track managers
        const managers = managerMap.get(clientGroup)!
        if (invoice.account_manager) {
          const count = managers.accountManagers.get(invoice.account_manager) || 0
          managers.accountManagers.set(invoice.account_manager, count + 1)
        }
        if (invoice.job_manager) {
          const count = managers.jobManagers.get(invoice.job_manager) || 0
          managers.jobManagers.set(invoice.job_manager, count + 1)
        }
      })
    }

    // Process last year data
    if (lastYearData) {
      lastYearData.forEach((invoice) => {
        const clientGroup = invoice.client_group || 'Uncategorized'
        // Handle both string and number types for amount
        let amount = 0
        if (typeof invoice.amount === 'number') {
          amount = invoice.amount
        } else if (typeof invoice.amount === 'string') {
          amount = parseFloat(invoice.amount) || 0
        }
        
        if (!clientGroupMap.has(clientGroup)) {
          clientGroupMap.set(clientGroup, { 
            currentYear: 0, 
            lastYear: 0,
            accountManager: null,
            jobManager: null
          })
          managerMap.set(clientGroup, {
            accountManagers: new Map(),
            jobManagers: new Map()
          })
        }
        
        const group = clientGroupMap.get(clientGroup)!
        group.lastYear += amount
        
        // Track managers
        const managers = managerMap.get(clientGroup)!
        if (invoice.account_manager) {
          const count = managers.accountManagers.get(invoice.account_manager) || 0
          managers.accountManagers.set(invoice.account_manager, count + 1)
        }
        if (invoice.job_manager) {
          const count = managers.jobManagers.get(invoice.job_manager) || 0
          managers.jobManagers.set(invoice.job_manager, count + 1)
        }
      })
    }
    
    // Set the most common manager for each client group
    clientGroupMap.forEach((group, clientGroup) => {
      const managers = managerMap.get(clientGroup)
      if (managers) {
        // Find most common account_manager
        let maxCount = 0
        let mostCommonAccountManager: string | null = null
        managers.accountManagers.forEach((count, manager) => {
          if (count > maxCount) {
            maxCount = count
            mostCommonAccountManager = manager
          }
        })
        
        // Find most common job_manager
        maxCount = 0
        let mostCommonJobManager: string | null = null
        managers.jobManagers.forEach((count, manager) => {
          if (count > maxCount) {
            maxCount = count
            mostCommonJobManager = manager
          }
        })
        
        group.accountManager = mostCommonAccountManager
        group.jobManager = mostCommonJobManager
      }
    })
    
    // Debug: Log final JBS&G result
    const jbsgFinal = Array.from(clientGroupMap.entries()).find(([name]) => 
      name.toLowerCase().includes('jbs')
    )
    if (jbsgFinal) {
      console.log(`[DEBUG] Final JBS&G result:`, jbsgFinal)
    }

    // Convert to array and sort by current year amount (descending)
    const result = Array.from(clientGroupMap.entries())
      .map(([clientGroup, data]) => ({
        clientGroup,
        currentYear: data.currentYear,
        lastYear: data.lastYear,
        partner: data.accountManager,
        clientManager: data.jobManager,
      }))
      .sort((a, b) => b.currentYear - a.currentYear)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

