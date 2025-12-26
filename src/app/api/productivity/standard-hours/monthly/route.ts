import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * Calculate the number of weekdays (Monday-Friday) in a given month
 */
function getWeekdaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let weekdays = 0
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dayOfWeek = date.getDay()
    // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      weekdays++
    }
  }
  
  return weekdays
}

/**
 * Extract staff name from raw_data (XPM API XML format parsed by xml2js)
 */
function extractStaffName(rawData: any): string {
  if (!rawData) return 'Unknown'
  
  const extractValue = (obj: any, key: string): string | null => {
    if (!obj || !obj[key]) return null
    const value = obj[key]
    if (Array.isArray(value) && value.length > 0) {
      return String(value[0])
    }
    return String(value)
  }
  
  const firstName = extractValue(rawData, 'FirstName')
  const lastName = extractValue(rawData, 'LastName')
  const name = extractValue(rawData, 'Name')
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`.trim()
  } else if (firstName) {
    return firstName
  } else if (lastName) {
    return lastName
  } else if (name) {
    return name
  } else if (typeof rawData === 'string') {
    return rawData
  }
  
  return 'Unknown'
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

    // Get all staff from xpm_staff table
    const { data: staffData, error: staffError } = await supabase
      .from('xpm_staff')
      .select('id, xpm_id, raw_data')
      .eq('organization_id', organizationId)

    if (staffError) {
      throw new Error(`Failed to fetch staff: ${staffError.message}`)
    }

    // Get staff settings (default_daily_hours)
    const { data: targetData, error: targetError } = await supabase
      .from('staff_target_billable')
      .select('xpm_id, default_daily_hours')
      .eq('organization_id', organizationId)

    if (targetError) {
      throw new Error(`Failed to fetch staff settings: ${targetError.message}`)
    }

    // Create a map of xpm_id -> default_daily_hours
    const dailyHoursMap = new Map<string, number>()
    if (targetData) {
      targetData.forEach((item) => {
        if (item.default_daily_hours) {
          dailyHoursMap.set(item.xpm_id, Number(item.default_daily_hours))
        }
      })
    }

    // Create a map of staff name -> default_daily_hours
    const staffNameToHoursMap = new Map<string, number>()
    if (staffData) {
      staffData.forEach((staff) => {
        const staffName = extractStaffName(staff.raw_data)
        const dailyHours = dailyHoursMap.get(staff.xpm_id) || 8 // Default to 8 hours if not set
        staffNameToHoursMap.set(staffName, dailyHours)
      })
    }

    // Filter staff if staffFilter is provided
    let selectedStaffNames: string[] = []
    if (staffFilter) {
      // Single staff selected
      selectedStaffNames = [staffFilter]
    } else {
      // All staff selected
      selectedStaffNames = Array.from(staffNameToHoursMap.keys())
    }

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

    // Calculate standard hours for each month
    // Current financial year: July currentFYStartYear to June currentFYEndYear
    for (let i = 0; i < months.length; i++) {
      const month = months[i]
      let monthIndex: number // 0-11 (0=January, 11=December)
      let currentYearForMonth: number
      let lastYearForMonth: number

      if (i < 6) {
        // July (i=0) to December (i=5) = first year of FY
        monthIndex = i + 6 // July = 6, August = 7, ..., December = 11
        currentYearForMonth = currentFYStartYear
        lastYearForMonth = lastFYStartYear
      } else {
        // January (i=6) to June (i=11) = second year of FY
        monthIndex = i - 6 // January = 0, February = 1, ..., June = 5
        currentYearForMonth = currentFYEndYear
        lastYearForMonth = lastFYEndYear
      }

      // Calculate weekdays for current year month
      const currentYearWeekdays = getWeekdaysInMonth(
        currentYearForMonth,
        monthIndex
      )

      // Calculate weekdays for last year month
      const lastYearWeekdays = getWeekdaysInMonth(
        lastYearForMonth,
        monthIndex
      )

      // Calculate total standard hours for selected staff
      let currentYearTotal = 0
      let lastYearTotal = 0

      selectedStaffNames.forEach((staffName) => {
        const dailyHours = staffNameToHoursMap.get(staffName) || 8
        currentYearTotal += currentYearWeekdays * dailyHours
        lastYearTotal += lastYearWeekdays * dailyHours
      })

      monthlyData[i].currentYear = Math.round(currentYearTotal * 100) / 100
      monthlyData[i].lastYear = Math.round(lastYearTotal * 100) / 100
    }

    // Return formatted data
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

