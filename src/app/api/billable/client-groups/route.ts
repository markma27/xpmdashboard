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
  const routeName = 'GET /api/billable/client-groups'
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const staffFilter = searchParams.get('staff')
    const monthFilter = searchParams.get('month')
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

    const getMonthDateRange = (monthName: string, year: number) => {
      const monthMap: { [key: string]: number } = {
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
      const monthIndex = monthMap[monthName]
      if (monthIndex === undefined) return null

      const endDate = new Date(year, monthIndex + 1, 0)

      return {
        start: `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`,
        end: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`,
      }
    }

    let rangeCurrentStart = currentYearStart
    let rangeCurrentEnd = currentYearEnd
    let rangeLastStart = lastYearStart
    let rangeLastEnd = lastYearEnd

    if (monthFilter) {
      const monthMap: { [key: string]: number } = {
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
      const monthIndex = monthMap[monthFilter]

      if (monthIndex !== undefined) {
        let currentCalendarYear: number
        let lastCalendarYear: number

        if (monthIndex >= 6) {
          currentCalendarYear = currentFYStartYear
          lastCalendarYear = lastFYStartYear
        } else {
          currentCalendarYear = currentFYEndYear
          lastCalendarYear = lastFYEndYear
        }

        const currentRange = getMonthDateRange(monthFilter, currentCalendarYear)
        const lastRange = getMonthDateRange(monthFilter, lastCalendarYear)

        if (currentRange && lastRange) {
          rangeCurrentStart = currentRange.start
          rangeCurrentEnd = currentRange.end
          rangeLastStart = lastRange.start
          rangeLastEnd = lastRange.end
        }
      }
    }

    const { data: raw, error } = await supabase.rpc('get_billable_client_groups_summary', {
      p_organization_id: organizationId,
      p_current_start: rangeCurrentStart,
      p_current_end: rangeCurrentEnd,
      p_last_start: rangeLastStart,
      p_last_end: rangeLastEnd,
      p_staff: parsed.staff,
      p_client_group: parsed.clientGroup,
      p_account_manager: parsed.accountManager,
      p_job_manager: parsed.jobManager,
      p_job_name: parsed.jobName,
      p_job_name_operator: parsed.jobNameOperator,
    })

    if (error) {
      throw new Error(`Failed to fetch client groups summary: ${error.message}`)
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

    logApiPerf(routeName, startedAt)
    return NextResponse.json(result, {
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
