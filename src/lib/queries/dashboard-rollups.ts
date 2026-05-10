import type { SupabaseClient } from '@supabase/supabase-js'

export type DashboardPartnerChartRow = {
  partner: string
  'Current Year': number
  'Last Year': number
}

export type DashboardClientGroupChartRow = {
  clientGroup: string
  'Current Year': number
  'Last Year': number
}

type FyWindows = {
  organizationId: string
  currentYearStart: string
  currentYearEnd: string
  lastYearStart: string
  lastYearEnd: string
}

export async function fetchDashboardBillableByPartner(
  supabase: SupabaseClient,
  p: FyWindows
): Promise<DashboardPartnerChartRow[]> {
  const { data, error } = await supabase.rpc('get_dashboard_billable_by_partner', {
    p_organization_id: p.organizationId,
    p_current_year_start: p.currentYearStart,
    p_current_year_end: p.currentYearEnd,
    p_last_year_start: p.lastYearStart,
    p_last_year_end: p.lastYearEnd,
  })
  if (error) throw new Error(`Failed to load billable by partner: ${error.message}`)
  return (data ?? []).map((row: { partner: string; current_year_total: unknown; last_year_total: unknown }) => ({
    partner: row.partner,
    'Current Year': Number(row.current_year_total) || 0,
    'Last Year': Number(row.last_year_total) || 0,
  }))
}

export async function fetchDashboardRevenueByPartner(
  supabase: SupabaseClient,
  p: FyWindows
): Promise<DashboardPartnerChartRow[]> {
  const { data, error } = await supabase.rpc('get_dashboard_revenue_by_partner', {
    p_organization_id: p.organizationId,
    p_current_year_start: p.currentYearStart,
    p_current_year_end: p.currentYearEnd,
    p_last_year_start: p.lastYearStart,
    p_last_year_end: p.lastYearEnd,
  })
  if (error) throw new Error(`Failed to load revenue by partner: ${error.message}`)
  return (data ?? []).map((row: { partner: string; current_year_total: unknown; last_year_total: unknown }) => ({
    partner: row.partner,
    'Current Year': Number(row.current_year_total) || 0,
    'Last Year': Number(row.last_year_total) || 0,
  }))
}

export async function fetchDashboardBillableByClientGroup(
  supabase: SupabaseClient,
  p: FyWindows,
  limit = 10
): Promise<DashboardClientGroupChartRow[]> {
  const { data, error } = await supabase.rpc('get_dashboard_billable_by_client_group', {
    p_organization_id: p.organizationId,
    p_current_year_start: p.currentYearStart,
    p_current_year_end: p.currentYearEnd,
    p_last_year_start: p.lastYearStart,
    p_last_year_end: p.lastYearEnd,
    p_limit: limit,
  })
  if (error) throw new Error(`Failed to load billable by client group: ${error.message}`)
  return (data ?? []).map(
    (row: { client_group: string; current_year_total: unknown; last_year_total: unknown }) => ({
      clientGroup: row.client_group,
      'Current Year': Number(row.current_year_total) || 0,
      'Last Year': Number(row.last_year_total) || 0,
    })
  )
}

export async function fetchDashboardRevenueByClientGroup(
  supabase: SupabaseClient,
  p: FyWindows,
  limit = 10
): Promise<DashboardClientGroupChartRow[]> {
  const { data, error } = await supabase.rpc('get_dashboard_revenue_by_client_group', {
    p_organization_id: p.organizationId,
    p_current_year_start: p.currentYearStart,
    p_current_year_end: p.currentYearEnd,
    p_last_year_start: p.lastYearStart,
    p_last_year_end: p.lastYearEnd,
    p_limit: limit,
  })
  if (error) throw new Error(`Failed to load revenue by client group: ${error.message}`)
  return (data ?? []).map(
    (row: { client_group: string; current_year_total: unknown; last_year_total: unknown }) => ({
      clientGroup: row.client_group,
      'Current Year': Number(row.current_year_total) || 0,
      'Last Year': Number(row.last_year_total) || 0,
    })
  )
}
