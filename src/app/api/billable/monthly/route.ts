import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const staffFilter = searchParams.get('staff') // Optional staff filter
    
    // Parse filters from query params
    // Format: filters=type1:value1|type2:value2 or filters=type1:operator:value1
    const filtersParam = searchParams.get('filters')
    const filters: Array<{ type: string; value: string; operator?: string }> = []
    if (filtersParam) {
      filtersParam.split('|').forEach((filterStr) => {
        const parts = filterStr.split(':')
        if (parts.length >= 2) {
          if (parts.length === 3) {
            // Has operator (for job_name)
            filters.push({ 
              type: parts[0], 
              operator: decodeURIComponent(parts[1]), 
              value: decodeURIComponent(parts[2]) 
            })
          } else {
            filters.push({ 
              type: parts[0], 
              value: decodeURIComponent(parts[1]) 
            })
          }
        }
      })
    }

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

    // Helper function to fetch all data for a date range
    async function fetchAllData(startDate: string, endDate: string): Promise<any[]> {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        let query = supabase
          .from('timesheet_uploads')
          .select('date, billable_amount, client_group, account_manager, job_manager, job_name, staff')
          .eq('organization_id', organizationId)
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
        
        // Apply additional filters
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
                  // For not_contains, we need to include NULL values
                  // Use or() to include records where job_name is NULL or doesn't contain the value
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

    // Fetch current year and last year data in parallel
    const [currentYearData, lastYearData] = await Promise.all([
      fetchAllData(currentYearStart, currentYearEnd),
      fetchAllData(lastYearStart, lastYearEnd),
    ])

    // Initialize months array (July to June)
    const months = [
      'July', 'August', 'September', 'October', 'November', 'December',
      'January', 'February', 'March', 'April', 'May', 'June'
    ]

    // Initialize data structure
    const monthlyData = months.map((month) => {
      return {
        month,
        currentYear: 0,
        lastYear: 0,
      }
    })

    // Aggregate current year data
    // Current financial year: July currentFYStartYear to June currentFYEndYear
    if (currentYearData) {
      currentYearData.forEach((timesheet) => {
        const date = new Date(timesheet.date + 'T00:00:00') // Ensure consistent date parsing
        const month = date.getMonth()
        const year = date.getFullYear()

        // Verify this belongs to current financial year period
        // July currentFYStartYear to June currentFYEndYear
        if (!((year === currentFYStartYear && month >= 6) || (year === currentFYEndYear && month < 6))) {
          return // Skip if not in current financial year range
        }

        // Map month to our array index
        // July (6) = 0, August (7) = 1, ..., December (11) = 5
        // January (0) = 6, February (1) = 7, ..., June (5) = 11
        const monthIndex = month >= 6 ? month - 6 : month + 6

        // Handle both string and number types for billable_amount
        let amount = 0
        if (typeof timesheet.billable_amount === 'number') {
          amount = timesheet.billable_amount
        } else if (typeof timesheet.billable_amount === 'string') {
          amount = parseFloat(timesheet.billable_amount) || 0
        }
        monthlyData[monthIndex].currentYear += amount
      })
    }

    // Aggregate last year data
    // Last financial year: July lastFYStartYear to June lastFYEndYear
    if (lastYearData) {
      lastYearData.forEach((timesheet) => {
        const date = new Date(timesheet.date + 'T00:00:00') // Ensure consistent date parsing
        const month = date.getMonth()
        const year = date.getFullYear()

        // Verify this belongs to last financial year period
        // July lastFYStartYear to June lastFYEndYear
        if (!((year === lastFYStartYear && month >= 6) || (year === lastFYEndYear && month < 6))) {
          return // Skip if not in last financial year range
        }

        // Map month to our array index
        const monthIndex = month >= 6 ? month - 6 : month + 6

        // Handle both string and number types for billable_amount
        let amount = 0
        if (typeof timesheet.billable_amount === 'number') {
          amount = timesheet.billable_amount
        } else if (typeof timesheet.billable_amount === 'string') {
          amount = parseFloat(timesheet.billable_amount) || 0
        }
        monthlyData[monthIndex].lastYear += amount
      })
    }

    // Return full amounts (not divided by 1000, no rounding)
    const formattedData = monthlyData.map((item) => ({
      month: item.month,
      'Current Year': item.currentYear,
      'Last Year': item.lastYear,
    }))

    return NextResponse.json(formattedData, {
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

