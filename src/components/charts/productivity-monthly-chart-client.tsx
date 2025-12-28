'use client'

import { useEffect, useState } from 'react'
import { ProductivityMonthlyChart } from './productivity-monthly-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'

interface MonthlyProductivityData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface ProductivityMonthlyChartClientProps {
  organizationId: string
  selectedStaff?: string | null
  selectedMonth?: string | null
  onMonthClick?: (month: string | null) => void
  asOfDate?: string
}

export function ProductivityMonthlyChartClient({ 
  organizationId, 
  selectedStaff,
  selectedMonth,
  onMonthClick,
  asOfDate
}: ProductivityMonthlyChartClientProps) {
  const [data, setData] = useState<MonthlyProductivityData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        // Build query with optional staff filter and date
        let url = `/api/productivity/monthly?organizationId=${organizationId}&t=${Date.now()}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`
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
          throw new Error('Failed to fetch productivity data')
        }
        
        const result = await response.json()
        
        // Filter data: only filter Current Year data, keep Last Year data for full 12 months
        let filteredData = result
        if (asOfDate) {
          const selectedDate = new Date(asOfDate)
          const selectedMonth = selectedDate.getMonth() // 0-11
          const selectedYear = selectedDate.getFullYear()
          
          // Determine financial year for the selected date
          let currentFYStartYear: number
          if (selectedMonth >= 6) {
            currentFYStartYear = selectedYear
          } else {
            currentFYStartYear = selectedYear - 1
          }
          
          // Month order: July (0), August (1), September (2), October (3), November (4), December (5),
          //              January (6), February (7), March (8), April (9), May (10), June (11)
          // Map actual month to array index
          const monthIndex = selectedMonth >= 6 ? selectedMonth - 6 : selectedMonth + 6
          
          // Filter: set Current Year to 0 for months after selected date, but keep Last Year data
          filteredData = result.map((item: MonthlyProductivityData, index: number) => {
            if (index > monthIndex) {
              // After selected month: keep Last Year, set Current Year to 0
              return {
                ...item,
                'Current Year': 0,
              }
            }
            return item
          })
        }
        
        setData(filteredData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, selectedStaff, asOfDate])

  if (loading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billable Hours</CardTitle>
          <CardDescription>Monthly billable hours comparison</CardDescription>
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
          <CardTitle>Billable Hours</CardTitle>
          <CardDescription>Monthly billable hours comparison</CardDescription>
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
    <Card>
      <CardHeader>
        <CardTitle>Billable Hours</CardTitle>
        <CardDescription>Monthly billable hours comparison</CardDescription>
      </CardHeader>
      <CardContent>
        <ProductivityMonthlyChart 
          data={data} 
          selectedMonth={selectedMonth}
          onMonthClick={onMonthClick}
        />
      </CardContent>
    </Card>
  )
}

