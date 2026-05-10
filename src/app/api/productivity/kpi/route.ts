import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateLocal } from '@/lib/utils'
import { CACHE_CONTROL_READONLY_JSON } from '@/lib/http-cache'
import { unstable_cache } from 'next/cache'
import { organizationAnalyticsCacheTag } from '@/lib/org-analytics-cache'

function convertTimeToHours(timeValue: number | string | null): number {
  if (timeValue === null || timeValue === undefined) return 0
  const numValue = typeof timeValue === 'string' ? parseFloat(timeValue) : timeValue
  if (isNaN(numValue) || numValue <= 0) return 0
  const roundedValue = Math.round(numValue)
  if (roundedValue < 100) return roundedValue / 60
  const hours = Math.floor(roundedValue / 100)
  const minutes = roundedValue % 100
  return hours + minutes / 60
}

function getWeekdaysInDateRange(startDate: Date, endDate: Date): number {
  let weekdays = 0
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  while (current <= end) {
    const day = current.getDay()
    if (day >= 1 && day <= 5) weekdays++
    current.setDate(current.getDate() + 1)
  }
  return weekdays
}

async function computeProductivityKpi(
  organizationId: string,
  currentFYStartYear: number,
  currentFYEndYear: number,
  lastFYStartYear: number,
  currentYearStart: string,
  currentYearEnd: string,
  lastYearStart: string,
  lastYearEnd: string,
  filtersKey: string,
  staffFilterKey: string
) {
  const supabase = await createClient()

  type Filter = { type: string; value: string; operator?: string }
  const filters: Filter[] = filtersKey ? JSON.parse(filtersKey) : []
  const staffFilter = staffFilterKey || null

  // Fetch staff settings once — used for standard hours, eligibility, and targets
  const fetchAllStaffSettings = async () => {
    let allSettings: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('staff_settings')
        .select('staff_name, default_daily_hours, fte, start_date, end_date, is_hidden, report, target_billable_percentage')
        .eq('organization_id', organizationId)
        .range(page * pageSize, (page + 1) * pageSize - 1)
      if (pageError) throw new Error(`Failed to fetch staff settings: ${pageError.message}`)
      if (pageData && pageData.length > 0) {
        allSettings = allSettings.concat(pageData)
        page++
        hasMore = pageData.length === pageSize
      } else {
        hasMore = false
      }
    }
    return allSettings
  }

  const fetchBillableData = async (startDate: string, endDate: string) => {
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      let query = supabase
        .from('timesheet_uploads')
        .select('time, billable_amount, client_group, account_manager, job_manager, job_name, staff')
        .eq('organization_id', organizationId)
        .eq('billable', true)
        .gte('date', startDate)
        .lte('date', endDate)

      let staffFilterValue = staffFilter
      filters.forEach((filter) => {
        if (filter.type === 'staff' && filter.value && filter.value !== 'all') {
          staffFilterValue = filter.value
        }
      })
      if (staffFilterValue) {
        query = query.ilike('staff', staffFilterValue.trim())
      }

      filters.forEach((filter) => {
        if (filter.value && filter.value !== 'all' && filter.type !== 'staff') {
          switch (filter.type) {
            case 'client_group': query = query.eq('client_group', filter.value); break
            case 'account_manager': query = query.eq('account_manager', filter.value); break
            case 'job_manager': query = query.eq('job_manager', filter.value); break
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

      const { data: pageData, error: pageError } = await query.range(page * pageSize, (page + 1) * pageSize - 1)
      if (pageError) throw new Error(`Failed to fetch billable data: ${pageError.message}`)

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

  const fetchFullYearBillableStaff = async (startDate: string, endDate: string) => {
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
      if (pageError) throw new Error(`Failed to fetch billable data: ${pageError.message}`)
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

  const fetchCapacityReducingHours = async (startDate: string, endDate: string) => {
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
        query = query.ilike('staff', staffFilter.trim())
      }
      const { data: pageData, error: pageError } = await query.range(page * pageSize, (page + 1) * pageSize - 1)
      if (pageError) throw new Error(`Failed to fetch capacity reducing data: ${pageError.message}`)
      if (pageData && pageData.length > 0) {
        allData = allData.concat(pageData)
        page++
        hasMore = pageData.length === pageSize
      } else {
        hasMore = false
      }
    }
    let totalHours = 0
    allData.forEach((record) => { totalHours += convertTimeToHours(record.time) })
    return totalHours
  }

  // Fetch staff settings once + all data in parallel
  const fullCurrentYearStart = `${currentFYStartYear}-07-01`
  const fullCurrentYearEnd = `${currentFYEndYear}-06-30`
  const fullLastYearStart = `${lastFYStartYear}-07-01`
  const fullLastYearEnd = `${currentFYStartYear}-06-30`

  const [
    allStaffSettings,
    currentYearBillable,
    lastYearBillable,
    currentYearCapacityReducing,
    lastYearCapacityReducing,
    fullCurrentYearData,
    fullLastYearData,
  ] = await Promise.all([
    fetchAllStaffSettings(),
    fetchBillableData(currentYearStart, currentYearEnd),
    fetchBillableData(lastYearStart, lastYearEnd),
    fetchCapacityReducingHours(currentYearStart, currentYearEnd),
    fetchCapacityReducingHours(lastYearStart, lastYearEnd),
    staffFilter ? Promise.resolve<any[]>([]) : fetchFullYearBillableStaff(fullCurrentYearStart, fullCurrentYearEnd),
    staffFilter ? Promise.resolve<any[]>([]) : fetchFullYearBillableStaff(fullLastYearStart, fullLastYearEnd),
  ])

  // Build settings maps
  const staffSettingsMap = new Map<string, any>()
  allStaffSettings.forEach((s) => { if (s.staff_name) staffSettingsMap.set(s.staff_name, s) })

  const excludedStaffSet = new Set<string>()
  allStaffSettings.forEach((s) => {
    if (s.staff_name && (s.is_hidden || s.report === false)) excludedStaffSet.add(s.staff_name)
  })

  // Determine eligible staff (same logic as before, but reusing already-fetched data)
  let selectedStaffNames: string[] = []
  if (staffFilter) {
    const settings = staffSettingsMap.get(staffFilter)
    if (settings && !settings.is_hidden && settings.report !== false) {
      selectedStaffNames = [staffFilter]
    }
  } else {
    const staffBillableHours = new Map<string, { currentYear: number; lastYear: number }>()
    const addHours = (data: any[], key: 'currentYear' | 'lastYear') => {
      data.forEach((record) => {
        if (!record.staff) return
        const name = record.staff.trim()
        if (!name || name.toLowerCase() === 'disbursement') return
        const entry = staffBillableHours.get(name) ?? { currentYear: 0, lastYear: 0 }
        entry[key] += convertTimeToHours(record.time)
        staffBillableHours.set(name, entry)
      })
    }
    addHours(fullCurrentYearData, 'currentYear')
    addHours(fullLastYearData, 'lastYear')

    selectedStaffNames = Array.from(staffBillableHours.entries())
      .filter(([name, hours]) => {
        if (excludedStaffSet.has(name)) return false
        const rounded = { cy: Math.round(hours.currentYear * 100) / 100, ly: Math.round(hours.lastYear * 100) / 100 }
        return rounded.cy > 0 || rounded.ly > 0
      })
      .filter(([name]) => {
        const s = staffSettingsMap.get(name)
        return s && !s.is_hidden && s.report !== false
      })
      .map(([name]) => name)
      .sort()
  }

  // Build filtered settings map for standard hours calculation
  const settingsMap = new Map<string, any>()
  selectedStaffNames.forEach((name) => {
    const s = staffSettingsMap.get(name)
    if (s) settingsMap.set(name, s)
  })

  const calculateStandardHours = (startDate: string, endDate: string): number => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    let totalStandardHours = 0
    const current = new Date(start)

    while (current <= end) {
      const year = current.getFullYear()
      const month = current.getMonth()
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 0)
      const rangeStart = current > monthStart ? current : monthStart
      const rangeEnd = end < monthEnd ? end : monthEnd

      settingsMap.forEach((setting) => {
        const effectiveStart = setting.start_date ? new Date(setting.start_date) : null
        const effectiveEnd = setting.end_date ? new Date(setting.end_date) : null
        if (effectiveEnd && effectiveEnd < rangeStart) return
        if (effectiveStart && effectiveStart > rangeEnd) return
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

  const currentYearStandardHours = calculateStandardHours(currentYearStart, currentYearEnd)
  const lastYearStandardHours = calculateStandardHours(lastYearStart, lastYearEnd)

  const currentYearTotalHours = Math.max(0, currentYearStandardHours - currentYearCapacityReducing)
  const lastYearTotalHours = Math.max(0, lastYearStandardHours - lastYearCapacityReducing)

  const ytdBillablePercentage = currentYearTotalHours > 0
    ? (currentYearBillable.hours / currentYearTotalHours) * 100
    : 0
  const lastYearBillablePercentage = lastYearTotalHours > 0
    ? (lastYearBillable.hours / lastYearTotalHours) * 100
    : 0

  const ytdAverageRate = currentYearBillable.hours > 0 ? currentYearBillable.amount / currentYearBillable.hours : 0
  const lastYearAverageRate = lastYearBillable.hours > 0 ? lastYearBillable.amount / lastYearBillable.hours : 0

  // Target billable % — derived from already-fetched settings
  let targetBillablePercentage = 0
  let totalWeight = 0
  const validSettings = allStaffSettings.filter(
    (s) => !s.is_hidden && s.report !== false && s.target_billable_percentage !== null
  )
  validSettings.forEach((s) => {
    const target = Number(s.target_billable_percentage)
    if (!isNaN(target) && target >= 0 && target <= 100) {
      targetBillablePercentage += target
      totalWeight++
    }
  })
  if (totalWeight > 0) targetBillablePercentage = targetBillablePercentage / totalWeight

  return {
    ytdBillablePercentage: Math.round(ytdBillablePercentage * 10) / 10,
    lastYearBillablePercentage: Math.round(lastYearBillablePercentage * 10) / 10,
    targetBillablePercentage: Math.round(targetBillablePercentage * 10) / 10,
    ytdAverageRate: Math.round(ytdAverageRate * 100) / 100,
    lastYearAverageRate: Math.round(lastYearAverageRate * 100) / 100,
  }
}

type ProductivityKpiRunner = (a: number, b: number, c: number, d: string, e: string, f: string, g: string, h: string, i: string) => ReturnType<typeof computeProductivityKpi>
const productivityKpiRunners = new Map<string, ProductivityKpiRunner>()

function getProductivityKpiRunner(organizationId: string): ProductivityKpiRunner {
  let runner = productivityKpiRunners.get(organizationId)
  if (!runner) {
    runner = unstable_cache(
      (currentFYStartYear: number, currentFYEndYear: number, lastFYStartYear: number, currentYearStart: string, currentYearEnd: string, lastYearStart: string, lastYearEnd: string, filtersKey: string, staffFilter: string) =>
        computeProductivityKpi(organizationId, currentFYStartYear, currentFYEndYear, lastFYStartYear, currentYearStart, currentYearEnd, lastYearStart, lastYearEnd, filtersKey, staffFilter),
      ['productivity-kpi-v1', organizationId],
      { revalidate: 60, tags: [organizationAnalyticsCacheTag(organizationId)] }
    ) as ProductivityKpiRunner
    productivityKpiRunners.set(organizationId, runner)
  }
  return runner
}

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const staffFilter = searchParams.get('staff') ?? ''
    const asOfDateParam = searchParams.get('asOfDate')
    const filtersParam = searchParams.get('filters') ?? ''

    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date()
    const currentMonth = asOfDate.getMonth()
    const currentYear = asOfDate.getFullYear()

    const currentFYStartYear = currentMonth >= 6 ? currentYear : currentYear - 1
    const currentFYEndYear = currentFYStartYear + 1
    const lastFYStartYear = currentFYStartYear - 1
    const lastFYEndYear = currentFYStartYear

    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = formatDateLocal(asOfDate)

    const lastYearSameDate = new Date(asOfDate)
    lastYearSameDate.setFullYear(lastYearSameDate.getFullYear() - 1)
    const lastYearEndDate = formatDateLocal(lastYearSameDate)
    const lastYearFYEnd = `${lastFYEndYear}-06-30`
    const lastYearEnd = lastYearEndDate <= lastYearFYEnd ? lastYearEndDate : lastYearFYEnd
    const lastYearStart = `${lastFYStartYear}-07-01`

    // Normalize filters to a stable cache key (strip ephemeral id fields)
    let filtersKey = ''
    if (filtersParam) {
      try {
        const parsed = JSON.parse(filtersParam)
        if (Array.isArray(parsed)) {
          filtersKey = JSON.stringify(
            parsed
              .filter((f: any) => f.type && f.value)
              .map((f: any) => ({ type: f.type, value: f.value, operator: f.operator }))
          )
        }
      } catch {}
    }

    const runner = getProductivityKpiRunner(organizationId)
    const result = await runner(
      currentFYStartYear,
      currentFYEndYear,
      lastFYStartYear,
      currentYearStart,
      currentYearEnd,
      lastYearStart,
      lastYearEnd,
      filtersKey,
      staffFilter
    )

    return NextResponse.json(result, { headers: { 'Cache-Control': CACHE_CONTROL_READONLY_JSON } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
