import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateLocal } from '@/lib/utils'

/**
 * Convert time value from timesheet format to hours
 * Format:
 * - If value < 100: value represents minutes, convert to hours by dividing by 60
 *   Example: 12 = 12 minutes = 0.2 hours
 * - If value >= 100: first 100 = 1 hour, remainder = minutes
 *   Example: 112 = 1 hour + 12 minutes = 1.2 hours
 * Note: Values are stored as numeric(10,2) so we need to handle decimal values properly
 */
function convertTimeToHours(timeValue: number | string | null): number {
  if (timeValue === null || timeValue === undefined) return 0
  
  const numValue = typeof timeValue === 'string' ? parseFloat(timeValue) : timeValue
  if (isNaN(numValue) || numValue <= 0) return 0
  
  // Round to handle any floating point precision issues
  const roundedValue = Math.round(numValue)
  
  if (roundedValue < 100) {
    // Value < 100: represents minutes, convert to hours
    return roundedValue / 60
  } else {
    // Value >= 100: first 100 = 1 hour, remainder = minutes
    const hours = Math.floor(roundedValue / 100)
    const minutes = roundedValue % 100
    return hours + (minutes / 60)
  }
}

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const staffFilter = searchParams.get('staff') // Optional staff filter
    const monthFilter = searchParams.get('month') // Optional month filter (e.g., "October")
    const asOfDateParam = searchParams.get('asOfDate')
    
    // Parse filters from query params (same format as Billable page)
    const filtersParam = searchParams.get('filters')
    const filters: Array<{ type: string; value: string; operator?: string }> = []
    if (filtersParam) {
      try {
        const parsedFilters = JSON.parse(filtersParam)
        if (Array.isArray(parsedFilters)) {
          parsedFilters.forEach((filter: any) => {
            if (filter.type && filter.value) {
              filters.push({
                type: filter.type,
                value: typeof filter.value === 'string' ? decodeURIComponent(filter.value) : filter.value,
                operator: filter.operator,
              })
            }
          })
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    const supabase = await createClient()

    // Use provided date or default to today
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date()
    const currentMonth = asOfDate.getMonth() // 0-11 (0=January, 11=December)
    const currentYear = asOfDate.getFullYear()
    
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
    
    // Format dates as YYYY-MM-DD (using local timezone)
    // For "same time" comparison, use selected date for current year
    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = formatDateLocal(asOfDate) // Selected date
    
    // For last year, always use full financial year (July to June)
    const lastYearStart = `${lastFYStartYear}-07-01`
    const lastYearEnd = `${lastFYEndYear}-06-30`

    // Helper function to get month date range
    const getMonthDateRange = (monthName: string, year: number) => {
      const monthMap: { [key: string]: number } = {
        'January': 0, 'February': 1, 'March': 2, 'April': 3,
        'May': 4, 'June': 5, 'July': 6, 'August': 7,
        'September': 8, 'October': 9, 'November': 10, 'December': 11
      }
      const monthIndex = monthMap[monthName]
      if (monthIndex === undefined) return null
      
      const startDate = new Date(year, monthIndex, 1)
      const endDate = new Date(year, monthIndex + 1, 0)
      
      return {
        start: `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`,
        end: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
      }
    }

    // Helper function to fetch all data for a date range
    const fetchAllData = async (startDate: string, endDate: string): Promise<any[]> => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        let query = supabase
          .from('timesheet_uploads')
          .select('client_group, time, billable_amount, account_manager, job_manager, job_name, staff, date')
          .eq('organization_id', organizationId)
          .eq('billable', true) // Only include billable = true records for billable hours and billable $
          .gte('date', startDate)
          .lte('date', endDate)
        
        // Apply staff filter if provided (from URL param or filter)
        let staffFilterValue = staffFilter
        filters.forEach((filter) => {
          if (filter.type === 'staff' && filter.value && filter.value !== 'all') {
            staffFilterValue = filter.value
          }
        })
        if (staffFilterValue) {
          query = query.eq('staff', staffFilterValue)
        }
        
        // Apply additional filters (same logic as Billable page)
        filters.forEach((filter) => {
          if (filter.value && filter.value !== 'all' && filter.type !== 'staff') {
            switch (filter.type) {
              case 'client_group':
                query = query.eq('client_group', filter.value)
                break
              case 'account_manager':
                query = query.eq('account_manager', filter.value)
                break
              case 'job_manager':
                query = query.eq('job_manager', filter.value)
                break
              case 'job_name':
                if (filter.operator === 'not_contains') {
                  query = query.or(`job_name.not.ilike.%${filter.value}%,job_name.is.null`)
                } else {
                  query = query.ilike('job_name', `%${filter.value}%`)
                }
                break
            }
          }
        })
        
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

    // Determine date ranges based on month filter
    let currentYearData: any[] = []
    let lastYearData: any[] = []
    
    if (monthFilter) {
      // Filter by specific month
      const monthMap: { [key: string]: number } = {
        'January': 0, 'February': 1, 'March': 2, 'April': 3,
        'May': 4, 'June': 5, 'July': 6, 'August': 7,
        'September': 8, 'October': 9, 'November': 10, 'December': 11
      }
      const monthIndex = monthMap[monthFilter]
      
      if (monthIndex !== undefined) {
        // Determine which financial year this month belongs to
        let currentYear: number
        let lastYear: number
        
        if (monthIndex >= 6) {
          // July-December: belongs to current FY start year
          currentYear = currentFYStartYear
          lastYear = lastFYStartYear
        } else {
          // January-June: belongs to current FY end year
          currentYear = currentFYEndYear
          lastYear = lastFYEndYear
        }
        
        const currentRange = getMonthDateRange(monthFilter, currentYear)
        const lastRange = getMonthDateRange(monthFilter, lastYear)
        
        if (currentRange && lastRange) {
          [currentYearData, lastYearData] = await Promise.all([
            fetchAllData(currentRange.start, currentRange.end),
            fetchAllData(lastRange.start, lastRange.end),
          ])
        }
      }
    } else {
      // Fetch all data for current and last financial year
      [currentYearData, lastYearData] = await Promise.all([
        fetchAllData(currentYearStart, currentYearEnd),
        fetchAllData(lastYearStart, lastYearEnd),
      ])
    }

    // Aggregate by client_group
    // Store account_manager and job_manager (use the most common one for each group)
    const clientGroupMap = new Map<string, { 
      currentYear: number
      lastYear: number
      currentYearAmount: number
      lastYearAmount: number
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
      currentYearData.forEach((timesheet) => {
        const clientGroup = timesheet.client_group || 'Uncategorized'
        const hours = convertTimeToHours(timesheet.time)
        const amount = typeof timesheet.billable_amount === 'number' 
          ? timesheet.billable_amount 
          : (typeof timesheet.billable_amount === 'string' ? parseFloat(timesheet.billable_amount) || 0 : 0)
        
        if (!clientGroupMap.has(clientGroup)) {
          clientGroupMap.set(clientGroup, { 
            currentYear: 0, 
            lastYear: 0,
            currentYearAmount: 0,
            lastYearAmount: 0,
            accountManager: null,
            jobManager: null
          })
          managerMap.set(clientGroup, {
            accountManagers: new Map(),
            jobManagers: new Map()
          })
        }
        
        const group = clientGroupMap.get(clientGroup)!
        group.currentYear += hours
        group.currentYearAmount += amount
        
        // Track managers
        const managers = managerMap.get(clientGroup)!
        if (timesheet.account_manager) {
          const count = managers.accountManagers.get(timesheet.account_manager) || 0
          managers.accountManagers.set(timesheet.account_manager, count + 1)
        }
        if (timesheet.job_manager) {
          const count = managers.jobManagers.get(timesheet.job_manager) || 0
          managers.jobManagers.set(timesheet.job_manager, count + 1)
        }
      })
    }

    // Process last year data
    if (lastYearData) {
      lastYearData.forEach((timesheet) => {
        const clientGroup = timesheet.client_group || 'Uncategorized'
        const hours = convertTimeToHours(timesheet.time)
        const amount = typeof timesheet.billable_amount === 'number' 
          ? timesheet.billable_amount 
          : (typeof timesheet.billable_amount === 'string' ? parseFloat(timesheet.billable_amount) || 0 : 0)
        
        if (!clientGroupMap.has(clientGroup)) {
          clientGroupMap.set(clientGroup, { 
            currentYear: 0, 
            lastYear: 0,
            currentYearAmount: 0,
            lastYearAmount: 0,
            accountManager: null,
            jobManager: null
          })
          managerMap.set(clientGroup, {
            accountManagers: new Map(),
            jobManagers: new Map()
          })
        }
        
        const group = clientGroupMap.get(clientGroup)!
        group.lastYear += hours
        group.lastYearAmount += amount
        
        // Track managers
        const managers = managerMap.get(clientGroup)!
        if (timesheet.account_manager) {
          const count = managers.accountManagers.get(timesheet.account_manager) || 0
          managers.accountManagers.set(timesheet.account_manager, count + 1)
        }
        if (timesheet.job_manager) {
          const count = managers.jobManagers.get(timesheet.job_manager) || 0
          managers.jobManagers.set(timesheet.job_manager, count + 1)
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

    // Convert to array and sort by current year hours (descending)
    // Round hours to 2 decimal places
    const result = Array.from(clientGroupMap.entries())
      .map(([clientGroup, data]) => ({
        clientGroup,
        currentYear: Math.round(data.currentYear * 100) / 100,
        lastYear: Math.round(data.lastYear * 100) / 100,
        currentYearAmount: Math.round(data.currentYearAmount * 100) / 100,
        lastYearAmount: Math.round(data.lastYearAmount * 100) / 100,
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

