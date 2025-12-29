'use client'

import { useEffect, useState } from 'react'
import { DashboardRevenueByPartnerChart } from './dashboard-revenue-by-partner-chart'
import { DashboardBillableByPartnerChart } from './dashboard-billable-by-partner-chart'
import { DashboardRevenueByClientGroupChart } from './dashboard-revenue-by-client-group-chart'
import { DashboardBillableByClientGroupChart } from './dashboard-billable-by-client-group-chart'

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

export function DashboardPartnerChartsClient({ organizationId, asOfDate }: DashboardPartnerChartsClientProps) {
  const [revenueData, setRevenueData] = useState<PartnerRevenueData[]>([])
  const [billableData, setBillableData] = useState<PartnerBillableData[]>([])
  const [clientGroupRevenueData, setClientGroupRevenueData] = useState<ClientGroupRevenueData[]>([])
  const [clientGroupBillableData, setClientGroupBillableData] = useState<ClientGroupBillableData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        const baseParams = `organizationId=${organizationId}&t=${Date.now()}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`
        
        // Fetch all datasets in parallel
        const [revenueResponse, billableResponse, clientGroupRevenueResponse, clientGroupBillableResponse] = await Promise.all([
          fetch(`/api/dashboard/revenue-by-partner?${baseParams}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }),
          fetch(`/api/dashboard/billable-by-partner?${baseParams}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }),
          fetch(`/api/dashboard/revenue-by-client-group?${baseParams}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }),
          fetch(`/api/dashboard/billable-by-client-group?${baseParams}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }),
        ])
        
        if (!revenueResponse.ok) {
          throw new Error('Failed to fetch invoice by partner data')
        }
        
        if (!billableResponse.ok) {
          throw new Error('Failed to fetch billable by partner data')
        }
        
        if (!clientGroupRevenueResponse.ok) {
          throw new Error('Failed to fetch invoice by client group data')
        }
        
        if (!clientGroupBillableResponse.ok) {
          throw new Error('Failed to fetch billable by client group data')
        }
        
        const revenueDataResult = await revenueResponse.json()
        const billableDataResult = await billableResponse.json()
        const clientGroupRevenueDataResult = await clientGroupRevenueResponse.json()
        const clientGroupBillableDataResult = await clientGroupBillableResponse.json()
        
        setRevenueData(revenueDataResult)
        setBillableData(billableDataResult)
        setClientGroupRevenueData(clientGroupRevenueDataResult)
        setClientGroupBillableData(clientGroupBillableDataResult)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, asOfDate])

  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <DashboardRevenueByPartnerChart data={revenueData} loading={loading} />
        <DashboardBillableByPartnerChart data={billableData} loading={loading} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <DashboardRevenueByClientGroupChart data={clientGroupRevenueData} loading={loading} />
        <DashboardBillableByClientGroupChart data={clientGroupBillableData} loading={loading} />
      </div>
    </div>
  )
}
