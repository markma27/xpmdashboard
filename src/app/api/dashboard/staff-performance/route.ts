import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateLocal } from '@/lib/utils'
import { CACHE_CONTROL_READONLY_JSON } from '@/lib/http-cache'

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

type StaffFilter = { type: string; value: string; operator?: string }

async function computeStaffPerformance(
  organizationId: string,
  currentFYStartYear: number,
  currentFYEndYear: number,
  lastFYStartYear: number,
  currentYearStart: string,
  currentYearEnd: string,
  filtersKey: string
) {
  const supabase = await createClient()
  const filters: StaffFilter[] = filtersKey ? JSON.parse(filtersKey) : []
  const staffFilter = filters.find((f) => f.type === 'staff' && f.value && f.value !== 'all')?.value ?? null

  const applyFilters = (query: any, excludeStaff = false) => {
    filters.forEach((filter) => {
      if (!filter.value || filter.value === 'all') return
      if (excludeStaff && filter.type === 'staff') return
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
    })
    return query
  }

  const paginateAll = async <T>(buildQuery: (range: [number, number]) => any): Promise<T[]> => {
    let allData: T[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    while (hasMore) {
      const { data: pageData, error } = await buildQuery([page * pageSize, (page + 1) * pageSize - 1])
      if (error) throw new Error(error.message)
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

  const fetchBillableData = () =>
    paginateAll<any>(([from, to]) => {
      let q = supabase
        .from('timesheet_uploads')
        .select('staff, time, billable_amount, client_group, account_manager, job_manager, job_name')
        .eq('organization_id', organizationId)
        .gte('date', currentYearStart)
        .lte('date', currentYearEnd)
      q = applyFilters(q, true) // exclude staff filter — we group by staff
      return q.range(from, to)
    })

  const fetchBillableHoursOnly = () =>
    paginateAll<any>(([from, to]) => {
      let q = supabase
        .from('timesheet_uploads')
        .select('staff, time, client_group, account_manager, job_manager, job_name')
        .eq('organization_id', organizationId)
        .eq('billable', true)
        .gte('date', currentYearStart)
        .lte('date', currentYearEnd)
      q = applyFilters(q, true)
      return q.range(from, to)
    })

  const fetchFullYearBillableStaff = (startDate: string, endDate: string) =>
    paginateAll<any>(([from, to]) =>
      supabase
        .from('timesheet_uploads')
        .select('staff, time')
        .eq('organization_id', organizationId)
        .eq('billable', true)
        .gte('date', startDate)
        .lte('date', endDate)
        .range(from, to)
    )

  const fetchCapacityReducing = () =>
    paginateAll<any>(([from, to]) =>
      supabase
        .from('timesheet_uploads')
        .select('staff, time, capacity_reducing')
        .eq('organization_id', organizationId)
        .eq('capacity_reducing', true)
        .gte('date', currentYearStart)
        .lte('date', currentYearEnd)
        .range(from, to)
    )

  const fetchRecoverabilityData = () =>
    paginateAll<any>(([from, to]) =>
      supabase
        .from('recoverability_timesheet_uploads')
        .select('staff, write_on_amount, invoiced_amount')
        .eq('organization_id', organizationId)
        .gte('date', currentYearStart)
        .lte('date', currentYearEnd)
        .range(from, to)
    )

  const fetchAllStaffSettings = () =>
    paginateAll<any>(([from, to]) =>
      supabase
        .from('staff_settings')
        .select('staff_name, default_daily_hours, fte, start_date, end_date, is_hidden, report, target_billable_percentage')
        .eq('organization_id', organizationId)
        .range(from, to)
    )

  const fullCurrentYearEnd = `${currentFYEndYear}-06-30`
  const fullLastYearStart = `${lastFYStartYear}-07-01`
  const fullLastYearEnd = `${currentFYStartYear}-06-30`

  // Batch 1: all independent fetches in parallel
  const [
    allStaffSettings,
    billableRaw,
    billableHoursRaw,
    capacityReducingRaw,
    recoverabilityRaw,
    fullCurrentYearRaw,
    fullLastYearRaw,
  ] = await Promise.all([
    fetchAllStaffSettings(),
    fetchBillableData(),
    fetchBillableHoursOnly(),
    fetchCapacityReducing(),
    fetchRecoverabilityData(),
    staffFilter ? Promise.resolve<any[]>([]) : fetchFullYearBillableStaff(`${currentFYStartYear}-07-01`, fullCurrentYearEnd),
    staffFilter ? Promise.resolve<any[]>([]) : fetchFullYearBillableStaff(fullLastYearStart, fullLastYearEnd),
  ])

  // Build settings maps from single fetch
  const staffSettingsMap = new Map<string, any>()
  allStaffSettings.forEach((s) => { if (s.staff_name) staffSettingsMap.set(s.staff_name.trim(), s) })

  const excludedStaffSet = new Set<string>()
  allStaffSettings.forEach((s) => {
    if (s.staff_name && (s.is_hidden || s.report === false)) excludedStaffSet.add(s.staff_name.trim())
  })

  // Determine which staff to include in standard hours calculation
  const filteredStaffSet = new Set<string>()
  if (staffFilter) {
    filteredStaffSet.add(staffFilter)
  } else {
    const billableHoursMap = new Map<string, number>()
    const addHours = (raw: any[]) => {
      raw.forEach((r) => {
        if (!r.staff) return
        const name = r.staff.trim()
        if (!name || name.toLowerCase() === 'disbursement') return
        billableHoursMap.set(name, (billableHoursMap.get(name) ?? 0) + convertTimeToHours(r.time))
      })
    }
    addHours(fullCurrentYearRaw)
    addHours(fullLastYearRaw)

    billableHoursMap.forEach((hours, name) => {
      if (hours > 0 && !excludedStaffSet.has(name)) filteredStaffSet.add(name)
    })
  }

  // Standard hours calculation using pre-fetched settings (synchronous)
  const settingsMap = new Map<string, any>()
  filteredStaffSet.forEach((name) => {
    const s = staffSettingsMap.get(name)
    if (s) settingsMap.set(name, s)
  })

  const calculateStandardHoursByStaff = (): Map<string, { standardHours: number; capacityReducing: number }> => {
    const staffMap = new Map<string, { standardHours: number; capacityReducing: number }>()
    settingsMap.forEach((_, name) => staffMap.set(name, { standardHours: 0, capacityReducing: 0 }))

    const start = new Date(currentYearStart)
    const end = new Date(currentYearEnd)
    const current = new Date(start)

    while (current <= end) {
      const year = current.getFullYear()
      const month = current.getMonth()
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 0)
      const rangeStart = current > monthStart ? current : monthStart
      const rangeEnd = end < monthEnd ? end : monthEnd

      settingsMap.forEach((setting, staffName) => {
        const effectiveStart = setting.start_date ? new Date(setting.start_date) : null
        const effectiveEnd = setting.end_date ? new Date(setting.end_date) : null
        if (effectiveEnd && effectiveEnd < rangeStart) return
        if (effectiveStart && effectiveStart > rangeEnd) return
        const staffStart = effectiveStart && effectiveStart > rangeStart ? effectiveStart : rangeStart
        const staffEnd = effectiveEnd && effectiveEnd < rangeEnd ? effectiveEnd : rangeEnd
        const staffWeekdays = getWeekdaysInDateRange(staffStart, staffEnd)
        const dailyHours = (Number(setting.default_daily_hours) || 8) * (Number(setting.fte) || 1.0)
        staffMap.get(staffName)!.standardHours += staffWeekdays * dailyHours
      })

      current.setMonth(month + 1)
      current.setDate(1)
    }

    // Add capacity reducing hours (from already-fetched data)
    capacityReducingRaw.forEach((r) => {
      if (!r.staff) return
      const name = r.staff.trim()
      if (name.toLowerCase() === 'disbursement') return
      const entry = staffMap.get(name)
      if (entry) entry.capacityReducing += convertTimeToHours(r.time)
    })

    return staffMap
  }

  const standardHoursData = calculateStandardHoursByStaff()

  // Aggregate billable data by staff
  const billableByStaff = new Map<string, { amount: number; hours: number }>()
  billableRaw.forEach((r) => {
    if (!r.staff || r.staff.trim().toLowerCase() === 'disbursement') return
    const name = r.staff.trim()
    if (staffFilter && name !== staffFilter) return
    const entry = billableByStaff.get(name) ?? { amount: 0, hours: 0 }
    entry.amount += typeof r.billable_amount === 'number' ? r.billable_amount : parseFloat(r.billable_amount || '0') || 0
    entry.hours += convertTimeToHours(r.time)
    billableByStaff.set(name, entry)
  })

  const billableHoursByStaff = new Map<string, number>()
  billableHoursRaw.forEach((r) => {
    if (!r.staff || r.staff.trim().toLowerCase() === 'disbursement') return
    const name = r.staff.trim()
    billableHoursByStaff.set(name, (billableHoursByStaff.get(name) ?? 0) + convertTimeToHours(r.time))
  })

  const recoverabilityByStaff = new Map<string, { writeOnAmount: number; invoicedAmount: number }>()
  recoverabilityRaw.forEach((r) => {
    if (!r.staff || r.staff.trim().toLowerCase() === 'disbursement') return
    const name = r.staff.trim()
    const entry = recoverabilityByStaff.get(name) ?? { writeOnAmount: 0, invoicedAmount: 0 }
    entry.writeOnAmount += Number(r.write_on_amount || 0)
    entry.invoicedAmount += Number(r.invoiced_amount || 0)
    recoverabilityByStaff.set(name, entry)
  })

  const targetsMap = new Map<string, number | null>()
  allStaffSettings.forEach((s) => {
    if (s.staff_name) {
      const target = s.target_billable_percentage !== null && s.target_billable_percentage !== undefined
        ? Number(s.target_billable_percentage)
        : null
      targetsMap.set(s.staff_name.trim(), target)
    }
  })

  // Combine and calculate metrics
  const allStaffNames = new Set<string>()
  billableByStaff.forEach((_, name) => allStaffNames.add(name))
  standardHoursData.forEach((_, name) => allStaffNames.add(name))
  recoverabilityByStaff.forEach((_, name) => allStaffNames.add(name))

  const staffPerformanceData: any[] = []

  allStaffNames.forEach((staffName) => {
    if (staffFilter && staffName !== staffFilter) return

    const billable = billableByStaff.get(staffName) ?? { amount: 0, hours: 0 }
    if (billable.amount <= 0) return

    const billableHours = billableHoursByStaff.get(staffName) ?? 0
    const standard = standardHoursData.get(staffName) ?? { standardHours: 0, capacityReducing: 0 }
    const recoverability = recoverabilityByStaff.get(staffName) ?? { writeOnAmount: 0, invoicedAmount: 0 }

    const totalHours = Math.max(0, standard.standardHours - standard.capacityReducing)
    const billablePercentage = totalHours > 0 ? (billableHours / totalHours) * 100 : 0
    const averageRate = billableHours > 0 ? billable.amount / billableHours : 0

    const recoverabilityDenominator = recoverability.invoicedAmount - recoverability.writeOnAmount
    const recoverabilityPercentage = recoverabilityDenominator > 0
      ? (1 + recoverability.writeOnAmount / recoverabilityDenominator) * 100
      : 0

    const targetBillablePercentage = targetsMap.get(staffName) ?? null
    const billableVariance = targetBillablePercentage !== null ? billablePercentage - targetBillablePercentage : null
    const targetRecoverabilityPercentage = 95
    const recoverabilityVariance = recoverabilityPercentage - targetRecoverabilityPercentage

    staffPerformanceData.push({
      staff: staffName,
      currentYear: {
        billableAmount: Math.round(billable.amount * 100) / 100,
        billablePercentage: Math.round(billablePercentage * 10) / 10,
        targetBillablePercentage: targetBillablePercentage !== null ? Math.round(targetBillablePercentage * 10) / 10 : null,
        billableVariance: billableVariance !== null ? Math.round(billableVariance * 10) / 10 : null,
        recoverabilityAmount: Math.round(recoverability.writeOnAmount * 100) / 100,
        recoverabilityPercentage: Math.round(recoverabilityPercentage * 10) / 10,
        targetRecoverabilityPercentage,
        recoverabilityVariance: Math.round(recoverabilityVariance * 10) / 10,
        billableHours: Math.round(billableHours * 10) / 10,
        averageHourlyRate: Math.round(averageRate * 100) / 100,
      },
    })
  })

  staffPerformanceData.sort((a, b) => a.staff.localeCompare(b.staff))

  // Totals (aggregated over all staff in standard hours data, consistent with KPI card)
  let totalBillableHours = 0
  let totalStandardHours = 0
  let totalCapacityReducing = 0
  let totalBillableAmount = 0
  let totalInvoicedAmount = 0
  let totalWriteOnAmount = 0

  standardHoursData.forEach((sd, name) => {
    const billable = billableByStaff.get(name) ?? { amount: 0, hours: 0 }
    const billableHours = billableHoursByStaff.get(name) ?? 0
    const recoverability = recoverabilityByStaff.get(name) ?? { writeOnAmount: 0, invoicedAmount: 0 }
    totalBillableHours += billableHours
    totalStandardHours += sd.standardHours
    totalCapacityReducing += sd.capacityReducing
    totalBillableAmount += billable.amount
    totalInvoicedAmount += recoverability.invoicedAmount
    totalWriteOnAmount += recoverability.writeOnAmount
  })

  const totalHours = Math.max(0, totalStandardHours - totalCapacityReducing)
  const totalBillablePercentage = totalHours > 0 ? (totalBillableHours / totalHours) * 100 : 0
  const totalAverageRate = totalBillableHours > 0 ? totalBillableAmount / totalBillableHours : 0
  const totalRecoverabilityDenominator = totalInvoicedAmount - totalWriteOnAmount
  const totalRecoverabilityPercentage = totalRecoverabilityDenominator > 0
    ? (1 + totalWriteOnAmount / totalRecoverabilityDenominator) * 100
    : 0
  const totalRecoverabilityVariance = totalRecoverabilityPercentage - 95

  const totals = {
    currentYear: {
      billableAmount: Math.round(totalBillableAmount * 100) / 100,
      billablePercentage: Math.round(totalBillablePercentage * 10) / 10,
      targetBillablePercentage: null,
      billableVariance: null,
      recoverabilityAmount: Math.round(totalWriteOnAmount * 100) / 100,
      recoverabilityPercentage: Math.round(totalRecoverabilityPercentage * 10) / 10,
      targetRecoverabilityPercentage: 95,
      recoverabilityVariance: Math.round(totalRecoverabilityVariance * 10) / 10,
      billableHours: Math.round(totalBillableHours * 10) / 10,
      averageHourlyRate: Math.round(totalAverageRate * 100) / 100,
    },
  }

  return { data: staffPerformanceData, totals }
}

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const asOfDateParam = searchParams.get('asOfDate')
    const filtersParam = searchParams.get('filters') ?? ''

    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date()
    const currentMonth = asOfDate.getMonth()
    const currentYear = asOfDate.getFullYear()

    const currentFYStartYear = currentMonth >= 6 ? currentYear : currentYear - 1
    const currentFYEndYear = currentFYStartYear + 1
    const lastFYStartYear = currentFYStartYear - 1

    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = formatDateLocal(asOfDate)

    // Normalize filters to stable cache key (strip ephemeral id field)
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

    const result = await computeStaffPerformance(
      organizationId,
      currentFYStartYear,
      currentFYEndYear,
      lastFYStartYear,
      currentYearStart,
      currentYearEnd,
      filtersKey
    )

    return NextResponse.json(result, { headers: { 'Cache-Control': CACHE_CONTROL_READONLY_JSON } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
