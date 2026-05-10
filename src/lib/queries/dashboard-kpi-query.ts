import type { SupabaseClient } from '@supabase/supabase-js'

export type DashboardKpiFilter = {
  type: string
  value: string
  operator?: string
}

export type DashboardKpiPayload = {
  revenue: {
    currentYear: number
    lastYear: number
    percentageChange: number | null
  }
  billableAmount: {
    currentYear: number
    lastYear: number
    percentageChange: number | null
  }
  wipAmount: number
}

/**
 * Core dashboard KPI aggregation (shared by API route and server cache).
 */
export async function computeDashboardKpiPayload(
  supabase: SupabaseClient,
  {
    organizationId,
    filters,
    currentYearStart,
    currentYearEnd,
    lastYearStart,
    lastYearEnd,
  }: {
    organizationId: string
    filters: DashboardKpiFilter[]
    currentYearStart: string
    currentYearEnd: string
    lastYearStart: string
    lastYearEnd: string
  }
): Promise<DashboardKpiPayload> {
  const hasFilters = filters.length > 0

  let currentYearRevenue = 0
  let lastYearRevenue = 0
  let currentYearBillableAmount = 0
  let lastYearBillableAmount = 0
  let totalWIPAmount = 0

  if (!hasFilters) {
    const { data: kpiData, error: kpiError } = await supabase.rpc('get_dashboard_kpis', {
      p_organization_id: organizationId,
      p_current_year_start: currentYearStart,
      p_current_year_end: currentYearEnd,
      p_last_year_start: lastYearStart,
      p_last_year_end: lastYearEnd,
    })

    if (!kpiError && kpiData && kpiData.length > 0) {
      currentYearRevenue = Number(kpiData[0].current_year_revenue) || 0
      lastYearRevenue = Number(kpiData[0].last_year_revenue) || 0
      currentYearBillableAmount = Number(kpiData[0].current_year_billable) || 0
      lastYearBillableAmount = Number(kpiData[0].last_year_billable) || 0
      totalWIPAmount = Number(kpiData[0].total_wip) || 0
    } else {
      const fetchAllData = async (
        table: string,
        selectFields: string,
        dateField: string,
        startDate: string,
        endDate: string | null = null,
        requireBillable = false
      ) => {
        let allData: any[] = []
        let page = 0
        const pageSize = 1000
        let hasMore = true

        while (hasMore) {
          let query = supabase
            .from(table)
            .select(selectFields)
            .eq('organization_id', organizationId)

          if (requireBillable && table === 'timesheet_uploads') {
            query = query.eq('billable', true)
          }

          if (startDate && endDate) {
            query = query.gte(dateField, startDate).lte(dateField, endDate)
          }

          const { data: pageData, error: pageError } = await query.range(
            page * pageSize,
            (page + 1) * pageSize - 1
          )

          if (pageError) {
            throw new Error(`Failed to fetch ${table} data: ${pageError.message}`)
          }

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

      const [
        currentRevenueData,
        lastRevenueData,
        currentBillableData,
        lastBillableData,
        wipData,
      ] = await Promise.all([
        fetchAllData('invoice_uploads', 'amount', 'date', currentYearStart, currentYearEnd, false),
        fetchAllData('invoice_uploads', 'amount', 'date', lastYearStart, lastYearEnd, false),
        fetchAllData('timesheet_uploads', 'billable_amount', 'date', currentYearStart, currentYearEnd, true),
        fetchAllData('timesheet_uploads', 'billable_amount', 'date', lastYearStart, lastYearEnd, true),
        fetchAllData('wip_timesheet_uploads', 'billable_amount', 'date', '', null, false),
      ])

      currentYearRevenue = (currentRevenueData || []).reduce((sum, row) => {
        const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0
        return sum + amount
      }, 0)

      lastYearRevenue = (lastRevenueData || []).reduce((sum, row) => {
        const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0
        return sum + amount
      }, 0)

      currentYearBillableAmount = (currentBillableData || []).reduce((sum, row) => {
        const amount =
          typeof row.billable_amount === 'number'
            ? row.billable_amount
            : parseFloat(row.billable_amount || '0') || 0
        return sum + amount
      }, 0)

      lastYearBillableAmount = (lastBillableData || []).reduce((sum, row) => {
        const amount =
          typeof row.billable_amount === 'number'
            ? row.billable_amount
            : parseFloat(row.billable_amount || '0') || 0
        return sum + amount
      }, 0)

      totalWIPAmount = (wipData || []).reduce((sum, row) => {
        const amount =
          typeof row.billable_amount === 'number'
            ? row.billable_amount
            : parseFloat(row.billable_amount || '0') || 0
        return sum + amount
      }, 0)
    }
  } else {
    const fetchAllBillableData = async (startDate: string, endDate: string) => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        let query = supabase
          .from('timesheet_uploads')
          .select('billable_amount')
          .eq('organization_id', organizationId)
          .eq('billable', true)
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

        const { data: pageData, error: pageError } = await query.range(
          page * pageSize,
          (page + 1) * pageSize - 1
        )

        if (pageError) {
          throw new Error(`Failed to fetch billable data: ${pageError.message}`)
        }

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

    const fetchAllInvoiceData = async (startDate: string, endDate: string) => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('invoice_uploads')
          .select('amount')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate)
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (pageError) {
          throw new Error(`Failed to fetch invoice data: ${pageError.message}`)
        }

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

    const fetchAllWipData = async () => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('wip_timesheet_uploads')
          .select('billable_amount')
          .eq('organization_id', organizationId)
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (pageError) {
          throw new Error(`Failed to fetch WIP data: ${pageError.message}`)
        }

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

    const [currentRevenueData, lastRevenueData, currentBillableData, lastBillableData, wipData] =
      await Promise.all([
        fetchAllInvoiceData(currentYearStart, currentYearEnd),
        fetchAllInvoiceData(lastYearStart, lastYearEnd),
        fetchAllBillableData(currentYearStart, currentYearEnd),
        fetchAllBillableData(lastYearStart, lastYearEnd),
        fetchAllWipData(),
      ])

    currentYearRevenue = (currentRevenueData || []).reduce((sum, row) => {
      const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0
      return sum + amount
    }, 0)

    lastYearRevenue = (lastRevenueData || []).reduce((sum, row) => {
      const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0
      return sum + amount
    }, 0)

    currentYearBillableAmount = (currentBillableData || []).reduce((sum, row) => {
      const amount =
        typeof row.billable_amount === 'number'
          ? row.billable_amount
          : parseFloat(row.billable_amount || '0') || 0
      return sum + amount
    }, 0)

    lastYearBillableAmount = (lastBillableData || []).reduce((sum, row) => {
      const amount =
        typeof row.billable_amount === 'number'
          ? row.billable_amount
          : parseFloat(row.billable_amount || '0') || 0
      return sum + amount
    }, 0)

    totalWIPAmount = (wipData || []).reduce((sum, row) => {
      const amount =
        typeof row.billable_amount === 'number'
          ? row.billable_amount
          : parseFloat(row.billable_amount || '0') || 0
      return sum + amount
    }, 0)
  }

  const revenuePercentageChange =
    Math.abs(lastYearRevenue) > 0.01
      ? ((currentYearRevenue - lastYearRevenue) / Math.abs(lastYearRevenue)) * 100
      : Math.abs(currentYearRevenue) > 0.01
        ? currentYearRevenue > 0
          ? 100
          : -100
        : null

  const billableAmountPercentageChange =
    Math.abs(lastYearBillableAmount) > 0.01
      ? ((currentYearBillableAmount - lastYearBillableAmount) / Math.abs(lastYearBillableAmount)) * 100
      : Math.abs(currentYearBillableAmount) > 0.01
        ? currentYearBillableAmount > 0
          ? 100
          : -100
        : null

  return {
    revenue: {
      currentYear: Math.round(currentYearRevenue * 100) / 100,
      lastYear: Math.round(lastYearRevenue * 100) / 100,
      percentageChange: revenuePercentageChange !== null ? Math.round(revenuePercentageChange * 10) / 10 : null,
    },
    billableAmount: {
      currentYear: Math.round(currentYearBillableAmount * 100) / 100,
      lastYear: Math.round(lastYearBillableAmount * 100) / 100,
      percentageChange:
        billableAmountPercentageChange !== null
          ? Math.round(billableAmountPercentageChange * 10) / 10
          : null,
    },
    wipAmount: Math.round(totalWIPAmount * 100) / 100,
  }
}
