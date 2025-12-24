'use client'

import { useEffect, useState } from 'react'
import { RevenueMonthlyChart } from './revenue-monthly-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface MonthlyRevenueData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface RevenueMonthlyChartClientProps {
  organizationId: string
}

export function RevenueMonthlyChartClient({ organizationId }: RevenueMonthlyChartClientProps) {
  const [data, setData] = useState<MonthlyRevenueData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(
          `/api/revenue/monthly?organizationId=${organizationId}`
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch revenue data')
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
  }, [organizationId])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billings - monthly</CardTitle>
          <CardDescription>Monthly revenue comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">Loading chart data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billings - monthly</CardTitle>
          <CardDescription>Monthly revenue comparison</CardDescription>
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
      <Card>
        <CardHeader>
          <CardTitle>Billings - monthly</CardTitle>
          <CardDescription>Monthly revenue comparison</CardDescription>
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
    <Card>
      <CardHeader>
        <CardTitle>Billings - monthly</CardTitle>
        <CardDescription>Monthly revenue comparison from July 2025 to June 2026</CardDescription>
      </CardHeader>
      <CardContent>
        <RevenueMonthlyChart data={data} />
      </CardContent>
    </Card>
  )
}

