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
 * Calculate the number of weekdays (Monday-Friday) in a date range
 */
function getWeekdaysInDateRange(startDate: Date, endDate: Date): number {
  let weekdays = 0
  const current = new Date(startDate)
  
  // Normalize to start of day
  current.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  
  while (current <= end) {
    const dayOfWeek = current.getDay()
    // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      weekdays++
    }
    current.setDate(current.getDate() + 1)
  }
  
  return weekdays
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

    const { data: filterOptsRaw, error: filterOptsError } = await supabase.rpc('get_billable_filter_options', {
      p_organization_id: organizationId,
    })
    if (filterOptsError) {
      throw new Error(`Failed to fetch billable filter options: ${filterOptsError.message}`)
    }

    let filterOpts: { staff?: unknown } = {}
    if (typeof filterOptsRaw === 'string') {
      try {
        filterOpts = JSON.parse(filterOptsRaw) as { staff?: unknown }
      } catch {
        filterOpts = {}
      }
    } else if (filterOptsRaw && typeof filterOptsRaw === 'object') {
      filterOpts = filterOptsRaw as { staff?: unknown }
    }

    const uniqueStaffNames = new Set<string>()
    if (Array.isArray(filterOpts.staff)) {
      for (const s of filterOpts.staff) {
        if (typeof s !== 'string') continue
        const trimmedName = s.trim()
        if (trimmedName && trimmedName.toLowerCase() !== 'disbursement') {
          uniqueStaffNames.add(trimmedName)
        }
      }
    }
    const staffNames = Array.from(uniqueStaffNames).sort()

    // Get staff settings (default_daily_hours, fte, start_date, end_date, is_hidden, report)
    const { data: targetData, error: targetError } = await supabase
      .from('staff_settings')
      .select('staff_name, default_daily_hours, fte, start_date, end_date, is_hidden, report')
      .eq('organization_id', organizationId)

    if (targetError) {
      throw new Error(`Failed to fetch staff settings: ${targetError.message}`)
    }

    // Create a map of staff name -> settings
    interface StaffSettings {
      default_daily_hours: number
      fte: number
      start_date: string | null
      end_date: string | null
      is_hidden: boolean
      report: boolean
    }
    const staffSettingsMap = new Map<string, StaffSettings>()
    if (targetData) {
      targetData.forEach((item) => {
        if (item.staff_name) {
          // Skip hidden staff or staff with report = false
          if (item.is_hidden || item.report === false) {
            return
          }
          staffSettingsMap.set(item.staff_name, {
            default_daily_hours: item.default_daily_hours ? Number(item.default_daily_hours) : 8,
            fte: item.fte ? Number(item.fte) : 1.0, // Default to 1.0 (full-time) if not set
            start_date: item.start_date || null,
            end_date: item.end_date || null,
            is_hidden: item.is_hidden || false,
            report: item.report !== undefined ? Boolean(item.report) : true, // Default to true if not set
          })
        }
      })
    }
    
    // For staff names from timesheet_uploads that don't have settings, default to 8 hours and 1.0 FTE
    staffNames.forEach((staffName) => {
      if (!staffSettingsMap.has(staffName)) {
        staffSettingsMap.set(staffName, {
          default_daily_hours: 8, // Default to 8 hours if not set
          fte: 1.0, // Default to 1.0 (full-time) if not set
          start_date: null,
          end_date: null,
          is_hidden: false,
          report: true, // Default to true if not set
        })
      }
    })

    // If "All Staff" is selected, we need to filter to only include staff that appear in the dropdown list
    // The dropdown list includes staff with billable hours in current or last financial year
    let eligibleStaffForAllStaff: Set<string> | null = null
    if (!staffFilter) {
      const cyStart = `${currentFYStartYear}-07-01`
      const cyEnd = `${currentFYEndYear}-06-30`
      const lyStart = `${lastFYStartYear}-07-01`
      const lyEnd = `${lastFYEndYear}-06-30`

      const { data: eligibleRaw, error: eligibleError } = await supabase.rpc('get_productivity_eligible_staff', {
        p_organization_id: organizationId,
        p_current_year_start: cyStart,
        p_current_year_end: cyEnd,
        p_last_year_start: lyStart,
        p_last_year_end: lyEnd,
      })

      if (eligibleError) {
        throw new Error(`Failed to fetch eligible staff: ${eligibleError.message}`)
      }

      let names: unknown = eligibleRaw
      if (typeof eligibleRaw === 'string') {
        try {
          names = JSON.parse(eligibleRaw)
        } catch {
          names = []
        }
      }

      eligibleStaffForAllStaff = new Set<string>()
      if (Array.isArray(names)) {
        for (const n of names) {
          if (typeof n === 'string' && n.trim()) eligibleStaffForAllStaff.add(n.trim())
        }
      }
    }

    // Filter staff if staffFilter is provided
    let selectedStaffNames: string[] = []
    if (staffFilter) {
      // Single staff selected - check if not hidden and report = true
      const settings = staffSettingsMap.get(staffFilter)
      if (settings && !settings.is_hidden && settings.report !== false) {
        selectedStaffNames = [staffFilter]
      }
    } else {
      // All staff selected - only include staff that appear in the dropdown list
      // (i.e., staff with billable hours in current or last financial year, not hidden, and report = true)
      if (eligibleStaffForAllStaff) {
        selectedStaffNames = Array.from(eligibleStaffForAllStaff)
          .filter((staffName) => {
            const settings = staffSettingsMap.get(staffName)
            return settings && !settings.is_hidden && settings.report !== false
          })
          .sort()
      } else {
        // Fallback: exclude hidden staff and staff with report = false (should not happen, but just in case)
        selectedStaffNames = Array.from(staffSettingsMap.entries())
          .filter(([_, settings]) => !settings.is_hidden && settings.report !== false)
          .map(([staffName, _]) => staffName)
      }
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

      // Calculate month start and end dates
      const currentYearMonthStart = new Date(currentYearForMonth, monthIndex, 1)
      const currentYearMonthEnd = new Date(currentYearForMonth, monthIndex + 1, 0)
      const lastYearMonthStart = new Date(lastYearForMonth, monthIndex, 1)
      const lastYearMonthEnd = new Date(lastYearForMonth, monthIndex + 1, 0)

      selectedStaffNames.forEach((staffName) => {
        const settings = staffSettingsMap.get(staffName)
        if (!settings) return

        // Calculate effective daily hours = default_daily_hours * fte
        const dailyHours = (settings.default_daily_hours || 8) * (settings.fte || 1.0)

        // Calculate effective date range for current year month
        let currentYearEffectiveStart: Date | null = currentYearMonthStart
        let currentYearEffectiveEnd: Date | null = currentYearMonthEnd
        
        if (settings.start_date) {
          const startDate = new Date(settings.start_date)
          startDate.setHours(0, 0, 0, 0)
          // If start date is after month end, exclude this staff
          if (startDate > currentYearMonthEnd) {
            currentYearEffectiveStart = null // Mark as excluded
          } else if (startDate > currentYearMonthStart) {
            // Staff started during the month - use start date as effective start
            currentYearEffectiveStart = startDate
          }
        }
        
        if (settings.end_date && currentYearEffectiveStart !== null) {
          const endDate = new Date(settings.end_date)
          endDate.setHours(23, 59, 59, 999)
          // If end date is before month start, exclude this staff
          if (endDate < currentYearMonthStart) {
            currentYearEffectiveStart = null // Mark as excluded
          } else if (endDate < currentYearMonthEnd) {
            // Staff ended during the month - use end date as effective end
            currentYearEffectiveEnd = endDate
          }
        }

        // Calculate effective date range for last year month
        let lastYearEffectiveStart: Date | null = lastYearMonthStart
        let lastYearEffectiveEnd: Date | null = lastYearMonthEnd
        
        if (settings.start_date) {
          const startDate = new Date(settings.start_date)
          startDate.setHours(0, 0, 0, 0)
          if (startDate > lastYearMonthEnd) {
            lastYearEffectiveStart = null // Mark as excluded
          } else if (startDate > lastYearMonthStart) {
            lastYearEffectiveStart = startDate
          }
        }
        
        if (settings.end_date && lastYearEffectiveStart !== null) {
          const endDate = new Date(settings.end_date)
          endDate.setHours(23, 59, 59, 999)
          if (endDate < lastYearMonthStart) {
            lastYearEffectiveStart = null // Mark as excluded
          } else if (endDate < lastYearMonthEnd) {
            lastYearEffectiveEnd = endDate
          }
        }

        // Calculate weekdays for effective date ranges
        // Only calculate if effective start and end are valid
        if (currentYearEffectiveStart !== null && currentYearEffectiveEnd !== null) {
          const currentYearEffectiveWeekdays = getWeekdaysInDateRange(
            currentYearEffectiveStart,
            currentYearEffectiveEnd
          )
          currentYearTotal += currentYearEffectiveWeekdays * dailyHours
        }
        
        if (lastYearEffectiveStart !== null && lastYearEffectiveEnd !== null) {
          const lastYearEffectiveWeekdays = getWeekdaysInDateRange(
            lastYearEffectiveStart,
            lastYearEffectiveEnd
          )
          lastYearTotal += lastYearEffectiveWeekdays * dailyHours
        }
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
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
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

