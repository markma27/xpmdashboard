'use client'

import useSWR from 'swr'
import { DashboardRevenueByPartnerChart } from './dashboard-revenue-by-partner-chart'
import { DashboardBillableByPartnerChart } from './dashboard-billable-by-partner-chart'
import { DashboardRevenueByClientGroupChart } from './dashboard-revenue-by-client-group-chart'
import { DashboardBillableByClientGroupChart } from './dashboard-billable-by-client-group-chart'
import { dashboardDataFetcher, dashboardSwrConfig } from '@/lib/hooks/use-dashboard-data'

interface DashboardPartnerChartsClientProps {
  organizationId: string
  asOfDate?: string
}

interface PartnerRevenueData {
  partner: string
  'Current Year': number
  'Last Year': number
}

interface PartnerBillableData {
  partner: string
  'Current Year': number
  'Last Year': number
}

interface ClientGroupRevenueData {
  clientGroup: string
  'Current Year': number
  'Last Year': number
}

interface ClientGroupBillableData {
  clientGroup: string
  'Current Year': number
  'Last Year': number
}

type PartnerChartsBundle = {
  revenueData: PartnerRevenueData[]
  billableData: PartnerBillableData[]
  clientGroupRevenueData: ClientGroupRevenueData[]
  clientGroupBillableData: ClientGroupBillableData[]
}

export function DashboardPartnerChartsClient({ organizationId, asOfDate }: DashboardPartnerChartsClientProps) {
  const baseParams = `organizationId=${organizationId}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`

  const { data, error, isLoading } = useSWR<PartnerChartsBundle>(
    organizationId ? ['dashboard-partner-charts', baseParams] : null,
    async () => {
      const [revenueData, billableData, clientGroupRevenueData, clientGroupBillableData] = await Promise.all([
        dashboardDataFetcher(`/api/dashboard/revenue-by-partner?${baseParams}`),
        dashboardDataFetcher(`/api/dashboard/billable-by-partner?${baseParams}`),
        dashboardDataFetcher(`/api/dashboard/revenue-by-client-group?${baseParams}`),
        dashboardDataFetcher(`/api/dashboard/billable-by-client-group?${baseParams}`),
      ])
      return {
        revenueData,
        billableData,
        clientGroupRevenueData,
        clientGroupBillableData,
      }
    },
    dashboardSwrConfig
  )

  const revenueData = data?.revenueData ?? []
  const billableData = data?.billableData ?? []
  const clientGroupRevenueData = data?.clientGroupRevenueData ?? []
  const clientGroupBillableData = data?.clientGroupBillableData ?? []

  if (error) {
    return (
      <div className="grid gap-2.5 md:grid-cols-2">
        <div className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load dashboard charts'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 md:grid-cols-2">
        <DashboardRevenueByPartnerChart data={revenueData} loading={isLoading} />
        <DashboardBillableByPartnerChart data={billableData} loading={isLoading} />
      </div>
      <div className="grid gap-2.5 md:grid-cols-2">
        <DashboardRevenueByClientGroupChart data={clientGroupRevenueData} loading={isLoading} />
        <DashboardBillableByClientGroupChart data={clientGroupBillableData} loading={isLoading} />
      </div>
    </div>
  )
}
