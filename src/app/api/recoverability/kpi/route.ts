import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateLocal } from '@/lib/utils'
import { CACHE_CONTROL_READONLY_JSON } from '@/lib/http-cache'

type RecoverabilityFilter = { type: string; value: string; operator?: string }

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

  const fetchData = async (startDate: string, endDate: string) => {
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      let query = supabase
        .from('recoverability_timesheet_uploads')
        .select('write_on_amount, invoiced_amount, account_manager, job_manager, client_group, staff')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate)

      filters.forEach((filter) => {
        if (filter.type === 'account_manager' && filter.value && filter.value !== 'all') {
          query = query.eq('account_manager', filter.value)
        } else if (filter.type === 'job_manager' && filter.value && filter.value !== 'all') {
          query = query.eq('job_manager', filter.value)
        } else if (filter.type === 'client_group' && filter.value) {
          query = query.eq('client_group', filter.value)
        } else if (filter.type === 'staff' && filter.value && filter.value !== 'all') {
          query = query.eq('staff', filter.value)
        }
      })

      const { data: pageData, error: pageError } = await query.range(page * pageSize, (page + 1) * pageSize - 1)

      if (pageError) throw new Error(`Failed to fetch recoverability data: ${pageError.message}`)

      if (pageData && pageData.length > 0) {
        allData = allData.concat(pageData)
        page++
        hasMore = pageData.length === pageSize
      } else {
        hasMore = false
      }
    }

    let totalWriteOnAmount = 0
    let totalInvoicedAmount = 0
    allData.forEach((record) => {
      totalWriteOnAmount += Number(record.write_on_amount || 0)
      totalInvoicedAmount += Number(record.invoiced_amount || 0)
    })

    return { amount: totalWriteOnAmount, writeOnAmount: totalWriteOnAmount, invoicedAmount: totalInvoicedAmount }
  }

  const [currentYearData, lastYearData] = await Promise.all([
    fetchData(currentYearStart, currentYearEnd),
    fetchData(lastYearStart, lastYearEnd),
  ])

  let percentageChange: number | null = null
  if (Math.abs(lastYearData.amount) > 0.01) {
    percentageChange = ((currentYearData.amount - lastYearData.amount) / Math.abs(lastYearData.amount)) * 100
  } else if (Math.abs(currentYearData.amount) > 0.01) {
    percentageChange = currentYearData.amount > 0 ? 100 : -100
  }

  const currentYearDenominator = currentYearData.invoicedAmount - currentYearData.writeOnAmount
  const currentYearPercentage = currentYearDenominator > 0
    ? (1 + (currentYearData.writeOnAmount / currentYearDenominator)) * 100
    : 0

  const lastYearDenominator = lastYearData.invoicedAmount - lastYearData.writeOnAmount
  const lastYearPercentage = lastYearDenominator > 0
    ? (1 + (lastYearData.writeOnAmount / lastYearDenominator)) * 100
    : 0

  return {
    currentYearAmount: Math.round(currentYearData.amount * 100) / 100,
    lastYearAmount: Math.round(lastYearData.amount * 100) / 100,
    percentageChange: percentageChange !== null ? Math.round(percentageChange * 10) / 10 : null,
    currentYearPercentage: Math.round(currentYearPercentage * 10) / 10,
    lastYearPercentage: Math.round(lastYearPercentage * 10) / 10,
    targetPercentage: 95.0,
  }
}

export async function GET(request: NextRequest) {
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

    // Normalize filters to a stable cache key (strip id/ephemeral fields)
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
      } catch {}
    }

    const result = await computeRecoverabilityKpi(
      organizationId,
      currentYearStart,
      currentYearEnd,
      lastYearStart,
      lastYearEnd,
      filtersKey
    )

    return NextResponse.json(result, { headers: { 'Cache-Control': CACHE_CONTROL_READONLY_JSON } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
