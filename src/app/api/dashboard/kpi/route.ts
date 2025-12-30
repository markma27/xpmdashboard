import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const asOfDateParam = searchParams.get('asOfDate')
    
    // Parse filters from query params (same format as Billable page)
    const filtersParam = searchParams.get('filters')
    const filters: Array<{ type: string; value: string; operator?: string }> = []
    if (filtersParam) {
      try {
        const parsedFilters = JSON.parse(filtersParam)
        if (Array.isArray(parsedFilters)) {
          parsedFilters.forEach((filter: any) => {
            if (filter.type && filter.value) {
              filters.push({
                type: filter.type,
                value: typeof filter.value === 'string' ? decodeURIComponent(filter.value) : filter.value,
                operator: filter.operator,
              })
            }
          })
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    const supabase = await createClient()

    // Use provided date or default to today
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date()
    const currentMonth = asOfDate.getMonth() // 0-11
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
    
    // Format dates as YYYY-MM-DD
    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = asOfDate.toISOString().split('T')[0]
    
    // For last year "same time", calculate the same day last year
    const lastYearSameDate = new Date(asOfDate)
    lastYearSameDate.setFullYear(lastYearSameDate.getFullYear() - 1)
    const lastYearEndDate = lastYearSameDate.toISOString().split('T')[0]
    const lastYearFYEnd = `${lastFYEndYear}-06-30`
    const lastYearEnd = lastYearEndDate <= lastYearFYEnd ? lastYearEndDate : lastYearFYEnd
    const lastYearStart = `${lastFYStartYear}-07-01`

    // Check if we have filters that need special handling
    const hasFilters = filters.length > 0

    let currentYearRevenue: number = 0
    let lastYearRevenue: number = 0
    let currentYearBillableAmount: number = 0
    let lastYearBillableAmount: number = 0
    let totalWIPAmount: number = 0

    // Try to use RPC function first (if database migration has been applied)
    if (!hasFilters) {
      const { data: kpiData, error: kpiError } = await supabase.rpc('get_dashboard_kpis', {
        p_organization_id: organizationId,
        p_current_year_start: currentYearStart,
        p_current_year_end: currentYearEnd,
        p_last_year_start: lastYearStart,
        p_last_year_end: lastYearEnd,
      })

      if (!kpiError && kpiData && kpiData.length > 0) {
        // Use the aggregated results from RPC
        currentYearRevenue = Number(kpiData[0].current_year_revenue) || 0
        lastYearRevenue = Number(kpiData[0].last_year_revenue) || 0
        currentYearBillableAmount = Number(kpiData[0].current_year_billable) || 0
        lastYearBillableAmount = Number(kpiData[0].last_year_billable) || 0
        totalWIPAmount = Number(kpiData[0].total_wip) || 0
      } else {
        // Fallback: Fetch data and aggregate in JS (works without migration)
        const [
          currentRevenueData,
          lastRevenueData,
          currentBillableData,
          lastBillableData,
          wipData,
        ] = await Promise.all([
          supabase
            .from('invoice_uploads')
            .select('amount')
            .eq('organization_id', organizationId)
            .gte('date', currentYearStart)
            .lte('date', currentYearEnd),
          supabase
            .from('invoice_uploads')
            .select('amount')
            .eq('organization_id', organizationId)
            .gte('date', lastYearStart)
            .lte('date', lastYearEnd),
          supabase
            .from('timesheet_uploads')
            .select('billable_amount')
            .eq('organization_id', organizationId)
            .gte('date', currentYearStart)
            .lte('date', currentYearEnd),
          supabase
            .from('timesheet_uploads')
            .select('billable_amount')
            .eq('organization_id', organizationId)
            .gte('date', lastYearStart)
            .lte('date', lastYearEnd),
          supabase
            .from('wip_timesheet_uploads')
            .select('billable_amount')
            .eq('organization_id', organizationId),
        ])

        // Aggregate results in JS
        currentYearRevenue = (currentRevenueData.data || []).reduce((sum, row) => {
          const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0
          return sum + amount
        }, 0)

        lastYearRevenue = (lastRevenueData.data || []).reduce((sum, row) => {
          const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0
          return sum + amount
        }, 0)

        currentYearBillableAmount = (currentBillableData.data || []).reduce((sum, row) => {
          const amount = typeof row.billable_amount === 'number' ? row.billable_amount : parseFloat(row.billable_amount || '0') || 0
          return sum + amount
        }, 0)

        lastYearBillableAmount = (lastBillableData.data || []).reduce((sum, row) => {
          const amount = typeof row.billable_amount === 'number' ? row.billable_amount : parseFloat(row.billable_amount || '0') || 0
          return sum + amount
        }, 0)

        totalWIPAmount = (wipData.data || []).reduce((sum, row) => {
          const amount = typeof row.billable_amount === 'number' ? row.billable_amount : parseFloat(row.billable_amount || '0') || 0
          return sum + amount
        }, 0)
      }
    } else {
      // With filters, fetch filtered data and aggregate in JS
      const buildBillableQuery = (startDate: string, endDate: string) => {
        let query = supabase
          .from('timesheet_uploads')
          .select('billable_amount')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate)
        
        filters.forEach((filter) => {
          if (filter.value && filter.value !== 'all') {
            switch (filter.type) {
              case 'staff':
                query = query.eq('staff', filter.value)
                break
              case 'client_group':
                query = query.eq('client_group', filter.value)
                break
              case 'account_manager':
                query = query.eq('account_manager', filter.value)
                break
              case 'job_manager':
                query = query.eq('job_manager', filter.value)
                break
              case 'job_name':
                if (filter.operator === 'not_contains') {
                  query = query.or(`job_name.not.ilike.%${filter.value}%,job_name.is.null`)
                } else {
                  query = query.ilike('job_name', `%${filter.value}%`)
                }
                break
            }
          }
        })
        
        return query
      }

      const [
        currentRevenueData,
        lastRevenueData,
        currentBillableData,
        lastBillableData,
        wipData,
      ] = await Promise.all([
        supabase
          .from('invoice_uploads')
          .select('amount')
          .eq('organization_id', organizationId)
          .gte('date', currentYearStart)
          .lte('date', currentYearEnd),
        supabase
          .from('invoice_uploads')
          .select('amount')
          .eq('organization_id', organizationId)
          .gte('date', lastYearStart)
          .lte('date', lastYearEnd),
        buildBillableQuery(currentYearStart, currentYearEnd),
        buildBillableQuery(lastYearStart, lastYearEnd),
        supabase
          .from('wip_timesheet_uploads')
          .select('billable_amount')
          .eq('organization_id', organizationId),
      ])

      // Aggregate results in JS
      currentYearRevenue = (currentRevenueData.data || []).reduce((sum, row) => {
        const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0
        return sum + amount
      }, 0)

      lastYearRevenue = (lastRevenueData.data || []).reduce((sum, row) => {
        const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0
        return sum + amount
      }, 0)

      currentYearBillableAmount = (currentBillableData.data || []).reduce((sum, row) => {
        const amount = typeof row.billable_amount === 'number' ? row.billable_amount : parseFloat(row.billable_amount || '0') || 0
        return sum + amount
      }, 0)

      lastYearBillableAmount = (lastBillableData.data || []).reduce((sum, row) => {
        const amount = typeof row.billable_amount === 'number' ? row.billable_amount : parseFloat(row.billable_amount || '0') || 0
        return sum + amount
      }, 0)

      totalWIPAmount = (wipData.data || []).reduce((sum, row) => {
        const amount = typeof row.billable_amount === 'number' ? row.billable_amount : parseFloat(row.billable_amount || '0') || 0
        return sum + amount
      }, 0)
    }

    // Calculate percentage changes
    const revenuePercentageChange = Math.abs(lastYearRevenue) > 0.01
      ? ((currentYearRevenue - lastYearRevenue) / Math.abs(lastYearRevenue)) * 100
      : (Math.abs(currentYearRevenue) > 0.01 ? (currentYearRevenue > 0 ? 100 : -100) : null)
    
    const billableAmountPercentageChange = Math.abs(lastYearBillableAmount) > 0.01
      ? ((currentYearBillableAmount - lastYearBillableAmount) / Math.abs(lastYearBillableAmount)) * 100
      : (Math.abs(currentYearBillableAmount) > 0.01 ? (currentYearBillableAmount > 0 ? 100 : -100) : null)

    return NextResponse.json({
      revenue: {
        currentYear: Math.round(currentYearRevenue * 100) / 100,
        lastYear: Math.round(lastYearRevenue * 100) / 100,
        percentageChange: revenuePercentageChange !== null ? Math.round(revenuePercentageChange * 10) / 10 : null,
      },
      billableAmount: {
        currentYear: Math.round(currentYearBillableAmount * 100) / 100,
        lastYear: Math.round(lastYearBillableAmount * 100) / 100,
        percentageChange: billableAmountPercentageChange !== null ? Math.round(billableAmountPercentageChange * 10) / 10 : null,
      },
      wipAmount: Math.round(totalWIPAmount * 100) / 100,
    }, {
      headers: {
        // Allow caching for 60 seconds, revalidate in background for up to 5 minutes
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}
