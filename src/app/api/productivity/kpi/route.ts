import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * Convert time value from timesheet format to hours
 */
function convertTimeToHours(timeValue: number | string | null): number {
  if (timeValue === null || timeValue === undefined) return 0
  
  const numValue = typeof timeValue === 'string' ? parseFloat(timeValue) : timeValue
  if (isNaN(numValue) || numValue <= 0) return 0
  
  const roundedValue = Math.round(numValue)
  
  if (roundedValue < 100) {
    return roundedValue / 60
  } else {
    const hours = Math.floor(roundedValue / 100)
    const minutes = roundedValue % 100
    return hours + (minutes / 60)
  }
}

/**
 * Calculate the number of weekdays (Monday-Friday) in a date range
 */
function getWeekdaysInDateRange(startDate: Date, endDate: Date): number {
  let weekdays = 0
  const current = new Date(startDate)
  
  current.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  
  while (current <= end) {
    const dayOfWeek = current.getDay()
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
    const asOfDateParam = searchParams.get('asOfDate')

    const supabase = await createClient()

    // Use provided date or default to today
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date()
    const currentMonth = asOfDate.getMonth() // 0-11
    const currentYear = asOfDate.getFullYear()
    
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
    const currentYearEnd = asOfDate.toISOString().split('T')[0] // Selected date for YTD
    const lastYearStart = `${lastFYStartYear}-07-01`
    const lastYearEnd = `${lastFYEndYear}-06-30`

    // Helper function to fetch all billable data for a date range
    async function fetchBillableData(startDate: string, endDate: string): Promise<{ hours: number, amount: number }> {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        let query = supabase
          .from('timesheet_uploads')
          .select('time, billable_amount')
          .eq('organization_id', organizationId)
          .eq('billable', true)
          .gte('date', startDate)
          .lte('date', endDate)
        
        if (staffFilter) {
          query = query.eq('staff', staffFilter)
        }
        
        const { data: pageData, error: pageError } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch billable data: ${pageError.message}`)
        }
        
        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData)
          page++
          hasMore = pageData.length === pageSize
        } else {
          hasMore = false
        }
      }
      
      let totalHours = 0
      let totalAmount = 0
      
      allData.forEach((record) => {
        totalHours += convertTimeToHours(record.time)
        totalAmount += Number(record.billable_amount || 0)
      })
      
      return { hours: totalHours, amount: totalAmount }
    }

    // Helper function to calculate standard hours for a date range
    async function calculateStandardHours(startDate: string, endDate: string): Promise<number> {
      // Get staff settings
      let allSettings: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        let query = supabase
          .from('staff_settings')
          .select('staff_name, default_daily_hours, fte, start_date, end_date, is_hidden, report')
          .eq('organization_id', organizationId)
        
        const { data: pageData, error: pageError } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch staff settings: ${pageError.message}`)
        }
        
        if (pageData && pageData.length > 0) {
          allSettings = allSettings.concat(pageData)
          page++
          hasMore = pageData.length === pageSize
        } else {
          hasMore = false
        }
      }

      // Create staff settings map
      const staffSettingsMap = new Map<string, any>()
      allSettings.forEach((setting) => {
        if (setting.staff_name) {
          staffSettingsMap.set(setting.staff_name, setting)
        }
      })

      // If "All Staff" is selected, we need to filter to only include staff that appear in the dropdown list
      // The dropdown list includes staff with billable hours in current or last financial year
      let eligibleStaffForAllStaff: Set<string> | null = null
      if (!staffFilter) {
        // Fetch billable hours data to determine which staff should be included
        const currentYearStart = `${currentFYStartYear}-07-01`
        const currentYearEnd = `${currentFYEndYear}-06-30`
        const lastYearStart = `${lastFYStartYear}-07-01`
        const lastYearEnd = `${lastFYEndYear}-06-30`

        // Helper function to fetch all billable data for a date range
        const fetchAllBillableData = async (startDate: string, endDate: string): Promise<any[]> => {
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
              throw new Error(`Failed to fetch billable data: ${pageError.message}`)
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

        // Fetch current year and last year billable data in parallel
        const [currentYearBillableData, lastYearBillableData] = await Promise.all([
          fetchAllBillableData(currentYearStart, currentYearEnd),
          fetchAllBillableData(lastYearStart, lastYearEnd),
        ])

        // Aggregate billable hours by staff for both years
        const staffBillableHours = new Map<string, { currentYear: number; lastYear: number }>()

        // Process current year billable data
        if (currentYearBillableData) {
          currentYearBillableData.forEach((record) => {
            if (record.staff) {
              const staffName = record.staff.trim()
              if (staffName && staffName.toLowerCase() !== 'disbursement') {
                if (!staffBillableHours.has(staffName)) {
                  staffBillableHours.set(staffName, { currentYear: 0, lastYear: 0 })
                }
                const staff = staffBillableHours.get(staffName)!
                const hours = convertTimeToHours(record.time)
                staff.currentYear += hours
              }
            }
          })
        }

        // Process last year billable data
        if (lastYearBillableData) {
          lastYearBillableData.forEach((record) => {
            if (record.staff) {
              const staffName = record.staff.trim()
              if (staffName && staffName.toLowerCase() !== 'disbursement') {
                if (!staffBillableHours.has(staffName)) {
                  staffBillableHours.set(staffName, { currentYear: 0, lastYear: 0 })
                }
                const staff = staffBillableHours.get(staffName)!
                const hours = convertTimeToHours(record.time)
                staff.lastYear += hours
              }
            }
          })
        }

        // Get excluded staff set (hidden or report = false)
        const excludedStaffSet = new Set<string>()
        allSettings.forEach((setting) => {
          if (setting.staff_name && (setting.is_hidden || setting.report === false)) {
            excludedStaffSet.add(setting.staff_name)
          }
        })

        // Filter to only include staff with billable hours, not hidden, and report = true
        eligibleStaffForAllStaff = new Set<string>()
        staffBillableHours.forEach((hours, staffName) => {
          // Exclude hidden staff or staff with report = false
          if (excludedStaffSet.has(staffName)) {
            return
          }
          const roundedCurrentYear = Math.round(hours.currentYear * 100) / 100
          const roundedLastYear = Math.round(hours.lastYear * 100) / 100
          // Only include if has billable hours in current or last year
          if (roundedCurrentYear > 0 || roundedLastYear > 0) {
            eligibleStaffForAllStaff!.add(staffName)
          }
        })
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
        if (eligibleStaffForAllStaff) {
          selectedStaffNames = Array.from(eligibleStaffForAllStaff)
            .filter((staffName) => {
              const settings = staffSettingsMap.get(staffName)
              return settings && !settings.is_hidden && settings.report !== false
            })
            .sort()
        } else {
          // Fallback: exclude hidden staff and staff with report = false
          selectedStaffNames = Array.from(staffSettingsMap.entries())
            .filter(([_, settings]) => !settings.is_hidden && settings.report !== false)
            .map(([staffName, _]) => staffName)
        }
      }

      // Create filtered settings map
      const settingsMap = new Map<string, any>()
      selectedStaffNames.forEach((staffName) => {
        const setting = staffSettingsMap.get(staffName)
        if (setting) {
          settingsMap.set(staffName, setting)
        }
      })

      const start = new Date(startDate)
      const end = new Date(endDate)
      let totalStandardHours = 0

      // Group by month and calculate
      const current = new Date(start)
      while (current <= end) {
        const year = current.getFullYear()
        const month = current.getMonth()
        const monthStart = new Date(year, month, 1)
        const monthEnd = new Date(year, month + 1, 0)
        
        const rangeStart = current > monthStart ? current : monthStart
        const rangeEnd = end < monthEnd ? end : monthEnd
        
        const weekdays = getWeekdaysInDateRange(rangeStart, rangeEnd)
        
        settingsMap.forEach((setting) => {
          const effectiveStart = setting.start_date ? new Date(setting.start_date) : null
          const effectiveEnd = setting.end_date ? new Date(setting.end_date) : null
          
          // Check if staff was active during this month
          if (effectiveEnd && effectiveEnd < rangeStart) return
          if (effectiveStart && effectiveStart > rangeEnd) return
          
          // Calculate effective date range for this staff member in this month
          const staffStart = effectiveStart && effectiveStart > rangeStart ? effectiveStart : rangeStart
          const staffEnd = effectiveEnd && effectiveEnd < rangeEnd ? effectiveEnd : rangeEnd
          
          const staffWeekdays = getWeekdaysInDateRange(staffStart, staffEnd)
          const dailyHours = (Number(setting.default_daily_hours) || 8) * (Number(setting.fte) || 1.0)
          totalStandardHours += staffWeekdays * dailyHours
        })
        
        current.setMonth(month + 1)
        current.setDate(1)
      }

      return totalStandardHours
    }

    // Helper function to calculate capacity reducing hours for a date range
    async function calculateCapacityReducingHours(startDate: string, endDate: string): Promise<number> {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        let query = supabase
          .from('timesheet_uploads')
          .select('time, capacity_reducing')
          .eq('organization_id', organizationId)
          .eq('capacity_reducing', true)
          .gte('date', startDate)
          .lte('date', endDate)
        
        if (staffFilter) {
          query = query.eq('staff', staffFilter)
        }
        
        const { data: pageData, error: pageError } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch capacity reducing data: ${pageError.message}`)
        }
        
        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData)
          page++
          hasMore = pageData.length === pageSize
        } else {
          hasMore = false
        }
      }
      
      let totalHours = 0
      allData.forEach((record) => {
        totalHours += convertTimeToHours(record.time)
      })
      
      return totalHours
    }

    // Fetch all data in parallel
    const [
      currentYearBillable,
      lastYearBillable,
      currentYearStandardHours,
      lastYearStandardHours,
      currentYearCapacityReducing,
      lastYearCapacityReducing,
    ] = await Promise.all([
      fetchBillableData(currentYearStart, currentYearEnd),
      fetchBillableData(lastYearStart, lastYearEnd),
      calculateStandardHours(currentYearStart, currentYearEnd),
      calculateStandardHours(lastYearStart, lastYearEnd),
      calculateCapacityReducingHours(currentYearStart, currentYearEnd),
      calculateCapacityReducingHours(lastYearStart, lastYearEnd),
    ])

    // Calculate total hours (standard - capacity reducing)
    const currentYearTotalHours = Math.max(0, currentYearStandardHours - currentYearCapacityReducing)
    const lastYearTotalHours = Math.max(0, lastYearStandardHours - lastYearCapacityReducing)

    // Calculate percentages
    const ytdBillablePercentage = currentYearTotalHours > 0
      ? (currentYearBillable.hours / currentYearTotalHours) * 100
      : 0
    const lastYearBillablePercentage = lastYearTotalHours > 0
      ? (lastYearBillable.hours / lastYearTotalHours) * 100
      : 0

    // Calculate average rates
    const ytdAverageRate = currentYearBillable.hours > 0
      ? currentYearBillable.amount / currentYearBillable.hours
      : 0
    const lastYearAverageRate = lastYearBillable.hours > 0
      ? lastYearBillable.amount / lastYearBillable.hours
      : 0

    // Calculate target billable percentage (weighted average from staff_settings)
    let targetBillablePercentage = 0
    let totalWeight = 0
    
    // Get staff settings
    let allSettings: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    while (hasMore) {
      let query = supabase
        .from('staff_settings')
        .select('staff_name, target_billable_percentage, is_hidden, report')
        .eq('organization_id', organizationId)
      
      if (staffFilter) {
        query = query.eq('staff_name', staffFilter)
      }
      
      const { data: pageData, error: pageError } = await query
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (pageError) {
        throw new Error(`Failed to fetch target billable: ${pageError.message}`)
      }
      
      if (pageData && pageData.length > 0) {
        allSettings = allSettings.concat(pageData)
        page++
        hasMore = pageData.length === pageSize
      } else {
        hasMore = false
      }
    }

    // Filter to only include staff with report = true and not hidden
    const validSettings = allSettings.filter(
      (setting) => !setting.is_hidden && setting.report !== false && setting.target_billable_percentage !== null
    )

    if (validSettings.length > 0) {
      validSettings.forEach((setting) => {
        const target = Number(setting.target_billable_percentage)
        if (!isNaN(target) && target >= 0 && target <= 100) {
          // Use standard hours as weight (simplified - use 1 for equal weight)
          const weight = 1
          targetBillablePercentage += target * weight
          totalWeight += weight
        }
      })
      
      if (totalWeight > 0) {
        targetBillablePercentage = targetBillablePercentage / totalWeight
      }
    }

    return NextResponse.json({
      ytdBillablePercentage: Math.round(ytdBillablePercentage * 10) / 10,
      lastYearBillablePercentage: Math.round(lastYearBillablePercentage * 10) / 10,
      targetBillablePercentage: Math.round(targetBillablePercentage * 10) / 10,
      ytdAverageRate: Math.round(ytdAverageRate * 100) / 100,
      lastYearAverageRate: Math.round(lastYearAverageRate * 100) / 100,
    }, {
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
