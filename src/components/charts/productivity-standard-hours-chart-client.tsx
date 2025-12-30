'use client'

import { useEffect, useState } from 'react'
import { ProductivityStandardHoursChart } from './productivity-standard-hours-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'

interface MonthlyStandardHoursData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface ProductivityStandardHoursChartClientProps {
  organizationId: string
  selectedStaff?: string | null
}

export function ProductivityStandardHoursChartClient({ 
  organizationId, 
  selectedStaff
}: ProductivityStandardHoursChartClientProps) {
  const [data, setData] = useState<MonthlyStandardHoursData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        // Build query with optional staff filter
        let url = `/api/productivity/standard-hours/monthly?organizationId=${organizationId}&t=${Date.now()}`
        if (selectedStaff) {
          url += `&staff=${encodeURIComponent(selectedStaff)}`
        }
        
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch standard hours data')
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
  }, [organizationId, selectedStaff])

  if (loading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Standard Hours - Monthly</CardTitle>
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
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Standard Hours - Monthly</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">
              No data available. Please configure staff daily hours in settings.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Standard Hours - Monthly</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ProductivityStandardHoursChart data={data} />
      </CardContent>
    </Card>
  )
}

