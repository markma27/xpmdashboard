import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateLocal } from '@/lib/utils'
import { CACHE_CONTROL_READONLY_JSON } from '@/lib/http-cache'
import { filtersToTimesheetSliceRpcParams } from '@/lib/billable-rpc-params'

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

type RowST = { staff: string; total_amount: unknown; total_hours: unknown }
type RowBH = { staff: string; billable_hours: unknown }
type RowRec = { staff: string; write_on: unknown; invoiced: unknown }
type RowCap = { staff: string; capacity_hours: unknown }
type FyRow = { staff: string; cy_hours: unknown; ly_hours: unknown }

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
  const filters: StaffFilter[] = filtersKey
    ? (() => {
        try {
          const parsed = JSON.parse(filtersKey)
          if (!Array.isArray(parsed)) return []
          return parsed
            .filter((f: { type?: string; value?: unknown }) => f.type && f.value)
            .map((f: { type: string; value: string; operator?: string }) => ({
              type: f.type,
              value: typeof f.value === 'string' ? decodeURIComponent(f.value) : String(f.value),
              operator: f.operator,
            }))
        } catch {
          return []
        }
      })()
    : []

  const staffFilter = filters.find((f) => f.type === 'staff' && f.value && f.value !== 'all')?.value ?? null
  const slice = filtersToTimesheetSliceRpcParams(filters)

  const fullCurrentYearEnd = `${currentFYEndYear}-06-30`
  const fullLastYearStart = `${lastFYStartYear}-07-01`
  const fullLastYearEnd = `${currentFYStartYear}-06-30`

  const rpcSlice = {
    p_client_group: slice.clientGroup,
    p_account_manager: slice.accountManager,
    p_job_manager: slice.jobManager,
    p_job_name: slice.jobName,
    p_job_name_operator: slice.jobNameOperator,
  }

  const [
    settingsRes,
    tsRes,
    bhRes,
    recRes,
    capRes,
    fyRes,
  ] = await Promise.all([
    supabase
      .from('staff_settings')
      .select(
        'staff_name, default_daily_hours, fte, start_date, end_date, is_hidden, report, target_billable_percentage'
      )
      .eq('organization_id', organizationId),
    supabase.rpc('get_staff_performance_timesheet_by_staff', {
      p_organization_id: organizationId,
      p_start: currentYearStart,
      p_end: currentYearEnd,
      ...rpcSlice,
    }),
    supabase.rpc('get_staff_performance_billable_hours_by_staff', {
      p_organization_id: organizationId,
      p_start: currentYearStart,
      p_end: currentYearEnd,
      ...rpcSlice,
    }),
    supabase.rpc('get_staff_performance_recoverability_by_staff', {
      p_organization_id: organizationId,
      p_start: currentYearStart,
      p_end: currentYearEnd,
    }),
    supabase.rpc('get_staff_performance_capacity_by_staff', {
      p_organization_id: organizationId,
      p_start: currentYearStart,
      p_end: currentYearEnd,
    }),
    staffFilter
      ? Promise.resolve({ data: [] as FyRow[], error: null })
      : supabase.rpc('get_productivity_staff_fy_hours', {
          p_organization_id: organizationId,
          p_current_fy_start: `${currentFYStartYear}-07-01`,
          p_current_fy_end: fullCurrentYearEnd,
          p_last_fy_start: fullLastYearStart,
          p_last_fy_end: fullLastYearEnd,
        }),
  ])

  if (settingsRes.error) throw new Error(settingsRes.error.message)
  if (tsRes.error) throw new Error(tsRes.error.message)
  if (bhRes.error) throw new Error(bhRes.error.message)
  if (recRes.error) throw new Error(recRes.error.message)
  if (capRes.error) throw new Error(capRes.error.message)
  if (fyRes.error) throw new Error(fyRes.error.message)

  const allStaffSettings = settingsRes.data ?? []

  const staffSettingsMap = new Map<string, (typeof allStaffSettings)[number]>()
  allStaffSettings.forEach((s) => {
    if (s.staff_name) staffSettingsMap.set(s.staff_name.trim(), s)
  })

  const excludedStaffSet = new Set<string>()
  allStaffSettings.forEach((s) => {
    if (s.staff_name && (s.is_hidden || s.report === false)) excludedStaffSet.add(s.staff_name.trim())
  })

  const filteredStaffSet = new Set<string>()
  if (staffFilter) {
    filteredStaffSet.add(staffFilter)
  } else {
    const fyRows = (fyRes.data ?? []) as FyRow[]
    fyRows.forEach((r) => {
      if (!r.staff) return
      const name = r.staff.trim()
      if (!name || name.toLowerCase() === 'disbursement') return
      if (excludedStaffSet.has(name)) return
      const cy = Number(r.cy_hours ?? 0)
      const ly = Number(r.ly_hours ?? 0)
      const rounded = { cy: Math.round(cy * 100) / 100, ly: Math.round(ly * 100) / 100 }
      if (rounded.cy > 0 || rounded.ly > 0) filteredStaffSet.add(name)
    })
  }

  const settingsMap = new Map<string, (typeof allStaffSettings)[number]>()
  filteredStaffSet.forEach((name) => {
    const s = staffSettingsMap.get(name)
    if (s) settingsMap.set(name, s)
  })

  const capacityByStaff = new Map<string, number>()
  ;(capRes.data as RowCap[] | null)?.forEach((r) => {
    if (!r.staff) return
    const name = r.staff.trim()
    capacityByStaff.set(name, Number(r.capacity_hours ?? 0))
  })

  const calculateStandardHoursByStaff = (): Map<string, { standardHours: number; capacityReducing: number }> => {
    const staffMap = new Map<string, { standardHours: number; capacityReducing: number }>()
    settingsMap.forEach((_, name) => staffMap.set(name, { standardHours: 0, capacityReducing: capacityByStaff.get(name) ?? 0 }))

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

    return staffMap
  }

  const standardHoursData = calculateStandardHoursByStaff()

  const billableByStaff = new Map<string, { amount: number; hours: number }>()
  ;(tsRes.data as RowST[] | null)?.forEach((r) => {
    if (!r.staff || r.staff.trim().toLowerCase() === 'disbursement') return
    const name = r.staff.trim()
    if (staffFilter && name !== staffFilter) return
    billableByStaff.set(name, {
      amount: Number(r.total_amount ?? 0),
      hours: Number(r.total_hours ?? 0),
    })
  })

  const billableHoursByStaff = new Map<string, number>()
  ;(bhRes.data as RowBH[] | null)?.forEach((r) => {
    if (!r.staff) return
    billableHoursByStaff.set(r.staff.trim(), Number(r.billable_hours ?? 0))
  })

  const recoverabilityByStaff = new Map<string, { writeOnAmount: number; invoicedAmount: number }>()
  ;(recRes.data as RowRec[] | null)?.forEach((r) => {
    if (!r.staff) return
    const name = r.staff.trim()
    recoverabilityByStaff.set(name, {
      writeOnAmount: Number(r.write_on ?? 0),
      invoicedAmount: Number(r.invoiced ?? 0),
    })
  })

  const targetsMap = new Map<string, number | null>()
  allStaffSettings.forEach((s) => {
    if (s.staff_name) {
      const target =
        s.target_billable_percentage !== null && s.target_billable_percentage !== undefined
          ? Number(s.target_billable_percentage)
          : null
      targetsMap.set(s.staff_name.trim(), target)
    }
  })

  const allStaffNames = new Set<string>()
  billableByStaff.forEach((_, name) => allStaffNames.add(name))
  standardHoursData.forEach((_, name) => allStaffNames.add(name))
  recoverabilityByStaff.forEach((_, name) => allStaffNames.add(name))

  const staffPerformanceData: Array<Record<string, unknown>> = []

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
    const recoverabilityPercentage =
      recoverabilityDenominator > 0 ? (1 + recoverability.writeOnAmount / recoverabilityDenominator) * 100 : 0

    const targetBillablePercentage = targetsMap.get(staffName) ?? null
    const billableVariance = targetBillablePercentage !== null ? billablePercentage - targetBillablePercentage : null
    const targetRecoverabilityPercentage = 95
    const recoverabilityVariance = recoverabilityPercentage - targetRecoverabilityPercentage

    staffPerformanceData.push({
      staff: staffName,
      currentYear: {
        billableAmount: Math.round(billable.amount * 100) / 100,
        billablePercentage: Math.round(billablePercentage * 10) / 10,
        targetBillablePercentage:
          targetBillablePercentage !== null ? Math.round(targetBillablePercentage * 10) / 10 : null,
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

  staffPerformanceData.sort((a, b) => String(a.staff).localeCompare(String(b.staff)))

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
  const totalRecoverabilityPercentage =
    totalRecoverabilityDenominator > 0 ? (1 + totalWriteOnAmount / totalRecoverabilityDenominator) * 100 : 0
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

    let filtersKey = ''
    if (filtersParam) {
      try {
        const parsed = JSON.parse(filtersParam)
        if (Array.isArray(parsed)) {
          filtersKey = JSON.stringify(
            parsed
              .filter((f: { type?: string; value?: unknown }) => f.type && f.value)
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
