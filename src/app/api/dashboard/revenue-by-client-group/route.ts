import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateLocal } from '@/lib/utils'
import { CACHE_CONTROL_READONLY_JSON } from '@/lib/http-cache'
import { getCachedOrgRunner } from '@/lib/org-analytics-cache'

async function computeRevenueByClientGroup(
  organizationId: string,
  currentYearStart: string,
  currentYearEnd: string,
  lastYearStart: string,
  lastYearEnd: string
) {
  const supabase = await createClient()

  const fetchData = async (startDate: string, endDate: string): Promise<any[]> => {
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('invoice_uploads')
        .select('amount, client_group')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate)
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (pageError) throw new Error(`Failed to fetch revenue data: ${pageError.message}`)

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

  const [currentYearData, lastYearData] = await Promise.all([
    fetchData(currentYearStart, currentYearEnd),
    fetchData(lastYearStart, lastYearEnd),
  ])

  const clientGroupMap = new Map<string, { currentYear: number; lastYear: number }>()

  currentYearData.forEach((record) => {
    const clientGroup = record.client_group || 'Uncategorized'
    const amount = typeof record.amount === 'number' ? record.amount : parseFloat(record.amount || '0') || 0
    const entry = clientGroupMap.get(clientGroup) ?? { currentYear: 0, lastYear: 0 }
    entry.currentYear += amount
    clientGroupMap.set(clientGroup, entry)
  })

  lastYearData.forEach((record) => {
    const clientGroup = record.client_group || 'Uncategorized'
    const amount = typeof record.amount === 'number' ? record.amount : parseFloat(record.amount || '0') || 0
    const entry = clientGroupMap.get(clientGroup) ?? { currentYear: 0, lastYear: 0 }
    entry.lastYear += amount
    clientGroupMap.set(clientGroup, entry)
  })

  return Array.from(clientGroupMap.entries())
    .map(([clientGroup, data]) => ({
      clientGroup,
      'Current Year': Math.round(data.currentYear * 100) / 100,
      'Last Year': Math.round(data.lastYear * 100) / 100,
    }))
    .sort((a, b) => b['Current Year'] - a['Current Year'])
    .slice(0, 10)
}

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

    const cached = getCachedOrgRunner('dashboard-revenue-by-client-group-v1', organizationId, computeRevenueByClientGroup)
    const result = await cached(organizationId, currentYearStart, currentYearEnd, lastYearStart, lastYearEnd)

    return NextResponse.json(result, { headers: { 'Cache-Control': CACHE_CONTROL_READONLY_JSON } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
