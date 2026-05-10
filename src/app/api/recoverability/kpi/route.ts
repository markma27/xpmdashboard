import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateLocal } from '@/lib/utils'
import { CACHE_CONTROL_READONLY_JSON } from '@/lib/http-cache'
import { logApiPerf } from '@/lib/api-perf'
import { recoverabilityFiltersToRpcParams, type RecoverabilityFilter } from '@/lib/recoverability-rpc-params'

type RecoverabilityTotalsRow = {
  current_write_on: unknown
  current_invoiced: unknown
  last_write_on: unknown
  last_invoiced: unknown
}

async function computeRecoverabilityKpi(
  organizationId: string,
  currentYearStart: string,
  currentYearEnd: string,
  lastYearStart: string,
  lastYearEnd: string,
  filtersKey: string
) {
  const supabase = await createClient()
  const filters: RecoverabilityFilter[] = filtersKey ? JSON.parse(filtersKey) : []
  const p = recoverabilityFiltersToRpcParams(filters)

  const { data, error } = await supabase.rpc('get_recoverability_kpi_totals', {
    p_organization_id: organizationId,
    p_current_start: currentYearStart,
    p_current_end: currentYearEnd,
    p_last_start: lastYearStart,
    p_last_end: lastYearEnd,
    p_staff: p.staff,
    p_client_group: p.clientGroup,
    p_account_manager: p.accountManager,
    p_job_manager: p.jobManager,
  })

  if (error) {
    throw new Error(`Failed to fetch recoverability totals: ${error.message}`)
  }

  const row = (data?.[0] ?? null) as RecoverabilityTotalsRow | null
  if (!row) {
    throw new Error('Recoverability totals returned no data')
  }

  const currentYearAmount = Number(row.current_write_on || 0)
  const lastYearAmount = Number(row.last_write_on || 0)
  const currentInvoiced = Number(row.current_invoiced || 0)
  const lastInvoiced = Number(row.last_invoiced || 0)

  let percentageChange: number | null = null
  if (Math.abs(lastYearAmount) > 0.01) {
    percentageChange = ((currentYearAmount - lastYearAmount) / Math.abs(lastYearAmount)) * 100
  } else if (Math.abs(currentYearAmount) > 0.01) {
    percentageChange = currentYearAmount > 0 ? 100 : -100
  }

  const currentYearDenominator = currentInvoiced - currentYearAmount
  const currentYearPercentage =
    currentYearDenominator > 0 ? (1 + (currentYearAmount / currentYearDenominator)) * 100 : 0

  const lastYearDenominator = lastInvoiced - lastYearAmount
  const lastYearPercentage =
    lastYearDenominator > 0 ? (1 + (lastYearAmount / lastYearDenominator)) * 100 : 0

  return {
    currentYearAmount: Math.round(currentYearAmount * 100) / 100,
    lastYearAmount: Math.round(lastYearAmount * 100) / 100,
    percentageChange: percentageChange !== null ? Math.round(percentageChange * 10) / 10 : null,
    currentYearPercentage: Math.round(currentYearPercentage * 10) / 10,
    lastYearPercentage: Math.round(lastYearPercentage * 10) / 10,
    targetPercentage: 95.0,
  }
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now()
  const routeName = 'GET /api/recoverability/kpi'
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const filtersParam = searchParams.get('filters') ?? ''
    const asOfDateParam = searchParams.get('asOfDate')

    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date()
    const currentMonth = asOfDate.getMonth()
    const currentYear = asOfDate.getFullYear()

    const currentFYStartYear = currentMonth >= 6 ? currentYear : currentYear - 1
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
              .filter((f: any) => f.type && f.value)
              .map((f: any) => ({ type: f.type, value: f.value, operator: f.operator }))
          )
        }
      } catch {
        /* ignore */
      }
    }

    const result = await computeRecoverabilityKpi(
      organizationId,
      currentYearStart,
      currentYearEnd,
      lastYearStart,
      lastYearEnd,
      filtersKey
    )

    logApiPerf(routeName, startedAt)
    return NextResponse.json(result, { headers: { 'Cache-Control': CACHE_CONTROL_READONLY_JSON } })
  } catch (error: unknown) {
    logApiPerf(routeName, startedAt)
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
