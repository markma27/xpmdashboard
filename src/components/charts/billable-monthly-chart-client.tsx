'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { BillableMonthlyChart } from './billable-monthly-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'
import { BillableFilter } from './billable-filters'
import { useBillableReport } from './billable-report-context'
import { dashboardDataFetcher, dashboardSwrConfig } from '@/lib/hooks/use-dashboard-data'

interface MonthlyBillableData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface BillableMonthlyChartClientProps {
  organizationId: string
  selectedMonth?: string | null
  onMonthClick?: (month: string | null) => void
  filters?: BillableFilter[]
}

export function BillableMonthlyChartClient({
  organizationId,
  selectedMonth,
  onMonthClick,
  filters = [],
}: BillableMonthlyChartClientProps) {
  const { filtersLoaded } = useBillableReport()

  const filtersString = useMemo(() => {
    if (filters.length === 0) return ''
    const filtersParam = filters
      .filter((f) => f.value && f.value !== 'all' && f.value.trim() !== '')
      .map((f) => {
        if (f.operator) {
          return `${f.type}:${f.operator}:${encodeURIComponent(f.value)}`
        }
        return `${f.type}:${encodeURIComponent(f.value)}`
      })
      .join('|')
    return filtersParam
  }, [filters])

  const swrKey = useMemo(() => {
    if (!filtersLoaded || !organizationId) return null
    const base = `/api/billable/monthly?organizationId=${encodeURIComponent(organizationId)}`
    if (filtersString) {
      return `${base}&filters=${encodeURIComponent(filtersString)}`
    }
    return base
  }, [filtersLoaded, organizationId, filtersString])

  const { data, error, isLoading } = useSWR<MonthlyBillableData[]>(
    swrKey,
    dashboardDataFetcher,
    dashboardSwrConfig
  )

  const loading = !filtersLoaded || isLoading

  if (loading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Monthly Billable $</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-destructive">Error: {error.message || 'An error occurred'}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = data ?? []

  if (chartData.length === 0) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Monthly Billable $</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">
              No data available. Please upload timesheet data first.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Monthly Billable $</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <BillableMonthlyChart data={chartData} selectedMonth={selectedMonth} onMonthClick={onMonthClick} />
      </CardContent>
    </Card>
  )
}
