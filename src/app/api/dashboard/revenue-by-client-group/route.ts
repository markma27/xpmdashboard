import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateLocal } from '@/lib/utils'
import { CACHE_CONTROL_READONLY_JSON } from '@/lib/http-cache'
import { fetchDashboardRevenueByClientGroup } from '@/lib/queries/dashboard-rollups'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
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

    const supabase = await createClient()
    const result = await fetchDashboardRevenueByClientGroup(supabase, {
      organizationId,
      currentYearStart,
      currentYearEnd,
      lastYearStart,
      lastYearEnd,
    })

    return NextResponse.json(result, { headers: { 'Cache-Control': CACHE_CONTROL_READONLY_JSON } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
