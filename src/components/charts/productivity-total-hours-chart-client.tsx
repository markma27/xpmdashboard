'use client'

import { useEffect, useState } from 'react'
import { ProductivityTotalHoursChart } from './productivity-total-hours-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'

interface MonthlyTotalHoursData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface ProductivityTotalHoursChartClientProps {
  organizationId: string
  selectedStaff?: string | null
}

export function ProductivityTotalHoursChartClient({ 
  organizationId, 
  selectedStaff
}: ProductivityTotalHoursChartClientProps) {
  const [data, setData] = useState<MonthlyTotalHoursData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        // Build query URLs with optional staff filter
        const baseParams = `organizationId=${organizationId}&t=${Date.now()}`
        const staffParam = selectedStaff ? `&staff=${encodeURIComponent(selectedStaff)}` : ''
        
        const [standardHoursResponse, capacityReducingResponse] = await Promise.all([
          fetch(`/api/productivity/standard-hours/monthly?${baseParams}${staffParam}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }),
          fetch(`/api/productivity/capacity-reducing/monthly?${baseParams}${staffParam}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }),
        ])
        
        if (!standardHoursResponse.ok) {
          throw new Error('Failed to fetch standard hours data')
        }
        
        if (!capacityReducingResponse.ok) {
          throw new Error('Failed to fetch capacity reducing hours data')
        }
        
        const standardHoursData = await standardHoursResponse.json()
        const capacityReducingData = await capacityReducingResponse.json()
        
        // Calculate total hours = standard hours - capacity reducing hours
        const totalHoursData = standardHoursData.map((item: any, index: number) => {
          const capacityReducingItem = capacityReducingData[index]
          return {
            month: item.month,
            'Current Year': Math.max(0, Math.round((item['Current Year'] - (capacityReducingItem?.['Current Year'] || 0)) * 100) / 100),
            'Last Year': Math.max(0, Math.round((item['Last Year'] - (capacityReducingItem?.['Last Year'] || 0)) * 100) / 100),
          }
        })
        
        setData(totalHoursData)
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
        <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Total Hours - Monthly</CardTitle>
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
        <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Total Hours - Monthly</CardTitle>
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
        <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Total Hours - Monthly</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ProductivityTotalHoursChart data={data} />
      </CardContent>
    </Card>
  )
}

