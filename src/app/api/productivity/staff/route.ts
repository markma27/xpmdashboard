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
    const fetchAllData = async (startDate: string, endDate: string): Promise<any[]> => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('timesheet_uploads')
          .select('staff, time')
          .eq('organization_id', organizationId)
          .eq('billable', true)
          .gte('date', startDate)
          .lte('date', endDate)
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

    // Aggregate hours by staff for both years
    const staffHours = new Map<string, { currentYear: number; lastYear: number }>()

    // Process current year data
    if (currentYearData) {
      currentYearData.forEach((record) => {
        if (record.staff) {
          const staffName = record.staff.trim()
          // Exclude 'disbursement' (case-insensitive)
          if (staffName && staffName.toLowerCase() !== 'disbursement') {
            if (!staffHours.has(staffName)) {
              staffHours.set(staffName, { currentYear: 0, lastYear: 0 })
            }
            const staff = staffHours.get(staffName)!
            const hours = convertTimeToHours(record.time)
            staff.currentYear += hours
          }
        }
      })
    }

    // Process last year data
    if (lastYearData) {
      lastYearData.forEach((record) => {
        if (record.staff) {
          const staffName = record.staff.trim()
          // Exclude 'disbursement' (case-insensitive)
          if (staffName && staffName.toLowerCase() !== 'disbursement') {
            if (!staffHours.has(staffName)) {
              staffHours.set(staffName, { currentYear: 0, lastYear: 0 })
            }
            const staff = staffHours.get(staffName)!
            const hours = convertTimeToHours(record.time)
            staff.lastYear += hours
          }
        }
      })
    }

    // Filter staff: only include those with at least one non-zero year
    // Round hours to 2 decimal places first and check if > 0
    const staffList = Array.from(staffHours.entries())
      .filter(([_, hours]) => {
        const roundedCurrentYear = Math.round(hours.currentYear * 100) / 100
        const roundedLastYear = Math.round(hours.lastYear * 100) / 100
        return roundedCurrentYear > 0 || roundedLastYear > 0
      })
      .map(([staffName, _]) => staffName)
      .sort()

    return NextResponse.json(staffList, {
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

