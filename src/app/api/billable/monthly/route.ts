import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logApiPerf } from '@/lib/api-perf'
import {
  mergeBillableStaffUrlParam,
  parsePipeBillableFilters,
} from '@/lib/billable-rpc-params'

export async function GET(request: NextRequest) {
  const startedAt = performance.now()
  const routeName = 'GET /api/billable/monthly'
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const staffFilter = searchParams.get('staff')
    const filtersParam = searchParams.get('filters')

    const parsed = mergeBillableStaffUrlParam(
      staffFilter,
      parsePipeBillableFilters(filtersParam)
    )

    const supabase = await createClient()

    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

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
    const currentYearEnd = `${currentFYEndYear}-06-30`
    const lastYearStart = `${lastFYStartYear}-07-01`
    const lastYearEnd = `${lastFYEndYear}-06-30`

    const { data: raw, error } = await supabase.rpc('get_billable_monthly_summary', {
      p_organization_id: organizationId,
      p_current_year_start: currentYearStart,
      p_current_year_end: currentYearEnd,
      p_last_year_start: lastYearStart,
      p_last_year_end: lastYearEnd,
      p_staff: parsed.staff,
      p_client_group: parsed.clientGroup,
      p_account_manager: parsed.accountManager,
      p_job_manager: parsed.jobManager,
      p_job_name: parsed.jobName,
      p_job_name_operator: parsed.jobNameOperator,
    })

    if (error) {
      throw new Error(`Failed to fetch billable monthly summary: ${error.message}`)
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

    logApiPerf(routeName, startedAt)
    return NextResponse.json(formattedData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error: unknown) {
    logApiPerf(routeName, startedAt)
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
