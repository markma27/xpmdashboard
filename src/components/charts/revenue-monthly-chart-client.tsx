'use client'

import useSWR from 'swr'
import { RevenueMonthlyChart } from './revenue-monthly-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'

interface MonthlyRevenueData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface RevenueMonthlyChartClientProps {
  organizationId: string
  selectedPartner?: string | null
  selectedClientManager?: string | null
  selectedMonth?: string | null
  onMonthClick?: (month: string | null) => void
}

// SWR fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch invoice data')
  return res.json()
}

// SWR config
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 60000,
  refreshInterval: 5 * 60 * 1000,
  errorRetryCount: 3,
}

export function RevenueMonthlyChartClient({ 
  organizationId,
  selectedPartner,
  selectedClientManager,
  selectedMonth,
  onMonthClick
}: RevenueMonthlyChartClientProps) {
  // Build URL with optional filters
  const params = new URLSearchParams({ organizationId })
  if (selectedPartner) {
    params.append('partner', selectedPartner)
  }
  if (selectedClientManager) {
    params.append('clientManager', selectedClientManager)
  }

  const { data, error, isLoading } = useSWR<MonthlyRevenueData[]>(
    `/api/revenue/monthly?${params}`,
    fetcher,
    swrConfig
  )

  if (isLoading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Monthly Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-destructive">Error: {error.message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Monthly Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">
              No data available. Please upload invoice data first.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Monthly Invoices</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <RevenueMonthlyChart 
          data={data} 
          selectedMonth={selectedMonth}
          onMonthClick={onMonthClick}
        />
      </CardContent>
    </Card>
  )
}
