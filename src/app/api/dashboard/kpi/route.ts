import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { getTodayLocal } from '@/lib/utils'
import { CACHE_CONTROL_READONLY_JSON } from '@/lib/http-cache'
import { getCachedDashboardKpiRunner } from '@/lib/org-analytics-cache'
import { logApiPerf } from '@/lib/api-perf'

export async function GET(request: NextRequest) {
  const startedAt = performance.now()
  const routeName = 'GET /api/dashboard/kpi'
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const asOfDateParam = searchParams.get('asOfDate')
    const filtersParam = searchParams.get('filters') ?? ''

    const today = getTodayLocal()
    const currentYearEnd =
      asOfDateParam && /^\d{4}-\d{2}-\d{2}$/.test(asOfDateParam) ? asOfDateParam : today

    const asOfDate = asOfDateParam ? new Date(asOfDateParam + 'T00:00:00') : new Date()
    const currentMonth = asOfDate.getMonth()
    const currentYear = asOfDate.getFullYear()

    let currentFYStartYear: number
    if (currentMonth >= 6) {
      currentFYStartYear = currentYear
    } else {
      currentFYStartYear = currentYear - 1
    }

    const lastFYStartYear = currentFYStartYear - 1
    const lastFYEndYear = currentFYStartYear

    const currentYearStart = `${currentFYStartYear}-07-01`

    const [year, month, day] = currentYearEnd.split('-').map(Number)
    const lastYearEndDate = `${year - 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const lastYearFYEnd = `${lastFYEndYear}-06-30`
    const lastYearEnd = lastYearEndDate <= lastYearFYEnd ? lastYearEndDate : lastYearFYEnd
    const lastYearStart = `${lastFYStartYear}-07-01`

    const runCached = getCachedDashboardKpiRunner(organizationId)
    const payload = await runCached(
      currentYearEnd,
      currentYearStart,
      lastYearStart,
      lastYearEnd,
      filtersParam
    )

    logApiPerf(routeName, startedAt)
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': CACHE_CONTROL_READONLY_JSON,
      },
    })
  } catch (error: unknown) {
    logApiPerf(routeName, startedAt)
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
