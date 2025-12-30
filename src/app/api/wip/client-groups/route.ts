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

    // Fetch all WIP data - get all records using pagination
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    while (hasMore) {
      let query = supabase
        .from('wip_timesheet_uploads')
        .select('client_group, billable_amount, account_manager, job_manager, date')
        .eq('organization_id', organizationId)
      
      // Apply filters if provided
      if (partnerFilter) {
        query = query.eq('account_manager', partnerFilter)
      }
      if (clientManagerFilter) {
        query = query.eq('job_manager', clientManagerFilter)
      }
      
      const { data: pageData, error: pageError } = await query
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (pageError) {
        return NextResponse.json(
          { error: 'Failed to fetch WIP data', details: pageError.message },
          { status: 500 }
        )
      }
      
      if (pageData && pageData.length > 0) {
        allData = allData.concat(pageData)
        page++
        hasMore = pageData.length === pageSize
      } else {
        hasMore = false
      }
    }

    // Aggregate by client_group
    // Store account_manager and job_manager (use the most common one for each group)
    const clientGroupMap = new Map<string, { 
      amount: number
      accountManager: string | null
      jobManager: string | null
      aging: {
        lessThan30: number
        days30to60: number
        days60to90: number
        days90to120: number
        days120Plus: number
      }
    }>()
    
    // Track managers for each client group (to find most common)
    const managerMap = new Map<string, {
      accountManagers: Map<string, number>
      jobManagers: Map<string, number>
    }>()

    // Get today's date for age calculation (use UTC to be consistent with stored dates)
    const now = new Date()
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

    // Process data
    allData.forEach((record) => {
      const clientGroup = record.client_group || 'Uncategorized'
      let amount = 0
      if (typeof record.billable_amount === 'number') {
        amount = record.billable_amount
      } else if (typeof record.billable_amount === 'string') {
        amount = parseFloat(record.billable_amount) || 0
      }
      
      if (!clientGroupMap.has(clientGroup)) {
        clientGroupMap.set(clientGroup, { 
          amount: 0,
          accountManager: null,
          jobManager: null,
          aging: {
            lessThan30: 0,
            days30to60: 0,
            days60to90: 0,
            days90to120: 0,
            days120Plus: 0
          }
        })
        managerMap.set(clientGroup, {
          accountManagers: new Map(),
          jobManagers: new Map()
        })
      }
      
      const group = clientGroupMap.get(clientGroup)!
      group.amount += amount
      
      // Calculate age in days
      let daysDiff: number | null = null
      let dateProcessed = false
      
      if (record.date) {
        try {
          let recordDateUTC: number | null = null
          
          // Handle date - could be string (YYYY-MM-DD) or Date object
          if (typeof record.date === 'string') {
            // Parse string date (YYYY-MM-DD format from Supabase) as UTC
            const dateParts = record.date.split('-')
            if (dateParts.length === 3) {
              const year = parseInt(dateParts[0], 10)
              const month = parseInt(dateParts[1], 10) - 1 // Month is 0-indexed
              const day = parseInt(dateParts[2], 10)
              if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                recordDateUTC = Date.UTC(year, month, day)
              }
            } else {
              const d = new Date(record.date)
              if (!isNaN(d.getTime())) {
                recordDateUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
              }
            }
          } else if (record.date instanceof Date) {
            recordDateUTC = Date.UTC(record.date.getUTCFullYear(), record.date.getUTCMonth(), record.date.getUTCDate())
          }
          
          // Calculate days difference if we have a valid date
          if (recordDateUTC !== null) {
            daysDiff = Math.floor((todayUTC - recordDateUTC) / (1000 * 60 * 60 * 24))
            dateProcessed = true
          }
        } catch (e) {
          // Date parsing error, will be handled below
          dateProcessed = false
        }
      }
      
      // Categorize by age if we have a valid daysDiff, otherwise assign to < 30 days
      if (daysDiff !== null && dateProcessed) {
        if (daysDiff < 0) {
          // Future dates go to < 30 days
          group.aging.lessThan30 += amount
        } else if (daysDiff < 30) {
          group.aging.lessThan30 += amount
        } else if (daysDiff < 60) {
          group.aging.days30to60 += amount
        } else if (daysDiff < 90) {
          group.aging.days60to90 += amount
        } else if (daysDiff < 120) {
          group.aging.days90to120 += amount
        } else {
          group.aging.days120Plus += amount
        }
      } else {
        // If no date or invalid date, assign to < 30 days bucket to ensure sum equals total
        group.aging.lessThan30 += amount
      }
      
      // Track managers
      const managers = managerMap.get(clientGroup)!
      if (record.account_manager) {
        const count = managers.accountManagers.get(record.account_manager) || 0
        managers.accountManagers.set(record.account_manager, count + 1)
      }
      if (record.job_manager) {
        const count = managers.jobManagers.get(record.job_manager) || 0
        managers.jobManagers.set(record.job_manager, count + 1)
      }
    })
    
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

    // Convert to array and sort by amount (descending)
    const result = Array.from(clientGroupMap.entries())
      .map(([clientGroup, data]) => ({
        clientGroup,
        amount: Math.round(data.amount),
        partner: data.accountManager,
        clientManager: data.jobManager,
        aging: {
          lessThan30: Math.round(data.aging.lessThan30),
          days30to60: Math.round(data.aging.days30to60),
          days60to90: Math.round(data.aging.days60to90),
          days90to120: Math.round(data.aging.days90to120),
          days120Plus: Math.round(data.aging.days120Plus),
        },
      }))
      .sort((a, b) => b.amount - a.amount)

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

