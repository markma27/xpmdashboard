import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

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

    const supabase = await createClient()

    // Calculate financial year based on current date
    const now = new Date()
    const currentMonth = now.getMonth() // 0-11
    const currentYear = now.getFullYear()
    
    // Determine current financial year
    let currentFYStartYear: number
    if (currentMonth >= 6) {
      currentFYStartYear = currentYear
    } else {
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
    const fetchAllData = async (startDate: string, endDate: string): Promise<any[]> => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        let query = supabase
          .from('timesheet_uploads')
          .select('date, time')
          .eq('organization_id', organizationId)
          .eq('capacity_reducing', true)
          .gte('date', startDate)
          .lte('date', endDate)
        
        // Apply staff filter if provided
        if (staffFilter) {
          query = query.eq('staff', staffFilter)
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
    if (currentYearData) {
      currentYearData.forEach((timesheet) => {
        const date = new Date(timesheet.date + 'T00:00:00')
        const month = date.getMonth()
        const year = date.getFullYear()

        // Verify this belongs to current financial year period
        if (!((year === currentFYStartYear && month >= 6) || (year === currentFYEndYear && month < 6))) {
          return
        }

        // Map month to our array index
        const monthIndex = month >= 6 ? month - 6 : month + 6

        // Convert time to hours and add to monthly total
        const hours = convertTimeToHours(timesheet.time)
        monthlyData[monthIndex].currentYear += hours
      })
    }

    // Aggregate last year data
    if (lastYearData) {
      lastYearData.forEach((timesheet) => {
        const date = new Date(timesheet.date + 'T00:00:00')
        const month = date.getMonth()
        const year = date.getFullYear()

        // Verify this belongs to last financial year period
        if (!((year === lastFYStartYear && month >= 6) || (year === lastFYEndYear && month < 6))) {
          return
        }

        // Map month to our array index
        const monthIndex = month >= 6 ? month - 6 : month + 6

        // Convert time to hours and add to monthly total
        const hours = convertTimeToHours(timesheet.time)
        monthlyData[monthIndex].lastYear += hours
      })
    }

    // Return hours (rounded to 2 decimal places)
    const formattedData = monthlyData.map((item) => ({
      month: item.month,
      'Current Year': Math.round(item.currentYear * 100) / 100,
      'Last Year': Math.round(item.lastYear * 100) / 100,
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

