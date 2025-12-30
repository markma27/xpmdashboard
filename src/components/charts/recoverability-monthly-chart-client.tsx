'use client'

import { useEffect, useState, useMemo } from 'react'
import { RecoverabilityMonthlyChart } from './recoverability-monthly-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'
import { BillableFilter } from './billable-filters'

interface MonthlyRecoverabilityData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface RecoverabilityMonthlyChartClientProps {
  organizationId: string
  selectedMonth?: string | null
  onMonthClick?: (month: string | null) => void
  filters?: BillableFilter[]
}

export function RecoverabilityMonthlyChartClient({ 
  organizationId,
  selectedMonth,
  onMonthClick,
  filters = []
}: RecoverabilityMonthlyChartClientProps) {
  const [data, setData] = useState<MonthlyRecoverabilityData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Memoize filters string to avoid unnecessary re-renders
  const filtersString = useMemo(() => JSON.stringify(filters), [filters])

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        // Build query with filters
        let url = `/api/recoverability/monthly?organizationId=${organizationId}&t=${Date.now()}`
        if (filters.length > 0) {
          url += `&filters=${encodeURIComponent(filtersString)}`
        }
        
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch recoverability data')
        }
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, filtersString])

  if (loading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Write On / (Off) $ by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-destructive">Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Write On / (Off) $ by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">
              No data available. Please upload recoverability timesheet data first.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Write On / (Off) $ by Month</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <RecoverabilityMonthlyChart 
          data={data} 
          selectedMonth={selectedMonth}
          onMonthClick={onMonthClick}
        />
      </CardContent>
    </Card>
  )
}

