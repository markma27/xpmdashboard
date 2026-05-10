import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateLocal } from '@/lib/utils'
import { CACHE_CONTROL_READONLY_JSON } from '@/lib/http-cache'
import { logApiPerf } from '@/lib/api-perf'
import {
  dashboardFiltersToBillableRpcParams,
  mergeBillableStaffUrlParam,
} from '@/lib/billable-rpc-params'

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

type ProductivityFilter = { type: string; value: string; operator?: string }

type BillableTotalsRow = { total_hours: unknown; total_amount: unknown }
type StaffFyRow = { staff: string; cy_hours: unknown; ly_hours: unknown }

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

  const filters: ProductivityFilter[] = filtersKey ? JSON.parse(filtersKey) : []
  const staffFilter = staffFilterKey?.trim() || ''

  const pivot = dashboardFiltersToBillableRpcParams(
    filters.map((f) => ({ type: f.type, value: f.value, operator: f.operator }))
  )
  const merged = mergeBillableStaffUrlParam(staffFilter || null, pivot)

  const fullCurrentYearStart = `${currentFYStartYear}-07-01`
  const fullCurrentYearEnd = `${currentFYEndYear}-06-30`
  const fullLastYearStart = `${lastFYStartYear}-07-01`
  const fullLastYearEnd = `${currentFYStartYear}-06-30`

  const rpcBillableArgs = {
    p_organization_id: organizationId,
    p_client_group: merged.clientGroup,
    p_account_manager: merged.accountManager,
    p_job_manager: merged.jobManager,
    p_job_name: merged.jobName,
    p_job_name_operator: merged.jobNameOperator,
    p_staff: merged.staff,
  }

  const [settingsRes, cyBillRes, lyBillRes, cyCapRes, lyCapRes, fyRes] = await Promise.all([
    supabase
      .from('staff_settings')
      .select(
        'staff_name, default_daily_hours, fte, start_date, end_date, is_hidden, report, target_billable_percentage'
      )
      .eq('organization_id', organizationId),
    supabase.rpc('get_productivity_billable_totals', {
      ...rpcBillableArgs,
      p_start_date: currentYearStart,
      p_end_date: currentYearEnd,
    }),
    supabase.rpc('get_productivity_billable_totals', {
      ...rpcBillableArgs,
      p_start_date: lastYearStart,
      p_end_date: lastYearEnd,
    }),
    supabase.rpc('get_productivity_capacity_reducing_hours', {
      p_organization_id: organizationId,
      p_start_date: currentYearStart,
      p_end_date: currentYearEnd,
      p_staff: staffFilter || null,
    }),
    supabase.rpc('get_productivity_capacity_reducing_hours', {
      p_organization_id: organizationId,
      p_start_date: lastYearStart,
      p_end_date: lastYearEnd,
      p_staff: staffFilter || null,
    }),
    staffFilter
      ? Promise.resolve({ data: [] as StaffFyRow[], error: null })
      : supabase.rpc('get_productivity_staff_fy_hours', {
          p_organization_id: organizationId,
          p_current_fy_start: fullCurrentYearStart,
          p_current_fy_end: fullCurrentYearEnd,
          p_last_fy_start: fullLastYearStart,
          p_last_fy_end: fullLastYearEnd,
        }),
  ])

  if (settingsRes.error) {
    throw new Error(`Failed to fetch staff settings: ${settingsRes.error.message}`)
  }
  if (cyBillRes.error) {
    throw new Error(`Failed to fetch billable totals: ${cyBillRes.error.message}`)
  }
  if (lyBillRes.error) {
    throw new Error(`Failed to fetch billable totals: ${lyBillRes.error.message}`)
  }
  if (cyCapRes.error) {
    throw new Error(`Failed to fetch capacity reducing hours: ${cyCapRes.error.message}`)
  }
  if (lyCapRes.error) {
    throw new Error(`Failed to fetch capacity reducing hours: ${lyCapRes.error.message}`)
  }
  if (fyRes.error) {
    throw new Error(`Failed to fetch staff FY hours: ${fyRes.error.message}`)
  }

  const allStaffSettings = settingsRes.data ?? []

  const cyRow = (cyBillRes.data?.[0] ?? null) as BillableTotalsRow | null
  const lyRow = (lyBillRes.data?.[0] ?? null) as BillableTotalsRow | null
  const currentYearBillable = {
    hours: Number(cyRow?.total_hours ?? 0),
    amount: Number(cyRow?.total_amount ?? 0),
  }
  const lastYearBillable = {
    hours: Number(lyRow?.total_hours ?? 0),
    amount: Number(lyRow?.total_amount ?? 0),
  }

  const unwrapRpcNumeric = (value: unknown): number => {
    if (value === null || value === undefined) return 0
    if (typeof value === 'number' && !Number.isNaN(value)) return value
    if (Array.isArray(value) && value.length > 0) return Number(value[0])
    return Number(value)
  }

  const currentYearCapacityReducing = unwrapRpcNumeric(cyCapRes.data)
  const lastYearCapacityReducing = unwrapRpcNumeric(lyCapRes.data)

  const fyRows = (fyRes.data ?? []) as StaffFyRow[]

  const staffSettingsMap = new Map<string, (typeof allStaffSettings)[number]>()
  allStaffSettings.forEach((s) => {
    if (s.staff_name) staffSettingsMap.set(s.staff_name, s)
  })

  const excludedStaffSet = new Set<string>()
  allStaffSettings.forEach((s) => {
    if (s.staff_name && (s.is_hidden || s.report === false)) excludedStaffSet.add(s.staff_name)
  })

  let selectedStaffNames: string[] = []
  if (staffFilter) {
    const settings = staffSettingsMap.get(staffFilter)
    if (settings && !settings.is_hidden && settings.report !== false) {
      selectedStaffNames = [staffFilter]
    }
  } else {
    selectedStaffNames = fyRows
      .filter((row) => {
        if (!row.staff) return false
        const name = row.staff.trim()
        if (!name || name.toLowerCase() === 'disbursement') return false
        if (excludedStaffSet.has(name)) return false
        const cy = Number(row.cy_hours ?? 0)
        const ly = Number(row.ly_hours ?? 0)
        const rounded = {
          cy: Math.round(cy * 100) / 100,
          ly: Math.round(ly * 100) / 100,
        }
        return rounded.cy > 0 || rounded.ly > 0
      })
      .filter((row) => {
        const s = staffSettingsMap.get(row.staff.trim())
        return s && !s.is_hidden && s.report !== false
      })
      .map((row) => row.staff.trim())
      .sort()
  }

  const settingsMap = new Map<string, (typeof allStaffSettings)[number]>()
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

  const ytdBillablePercentage =
    currentYearTotalHours > 0 ? (currentYearBillable.hours / currentYearTotalHours) * 100 : 0
  const lastYearBillablePercentage =
    lastYearTotalHours > 0 ? (lastYearBillable.hours / lastYearTotalHours) * 100 : 0

  const ytdAverageRate =
    currentYearBillable.hours > 0 ? currentYearBillable.amount / currentYearBillable.hours : 0
  const lastYearAverageRate =
    lastYearBillable.hours > 0 ? lastYearBillable.amount / lastYearBillable.hours : 0

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

export async function GET(request: NextRequest) {
  const startedAt = performance.now()
  const routeName = 'GET /api/productivity/kpi'
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

    let filtersKey = ''
    if (filtersParam) {
      try {
        const parsed = JSON.parse(filtersParam)
        if (Array.isArray(parsed)) {
          filtersKey = JSON.stringify(
            parsed
              .filter((f: { type?: string; value?: string }) => f.type && f.value)
              .map((f: { type: string; value: string; operator?: string }) => ({
                type: f.type,
                value: f.value,
                operator: f.operator,
              }))
          )
        }
      } catch {
        /* ignore */
      }
    }

    const result = await computeProductivityKpi(
      organizationId,
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

    logApiPerf(routeName, startedAt)
    return NextResponse.json(result, { headers: { 'Cache-Control': CACHE_CONTROL_READONLY_JSON } })
  } catch (error: unknown) {
    logApiPerf(routeName, startedAt)
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
