'use client'

import { useEffect, useState } from 'react'
import { BillableMonthlyChart } from './billable-monthly-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'
import { BillableFilter } from './billable-filters'

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
  filters = []
}: BillableMonthlyChartClientProps) {
  const [data, setData] = useState<MonthlyBillableData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        // Build query with filters (staff filter is now part of filters array)
        let url = `/api/billable/monthly?organizationId=${organizationId}&t=${Date.now()}`
        
        // Add filters to URL
        if (filters.length > 0) {
          const filtersParam = filters
            .filter((f) => f.value && f.value !== 'all' && f.value.trim() !== '') // Exclude 'all' values and empty strings
            .map((f) => {
              if (f.operator) {
                return `${f.type}:${f.operator}:${encodeURIComponent(f.value)}`
              }
              return `${f.type}:${encodeURIComponent(f.value)}`
            })
            .join('|')
          if (filtersParam) {
            url += `&filters=${encodeURIComponent(filtersParam)}`
          }
        }
        
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch billable data')
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
  }, [organizationId, filters])

  if (loading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billable - monthly</CardTitle>
          <CardDescription>Monthly billable amount comparison</CardDescription>
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
          <CardTitle>Billable - monthly</CardTitle>
          <CardDescription>Monthly billable amount comparison</CardDescription>
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
        <CardTitle>Billable - monthly</CardTitle>
        <CardDescription>Monthly billable amount comparison</CardDescription>
      </CardHeader>
      <CardContent>
        <BillableMonthlyChart 
          data={data} 
          selectedMonth={selectedMonth}
          onMonthClick={onMonthClick}
        />
      </CardContent>
    </Card>
  )
}

