import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateLocal } from '@/lib/utils'
import {
  dashboardFiltersToBillableRpcParams,
  mergeBillableStaffUrlParam,
} from '@/lib/billable-rpc-params'
import type { DashboardKpiFilter } from '@/lib/queries/dashboard-kpi-query'

function parseDashboardFilters(filtersParam: string | null): DashboardKpiFilter[] {
  if (!filtersParam) return []
  try {
    const parsed = JSON.parse(filtersParam)
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
}

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const staffFilter = searchParams.get('staff')
    const asOfDateParam = searchParams.get('asOfDate')

    const supabase = await createClient()

    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date()
    const currentMonth = asOfDate.getMonth()
    const currentYear = asOfDate.getFullYear()

    let currentFYStartYear: number
    if (currentMonth >= 6) {
      currentFYStartYear = currentYear
    } else {
      currentFYStartYear = currentYear - 1
    }

    const currentFYEndYear = currentFYStartYear + 1
    const lastFYStartYear = currentFYStartYear - 1
    const lastFYEndYear = currentFYStartYear

    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = formatDateLocal(asOfDate)
    const lastYearStart = `${lastFYStartYear}-07-01`
    const lastYearEnd = `${lastFYEndYear}-06-30`

    const filters = parseDashboardFilters(searchParams.get('filters'))
    const p = mergeBillableStaffUrlParam(staffFilter, dashboardFiltersToBillableRpcParams(filters))

    const { data: raw, error } = await supabase.rpc('get_productivity_monthly_billable_hours', {
      p_organization_id: organizationId,
      p_current_start: currentYearStart,
      p_current_end: currentYearEnd,
      p_last_start: lastYearStart,
      p_last_end: lastYearEnd,
      p_staff: p.staff ? p.staff.trim() : null,
      p_client_group: p.clientGroup,
      p_account_manager: p.accountManager,
      p_job_manager: p.jobManager,
      p_job_name: p.jobName,
      p_job_name_operator: p.jobNameOperator,
    })

    if (error) {
      throw new Error(`Failed to fetch productivity monthly: ${error.message}`)
    }

    let formattedData: unknown = raw
    if (typeof raw === 'string') {
      try {
        formattedData = JSON.parse(raw)
      } catch {
        formattedData = []
      }
    }
    if (!Array.isArray(formattedData)) {
      formattedData = []
    }

    return NextResponse.json(formattedData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
