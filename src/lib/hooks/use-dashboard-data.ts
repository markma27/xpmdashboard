'use client'

import useSWR from 'swr'

// Default fetcher for dashboard/report SWR hooks (exported for chart components)
export async function dashboardDataFetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('An error occurred while fetching the data.')
  }
  return res.json()
}

export const dashboardSwrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 60000,
  refreshInterval: 5 * 60 * 1000,
  errorRetryCount: 3,
}

// Dashboard KPI data hook
interface DashboardKPIData {
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

export function useDashboardKPI(organizationId: string, asOfDate?: string) {
  const params = new URLSearchParams({
    organizationId,
    ...(asOfDate && { asOfDate }),
  })
  
  const { data, error, isLoading, mutate } = useSWR<DashboardKPIData>(
    `/api/dashboard/kpi?${params}`,
    dashboardDataFetcher,
    dashboardSwrConfig
  )

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
  }
}

// Productivity KPI data hook
interface ProductivityKPIData {
  ytdBillablePercentage: number
  lastYearBillablePercentage: number
  targetBillablePercentage: number
  ytdAverageRate: number
  lastYearAverageRate: number
}

export function useProductivityKPI(
  organizationId: string,
  asOfDate?: string,
  filters?: any[]
) {
  const params = new URLSearchParams({
    organizationId,
    ...(asOfDate && { asOfDate }),
    ...(filters && filters.length > 0 && { filters: JSON.stringify(filters) }),
  })

  const { data, error, isLoading, mutate } = useSWR<ProductivityKPIData>(
    `/api/productivity/kpi?${params}`,
    dashboardDataFetcher,
    dashboardSwrConfig
  )

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
  }
}

// Recoverability KPI data hook
interface RecoverabilityKPIData {
  currentYearAmount: number
  lastYearAmount: number
  percentageChange: number | null
  currentYearPercentage: number
  lastYearPercentage: number
}

export function useRecoverabilityKPI(
  organizationId: string,
  asOfDate?: string,
  filters?: any[]
) {
  const params = new URLSearchParams({
    organizationId,
    ...(asOfDate && { asOfDate }),
    ...(filters && filters.length > 0 && { filters: JSON.stringify(filters) }),
  })

  const { data, error, isLoading, mutate } = useSWR<RecoverabilityKPIData>(
    `/api/recoverability/kpi?${params}`,
    dashboardDataFetcher,
    dashboardSwrConfig
  )

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
  }
}

// Monthly revenue data hook
interface MonthlyRevenueData {
  month: string
  'Current Year': number
  'Last Year': number
}

export function useMonthlyRevenue(
  organizationId: string,
  partner?: string | null,
  clientManager?: string | null
) {
  const params = new URLSearchParams({
    organizationId,
    ...(partner && { partner }),
    ...(clientManager && { clientManager }),
  })

  const { data, error, isLoading, mutate } = useSWR<MonthlyRevenueData[]>(
    `/api/revenue/monthly?${params}`,
    dashboardDataFetcher,
    dashboardSwrConfig
  )

  return {
    data: data || [],
    error,
    isLoading,
    refresh: mutate,
  }
}

// Monthly billable data hook
interface MonthlyBillableData {
  month: string
  'Current Year': number
  'Last Year': number
}

export function useMonthlyBillable(
  organizationId: string,
  staff?: string | null,
  filters?: string
) {
  const params = new URLSearchParams({
    organizationId,
    ...(staff && { staff }),
    ...(filters && { filters }),
  })

  const { data, error, isLoading, mutate } = useSWR<MonthlyBillableData[]>(
    `/api/billable/monthly?${params}`,
    dashboardDataFetcher,
    dashboardSwrConfig
  )

  return {
    data: data || [],
    error,
    isLoading,
    refresh: mutate,
  }
}

// Saved filters hook
interface SavedFiltersData {
  filters: any[]
}

export function useSavedFilters(organizationId: string) {
  const { data, error, isLoading, mutate } = useSWR<SavedFiltersData>(
    `/api/billable/saved-filters?organizationId=${organizationId}`,
    dashboardDataFetcher,
    {
      ...dashboardSwrConfig,
      refreshInterval: 0, // Don't auto-refresh filters
    }
  )

  return {
    filters: data?.filters || [],
    error,
    isLoading,
    refresh: mutate,
  }
}

// Last upload date hook (used for "last updated" display)
export function useLastUpload(
  organizationId: string,
  type: 'timesheet' | 'invoice' | 'wip'
) {
  const endpoint = type === 'invoice' 
    ? `/api/invoice/last-upload?organizationId=${organizationId}`
    : type === 'wip'
    ? `/api/wip/last-upload?organizationId=${organizationId}`
    : `/api/timesheet/last-upload?organizationId=${organizationId}`

  const { data, error, isLoading, mutate } = useSWR<{ lastUploadDate: string | null }>(
    endpoint,
    dashboardDataFetcher,
    {
      ...dashboardSwrConfig,
      refreshInterval: 0, // Don't auto-refresh
    }
  )

  return {
    lastUploadDate: data?.lastUploadDate || null,
    error,
    isLoading,
    refresh: mutate,
  }
}

// Staff list hook (for dropdowns)
export function useStaffList(organizationId: string) {
  const { data, error, isLoading, mutate } = useSWR<string[]>(
    `/api/billable/staff?organizationId=${organizationId}`,
    dashboardDataFetcher,
    {
      ...dashboardSwrConfig,
      refreshInterval: 0, // Staff list doesn't change often
    }
  )

  return {
    staff: data || [],
    error,
    isLoading,
    refresh: mutate,
  }
}

// Partners list hook (for dropdowns)
export function usePartnersList(organizationId: string) {
  const { data, error, isLoading, mutate } = useSWR<string[]>(
    `/api/billable/partners?organizationId=${organizationId}`,
    dashboardDataFetcher,
    {
      ...dashboardSwrConfig,
      refreshInterval: 0,
    }
  )

  return {
    partners: data || [],
    error,
    isLoading,
    refresh: mutate,
  }
}

// Client managers list hook (for dropdowns)
export function useClientManagersList(organizationId: string) {
  const { data, error, isLoading, mutate } = useSWR<string[]>(
    `/api/billable/client-managers?organizationId=${organizationId}`,
    dashboardDataFetcher,
    {
      ...dashboardSwrConfig,
      refreshInterval: 0,
    }
  )

  return {
    clientManagers: data || [],
    error,
    isLoading,
    refresh: mutate,
  }
}

