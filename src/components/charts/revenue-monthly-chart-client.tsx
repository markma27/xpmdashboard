'use client'

import { useEffect, useState } from 'react'
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

export function RevenueMonthlyChartClient({ 
  organizationId,
  selectedPartner,
  selectedClientManager,
  selectedMonth,
  onMonthClick
}: RevenueMonthlyChartClientProps) {
  const [data, setData] = useState<MonthlyRevenueData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        // Build query with optional filters
        let url = `/api/revenue/monthly?organizationId=${organizationId}&t=${Date.now()}`
        if (selectedPartner) {
          url += `&partner=${encodeURIComponent(selectedPartner)}`
        }
        if (selectedClientManager) {
          url += `&clientManager=${encodeURIComponent(selectedClientManager)}`
        }
        
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch invoice data')
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
  }, [organizationId, selectedPartner, selectedClientManager])

  if (loading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Billings - monthly</CardTitle>
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
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Billings - monthly</CardTitle>
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
      <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Billings - monthly</CardTitle>
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

