import type { SupabaseClient } from '@supabase/supabase-js'
import {
  activeDashboardKpiFilters,
  dashboardFiltersToBillableRpcParams,
} from '@/lib/billable-rpc-params'

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

type DashboardKpisRow = {
  current_year_revenue: unknown
  last_year_revenue: unknown
  current_year_billable: unknown
  last_year_billable: unknown
  total_wip: unknown
}

function buildPayloadFromKpiRow(kpiData: DashboardKpisRow): DashboardKpiPayload {
  const currentYearRevenue = Number(kpiData.current_year_revenue) || 0
  const lastYearRevenue = Number(kpiData.last_year_revenue) || 0
  const currentYearBillableAmount = Number(kpiData.current_year_billable) || 0
  const lastYearBillableAmount = Number(kpiData.last_year_billable) || 0
  const totalWIPAmount = Number(kpiData.total_wip) || 0

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
  const active = activeDashboardKpiFilters(filters)

  if (active.length === 0) {
    const { data: kpiData, error: kpiError } = await supabase.rpc('get_dashboard_kpis', {
      p_organization_id: organizationId,
      p_current_year_start: currentYearStart,
      p_current_year_end: currentYearEnd,
      p_last_year_start: lastYearStart,
      p_last_year_end: lastYearEnd,
    })

    if (kpiError || !kpiData || kpiData.length === 0) {
      throw new Error(kpiError?.message || 'Failed to load dashboard KPIs')
    }

    return buildPayloadFromKpiRow(kpiData[0] as DashboardKpisRow)
  }

  const p = dashboardFiltersToBillableRpcParams(active)
  const { data: kpiData, error: kpiError } = await supabase.rpc('get_dashboard_kpis_filtered', {
    p_organization_id: organizationId,
    p_current_year_start: currentYearStart,
    p_current_year_end: currentYearEnd,
    p_last_year_start: lastYearStart,
    p_last_year_end: lastYearEnd,
    p_staff: p.staff,
    p_client_group: p.clientGroup,
    p_account_manager: p.accountManager,
    p_job_manager: p.jobManager,
    p_job_name: p.jobName,
    p_job_name_operator: p.jobNameOperator,
  })

  if (kpiError || !kpiData || kpiData.length === 0) {
    throw new Error(kpiError?.message || 'Failed to load filtered dashboard KPIs')
  }

  return buildPayloadFromKpiRow(kpiData[0] as DashboardKpisRow)
}
