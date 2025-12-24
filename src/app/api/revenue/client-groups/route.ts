import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const partnerFilter = searchParams.get('partner')
    const clientManagerFilter = searchParams.get('clientManager')

    const supabase = await createClient()

    // Calculate financial year based on current date
    // Financial year runs from July 1 to June 30
    const now = new Date()
    const currentMonth = now.getMonth() // 0-11 (0=January, 11=December)
    const currentYear = now.getFullYear()
    
    // Determine current financial year
    // If current month >= 6 (July-December), FY starts in current year
    // If current month < 6 (January-June), FY starts in previous year
    let currentFYStartYear: number
    if (currentMonth >= 6) {
      // July-December: FY starts this year
      currentFYStartYear = currentYear
    } else {
      // January-June: FY started last year
      currentFYStartYear = currentYear - 1
    }
    
    const currentFYEndYear = currentFYStartYear + 1
    const lastFYStartYear = currentFYStartYear - 1
    const lastFYEndYear = currentFYStartYear
    
    // Format dates as YYYY-MM-DD
    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = `${currentFYEndYear}-06-30`
    const lastYearStart = `${lastFYStartYear}-07-01`
    const lastYearEnd = `${lastFYEndYear}-06-30`

    // Use RPC or aggregate query to get sums grouped by client_group
    // This avoids the 1000 record limit by aggregating in the database
    
    // Helper function to fetch all data for a date range
    const fetchAllData = async (startDate: string, endDate: string): Promise<any[]> => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        let query = supabase
          .from('invoice_uploads')
          .select('client_group, amount, account_manager, job_manager')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate)
        
        // Apply partner filter if provided
        if (partnerFilter) {
          query = query.eq('account_manager', partnerFilter)
        }
        
        // Apply client manager filter if provided
        if (clientManagerFilter) {
          query = query.eq('job_manager', clientManagerFilter)
        }
        
        const { data: pageData, error: pageError } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch data: ${pageError.message}`)
        }
        
        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData)
          page++
          hasMore = pageData.length === pageSize
        } else {
          hasMore = false
        }
      }
      
      return allData
    }

    // Fetch current year and last year data in parallel
    const [currentYearData, lastYearData] = await Promise.all([
      fetchAllData(currentYearStart, currentYearEnd),
      fetchAllData(lastYearStart, lastYearEnd),
    ])


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

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

