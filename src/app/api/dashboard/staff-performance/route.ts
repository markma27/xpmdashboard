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
    
    // Extract staff filter if present
    const staffFilter = filters.find(f => f.type === 'staff' && f.value && f.value !== 'all')?.value

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
    // For "same time" comparison, use selected date for current year
    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = asOfDate.toISOString().split('T')[0] // Selected date
    
    // For last year "same time", calculate the same day last year
    // But ensure it doesn't exceed last year's financial year end (June 30)
    const lastYearSameDate = new Date(asOfDate)
    lastYearSameDate.setFullYear(lastYearSameDate.getFullYear() - 1)
    const lastYearEndDate = lastYearSameDate.toISOString().split('T')[0]
    const lastYearFYEnd = `${lastFYEndYear}-06-30`
    // Use the earlier of last year same date or last year FY end
    const lastYearEnd = lastYearEndDate <= lastYearFYEnd ? lastYearEndDate : lastYearFYEnd
    const lastYearStart = `${lastFYStartYear}-07-01`

    // No staff_settings filtering - include all staff

    // Fetch billable data by staff for current year and last year
    const fetchBillableDataByStaff = async (startDate: string, endDate: string) => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        let query = supabase
          .from('timesheet_uploads')
          .select('staff, time, billable_amount, client_group, account_manager, job_manager, job_name')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate)
        
        // Apply filters (same logic as Billable page, but exclude staff filter since we need to group by staff)
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
      
      // Group by staff
      // Note: This function calculates both billable amount and billable hours (all records, following Billable page filters)
      // This is consistent with billable $ criteria - no billable = true filter
      const staffMap = new Map<string, { amount: number, hours: number }>()
      
      allData.forEach((record) => {
        if (record.staff && record.staff.trim().toLowerCase() !== 'disbursement') {
          const staffName = record.staff.trim()
          if (!staffMap.has(staffName)) {
            staffMap.set(staffName, { amount: 0, hours: 0 })
          }
          const staff = staffMap.get(staffName)!
          // For billable amount, count all records (consistent with Billable page)
          const amount = typeof record.billable_amount === 'number' 
            ? record.billable_amount 
            : parseFloat(record.billable_amount || '0') || 0
          staff.amount += amount
          // For billable hours, count all records (consistent with billable $ criteria)
          const hours = convertTimeToHours(record.time)
          staff.hours += hours
        }
      })
      
      return staffMap
    }

    // Fetch billable hours by staff (only billable = true, for billable % calculation)
    // This should match productivity page calculation
    const fetchBillableHoursByStaff = async (startDate: string, endDate: string) => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        let query = supabase
          .from('timesheet_uploads')
          .select('staff, time, client_group, account_manager, job_manager, job_name')
          .eq('organization_id', organizationId)
          .eq('billable', true) // Only count billable = true for hours (consistent with productivity page)
          .gte('date', startDate)
          .lte('date', endDate)
        
        // Apply filters (same logic as Billable page, but exclude staff filter since we need to group by staff)
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
          throw new Error(`Failed to fetch billable hours data: ${pageError.message}`)
        }
        
        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData)
          page++
          hasMore = pageData.length === pageSize
        } else {
          hasMore = false
        }
      }
      
      // Group by staff
      const staffMap = new Map<string, number>()
      
      allData.forEach((record) => {
        if (record.staff && record.staff.trim().toLowerCase() !== 'disbursement') {
          const staffName = record.staff.trim()
          const hours = convertTimeToHours(record.time)
          staffMap.set(staffName, (staffMap.get(staffName) || 0) + hours)
        }
      })
      
      return staffMap
    }

    // Calculate standard hours by staff based on staff_settings (same as Productivity API)
    // Only calculate for staff that appear in filtered billable data
    const calculateStandardHoursByStaff = async (startDate: string, endDate: string, filteredStaffSet: Set<string>) => {
      // Get staff settings
      let allSettings: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('staff_settings')
          .select('staff_name, default_daily_hours, fte, start_date, end_date, is_hidden, report')
          .eq('organization_id', organizationId)
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

      // Create settings map - filter out hidden staff and staff with report = false
      // AND only include staff that appear in filtered billable data (same as Productivity API logic)
      const settingsMap = new Map<string, any>()
      allSettings.forEach((setting) => {
        if (setting.staff_name && !setting.is_hidden && setting.report !== false) {
          const staffName = setting.staff_name.trim()
          // Only include staff that appear in filtered data (when filters are applied)
          // If no filters or staffFilter is applied, include all eligible staff
          if (filteredStaffSet.size === 0 || filteredStaffSet.has(staffName)) {
            settingsMap.set(staffName, setting)
          }
        }
      })

      // Fetch capacity reducing hours by staff
      let capacityReducingData: any[] = []
      page = 0
      hasMore = true
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('timesheet_uploads')
          .select('staff, time, capacity_reducing')
          .eq('organization_id', organizationId)
          .eq('capacity_reducing', true)
          .gte('date', startDate)
          .lte('date', endDate)
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch capacity reducing data: ${pageError.message}`)
        }
        
        if (pageData && pageData.length > 0) {
          capacityReducingData = capacityReducingData.concat(pageData)
          page++
          hasMore = pageData.length === pageSize
        } else {
          hasMore = false
        }
      }

      // Group capacity reducing hours by staff
      const capacityReducingMap = new Map<string, number>()
      capacityReducingData.forEach((record) => {
        if (record.staff && record.staff.trim().toLowerCase() !== 'disbursement') {
          const staffName = record.staff.trim()
          const hours = convertTimeToHours(record.time)
          capacityReducingMap.set(staffName, (capacityReducingMap.get(staffName) || 0) + hours)
        }
      })

      const start = new Date(startDate)
      const end = new Date(endDate)
      const staffMap = new Map<string, { standardHours: number, capacityReducing: number }>()

      // Initialize map for all staff in settings
      settingsMap.forEach((_, staffName) => {
        staffMap.set(staffName, { standardHours: 0, capacityReducing: 0 })
      })

      // Group by month and calculate standard hours (same logic as Productivity API)
      const current = new Date(start)
      while (current <= end) {
        const year = current.getFullYear()
        const month = current.getMonth()
        const monthStart = new Date(year, month, 1)
        const monthEnd = new Date(year, month + 1, 0)
        
        const rangeStart = current > monthStart ? current : monthStart
        const rangeEnd = end < monthEnd ? end : monthEnd
        
        const weekdays = getWeekdaysInDateRange(rangeStart, rangeEnd)
        
        settingsMap.forEach((setting, staffName) => {
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
          const staff = staffMap.get(staffName)!
          staff.standardHours += staffWeekdays * dailyHours
        })
        
        current.setMonth(month + 1)
        current.setDate(1)
      }

      // Add capacity reducing hours
      capacityReducingMap.forEach((hours, staffName) => {
        if (staffMap.has(staffName)) {
          const staff = staffMap.get(staffName)!
          staff.capacityReducing += hours
        }
      })
      
      return staffMap
    }

    // Fetch recoverability data by staff
    const fetchRecoverabilityDataByStaff = async (startDate: string, endDate: string) => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('recoverability_timesheet_uploads')
          .select('staff, write_on_amount, invoiced_amount')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate)
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch recoverability data: ${pageError.message}`)
        }
        
        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData)
          page++
          hasMore = pageData.length === pageSize
        } else {
          hasMore = false
        }
      }
      
      // Group by staff
      const staffMap = new Map<string, { writeOnAmount: number, invoicedAmount: number }>()
      
      allData.forEach((record) => {
        if (record.staff && record.staff.trim().toLowerCase() !== 'disbursement') {
          const staffName = record.staff.trim()
          if (!staffMap.has(staffName)) {
            staffMap.set(staffName, { writeOnAmount: 0, invoicedAmount: 0 })
          }
          const staff = staffMap.get(staffName)!
          staff.writeOnAmount += Number(record.write_on_amount || 0)
          staff.invoicedAmount += Number(record.invoiced_amount || 0)
        }
      })
      
      return staffMap
    }

    // Fetch staff settings with target_billable_percentage
    const fetchStaffTargets = async () => {
      let allSettings: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('staff_settings')
          .select('staff_name, target_billable_percentage')
          .eq('organization_id', organizationId)
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch staff targets: ${pageError.message}`)
        }
        
        if (pageData && pageData.length > 0) {
          allSettings = allSettings.concat(pageData)
          page++
          hasMore = pageData.length === pageSize
        } else {
          hasMore = false
        }
      }

      const targetsMap = new Map<string, number | null>()
      allSettings.forEach((setting) => {
        if (setting.staff_name) {
          const target = setting.target_billable_percentage !== null && setting.target_billable_percentage !== undefined
            ? Number(setting.target_billable_percentage)
            : null
          targetsMap.set(setting.staff_name.trim(), target)
        }
      })
      
      return targetsMap
    }

    // First, fetch billable data to determine which staff appear in filtered data
    const currentYearBillableData = await fetchBillableDataByStaff(currentYearStart, currentYearEnd)
    const currentYearBillableHoursData = await fetchBillableHoursByStaff(currentYearStart, currentYearEnd)
    
    // Create set of staff that should be included in standard hours calculation
    // This must match the KPI API logic: include staff with billable hours in current OR last FULL financial year
    const filteredStaffSet = new Set<string>()
    
    if (!staffFilter) {
      // Fetch billable hours for FULL current and last financial year (same as KPI API)
      // to determine which staff should be included in standard hours calculation
      const fullCurrentYearStart = `${currentFYStartYear}-07-01`
      const fullCurrentYearEnd = `${currentFYEndYear}-06-30`
      const fullLastYearStart = `${lastFYStartYear}-07-01`
      const fullLastYearEnd = `${lastFYEndYear}-06-30`
      
      // Helper function to fetch billable hours data (billable=true only) for staff eligibility
      const fetchBillableHoursForEligibility = async (startDate: string, endDate: string): Promise<Map<string, number>> => {
        let allData: any[] = []
        let page = 0
        const pageSize = 1000
        let hasMore = true
        
        while (hasMore) {
          const { data: pageData, error: pageError } = await supabase
            .from('timesheet_uploads')
            .select('staff, time')
            .eq('organization_id', organizationId)
            .eq('billable', true) // Only billable=true records (same as KPI)
            .gte('date', startDate)
            .lte('date', endDate)
            .range(page * pageSize, (page + 1) * pageSize - 1)
          
          if (pageError) {
            throw new Error(`Failed to fetch billable data for eligibility: ${pageError.message}`)
          }
          
          if (pageData && pageData.length > 0) {
            allData = allData.concat(pageData)
            page++
            hasMore = pageData.length === pageSize
          } else {
            hasMore = false
          }
        }
        
        // Group by staff
        const staffMap = new Map<string, number>()
        allData.forEach((record) => {
          if (record.staff && record.staff.trim().toLowerCase() !== 'disbursement') {
            const staffName = record.staff.trim()
            const hours = convertTimeToHours(record.time)
            staffMap.set(staffName, (staffMap.get(staffName) || 0) + hours)
          }
        })
        
        return staffMap
      }
      
      // Fetch billable hours for full current and last FY in parallel
      const [currentFYBillableHours, lastFYBillableHours] = await Promise.all([
        fetchBillableHoursForEligibility(fullCurrentYearStart, fullCurrentYearEnd),
        fetchBillableHoursForEligibility(fullLastYearStart, fullLastYearEnd),
      ])
      
      // Get all staff settings to check for hidden/report status
      let allStaffSettings: any[] = []
      let settingsPage = 0
      let settingsHasMore = true
      
      while (settingsHasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('staff_settings')
          .select('staff_name, is_hidden, report')
          .eq('organization_id', organizationId)
          .range(settingsPage * 1000, (settingsPage + 1) * 1000 - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch staff settings for eligibility: ${pageError.message}`)
        }
        
        if (pageData && pageData.length > 0) {
          allStaffSettings = allStaffSettings.concat(pageData)
          settingsPage++
          settingsHasMore = pageData.length === 1000
        } else {
          settingsHasMore = false
        }
      }
      
      // Create excluded staff set (hidden or report = false)
      const excludedStaffSet = new Set<string>()
      allStaffSettings.forEach((setting) => {
        if (setting.staff_name && (setting.is_hidden || setting.report === false)) {
          excludedStaffSet.add(setting.staff_name)
        }
      })
      
      // Include staff with billable hours in current OR last full FY (same as KPI)
      // Exclude hidden staff and staff with report = false
      const allStaffWithBillableHours = new Set<string>()
      currentFYBillableHours.forEach((hours, staffName) => {
        if (hours > 0) allStaffWithBillableHours.add(staffName)
      })
      lastFYBillableHours.forEach((hours, staffName) => {
        if (hours > 0) allStaffWithBillableHours.add(staffName)
      })
      
      allStaffWithBillableHours.forEach((staffName) => {
        if (!excludedStaffSet.has(staffName)) {
          filteredStaffSet.add(staffName)
        }
      })
    }
    
    // If staffFilter is applied, only include that staff
    if (staffFilter) {
      filteredStaffSet.clear()
      filteredStaffSet.add(staffFilter)
    }

    // Fetch remaining data in parallel
    const [
      currentYearStandardHoursData,
      currentYearRecoverabilityData,
      staffTargetsMap,
    ] = await Promise.all([
      calculateStandardHoursByStaff(currentYearStart, currentYearEnd, filteredStaffSet),
      fetchRecoverabilityDataByStaff(currentYearStart, currentYearEnd),
      fetchStaffTargets(),
    ])

    // Combine data and calculate metrics
    const staffPerformanceData: Array<{
      staff: string
      currentYear: {
        billableAmount: number
        billablePercentage: number
        targetBillablePercentage: number | null
        billableVariance: number | null
        recoverabilityAmount: number
        recoverabilityPercentage: number
        targetRecoverabilityPercentage: number
        recoverabilityVariance: number
        billableHours: number
        averageHourlyRate: number
      }
    }> = []

    // Get all unique staff names from current year data
    const allStaffNames = new Set<string>()
    currentYearBillableData.forEach((_, staff) => allStaffNames.add(staff))
    currentYearStandardHoursData.forEach((_, staff) => allStaffNames.add(staff))
    currentYearRecoverabilityData.forEach((_, staff) => allStaffNames.add(staff))

    allStaffNames.forEach((staffName) => {
      // Apply staff filter if present (from Billable page filters)
      if (staffFilter && staffName !== staffFilter) {
        return // Skip staff that doesn't match the filter
      }

      const currentYearBillable = currentYearBillableData.get(staffName) || { amount: 0, hours: 0 }
      
      // Only include staff with billable amount > 0
      if (currentYearBillable.amount <= 0) {
        return
      }

      // Get billable hours (only billable = true records)
      const currentYearBillableHours = currentYearBillableHoursData.get(staffName) || 0

      const currentYearStandard = currentYearStandardHoursData.get(staffName) || { standardHours: 0, capacityReducing: 0 }
      const currentYearRecoverability = currentYearRecoverabilityData.get(staffName) || { writeOnAmount: 0, invoicedAmount: 0 }

      // Calculate billable percentage (consistent with productivity page)
      // Use billable hours from billable = true records only
      const currentYearTotalHours = Math.max(0, currentYearStandard.standardHours - currentYearStandard.capacityReducing)
      
      const currentYearBillablePercentage = currentYearTotalHours > 0
        ? (currentYearBillableHours / currentYearTotalHours) * 100
        : 0

      // Calculate average hourly rate (use billable hours from billable = true records)
      const currentYearAverageRate = currentYearBillableHours > 0
        ? currentYearBillable.amount / currentYearBillableHours
        : 0

      // Calculate recoverability percentage
      const currentYearDenominator = currentYearRecoverability.invoicedAmount - currentYearRecoverability.writeOnAmount
      const currentYearRecoverabilityPercentage = currentYearDenominator > 0
        ? (1 + (currentYearRecoverability.writeOnAmount / currentYearDenominator)) * 100
        : 0

      // Get target billable percentage from staff_settings (default to null if not set)
      const targetBillablePercentage = staffTargetsMap.get(staffName) ?? null
      
      // Calculate billable variance (actual - target)
      const billableVariance = targetBillablePercentage !== null
        ? currentYearBillablePercentage - targetBillablePercentage
        : null

      // Target recoverability percentage (default to 95%)
      const targetRecoverabilityPercentage = 95
      
      // Calculate recoverability variance (actual - target)
      const recoverabilityVariance = currentYearRecoverabilityPercentage - targetRecoverabilityPercentage

      staffPerformanceData.push({
        staff: staffName,
        currentYear: {
          billableAmount: Math.round(currentYearBillable.amount * 100) / 100,
          billablePercentage: Math.round(currentYearBillablePercentage * 10) / 10,
          targetBillablePercentage: targetBillablePercentage !== null ? Math.round(targetBillablePercentage * 10) / 10 : null,
          billableVariance: billableVariance !== null ? Math.round(billableVariance * 10) / 10 : null,
          recoverabilityAmount: Math.round(currentYearRecoverability.writeOnAmount * 100) / 100,
          recoverabilityPercentage: Math.round(currentYearRecoverabilityPercentage * 10) / 10,
          targetRecoverabilityPercentage: targetRecoverabilityPercentage,
          recoverabilityVariance: Math.round(recoverabilityVariance * 10) / 10,
          billableHours: Math.round(currentYearBillableHours * 10) / 10,
          averageHourlyRate: Math.round(currentYearAverageRate * 100) / 100,
        },
      })
    })

    // Sort by staff name
    staffPerformanceData.sort((a, b) => a.staff.localeCompare(b.staff))

    // Calculate totals
    const totals = {
      currentYear: {
        billableAmount: staffPerformanceData.reduce((sum, item) => sum + item.currentYear.billableAmount, 0),
        billablePercentage: 0, // Will be calculated as weighted average
        targetBillablePercentage: null as number | null, // Not applicable for totals
        billableVariance: null as number | null, // Not applicable for totals
        recoverabilityAmount: staffPerformanceData.reduce((sum, item) => sum + item.currentYear.recoverabilityAmount, 0),
        recoverabilityPercentage: 0, // Will be calculated as weighted average
        targetRecoverabilityPercentage: 95, // Default 95% for totals
        recoverabilityVariance: 0, // Will be calculated
        billableHours: 0, // Will be calculated from billable = true records only
        averageHourlyRate: 0, // Will be calculated from total amount / total hours
      },
    }

    // Calculate totals for percentages and rates
    // Sum up ALL staff data from the filtered set (not just staffPerformanceData)
    // This ensures the totals match the KPI card calculation
    let currentYearTotalBillableHours = 0
    let currentYearTotalStandardHours = 0
    let currentYearTotalCapacityReducing = 0
    let currentYearTotalBillableAmount = 0
    let currentYearTotalInvoicedAmount = 0
    let currentYearTotalWriteOnAmount = 0

    // Iterate over all staff in standard hours data (which includes all eligible staff)
    // This matches the KPI calculation logic
    currentYearStandardHoursData.forEach((standardData, staffName) => {
      const currentYearBillable = currentYearBillableData.get(staffName) || { amount: 0, hours: 0 }
      const currentYearBillableHours = currentYearBillableHoursData.get(staffName) || 0
      const currentYearRecoverability = currentYearRecoverabilityData.get(staffName) || { writeOnAmount: 0, invoicedAmount: 0 }

      currentYearTotalBillableHours += currentYearBillableHours // Use billable hours from billable = true records only
      currentYearTotalStandardHours += standardData.standardHours
      currentYearTotalCapacityReducing += standardData.capacityReducing
      currentYearTotalBillableAmount += currentYearBillable.amount
      currentYearTotalInvoicedAmount += currentYearRecoverability.invoicedAmount
      currentYearTotalWriteOnAmount += currentYearRecoverability.writeOnAmount
    })

    // Calculate overall percentages and rates
    const currentYearTotalHours = Math.max(0, currentYearTotalStandardHours - currentYearTotalCapacityReducing)
    totals.currentYear.billablePercentage = currentYearTotalHours > 0
      ? (currentYearTotalBillableHours / currentYearTotalHours) * 100
      : 0

    totals.currentYear.averageHourlyRate = currentYearTotalBillableHours > 0
      ? currentYearTotalBillableAmount / currentYearTotalBillableHours
      : 0

    // Calculate total billable hours (only billable = true records)
    totals.currentYear.billableHours = currentYearTotalBillableHours

    const currentYearRecoverabilityDenominator = currentYearTotalInvoicedAmount - currentYearTotalWriteOnAmount
    totals.currentYear.recoverabilityPercentage = currentYearRecoverabilityDenominator > 0
      ? (1 + (currentYearTotalWriteOnAmount / currentYearRecoverabilityDenominator)) * 100
      : 0

    // Calculate recoverability variance for totals
    totals.currentYear.recoverabilityVariance = totals.currentYear.recoverabilityPercentage - totals.currentYear.targetRecoverabilityPercentage

    // Round totals
    totals.currentYear.billableAmount = Math.round(totals.currentYear.billableAmount * 100) / 100
    totals.currentYear.billablePercentage = Math.round(totals.currentYear.billablePercentage * 10) / 10
    totals.currentYear.recoverabilityAmount = Math.round(totals.currentYear.recoverabilityAmount * 100) / 100
    totals.currentYear.recoverabilityPercentage = Math.round(totals.currentYear.recoverabilityPercentage * 10) / 10
    totals.currentYear.recoverabilityVariance = Math.round(totals.currentYear.recoverabilityVariance * 10) / 10
    totals.currentYear.billableHours = Math.round(totals.currentYear.billableHours * 10) / 10
    totals.currentYear.averageHourlyRate = Math.round(totals.currentYear.averageHourlyRate * 100) / 100

    return NextResponse.json({
      data: staffPerformanceData,
      totals: totals,
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
