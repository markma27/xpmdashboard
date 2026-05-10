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

const MONTH_MAP: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
}

function getMonthDateRange(monthName: string, year: number) {
  const monthIndex = MONTH_MAP[monthName]
  if (monthIndex === undefined) return null
  const endDate = new Date(year, monthIndex + 1, 0)
  return {
    start: `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`,
    end: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`,
  }
}

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const staffFilter = searchParams.get('staff')
    const monthFilter = searchParams.get('month')
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

    let rangeCyStart = currentYearStart
    let rangeCyEnd = currentYearEnd
    let rangeLyStart = lastYearStart
    let rangeLyEnd = lastYearEnd

    if (monthFilter) {
      const monthIndex = MONTH_MAP[monthFilter]
      if (monthIndex !== undefined) {
        let cyCal: number
        let lyCal: number
        if (monthIndex >= 6) {
          cyCal = currentFYStartYear
          lyCal = lastFYStartYear
        } else {
          cyCal = currentFYEndYear
          lyCal = lastFYEndYear
        }
        const c = getMonthDateRange(monthFilter, cyCal)
        const l = getMonthDateRange(monthFilter, lyCal)
        if (c && l) {
          rangeCyStart = c.start
          rangeCyEnd = c.end
          rangeLyStart = l.start
          rangeLyEnd = l.end
        }
      }
    }

    const { data: raw, error } = await supabase.rpc('get_productivity_client_groups_summary', {
      p_organization_id: organizationId,
      p_current_start: rangeCyStart,
      p_current_end: rangeCyEnd,
      p_last_start: rangeLyStart,
      p_last_end: rangeLyEnd,
      p_staff: p.staff ? p.staff.trim() : null,
      p_client_group: p.clientGroup,
      p_account_manager: p.accountManager,
      p_job_manager: p.jobManager,
      p_job_name: p.jobName,
      p_job_name_operator: p.jobNameOperator,
    })

    if (error) {
      throw new Error(`Failed to fetch productivity client groups: ${error.message}`)
    }

    let result: unknown = raw
    if (typeof raw === 'string') {
      try {
        result = JSON.parse(raw)
      } catch {
        result = []
      }
    }
    if (!Array.isArray(result)) {
      result = []
    }

    return NextResponse.json(result, {
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
