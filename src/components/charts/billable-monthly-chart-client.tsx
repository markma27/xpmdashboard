'use client'

import { useEffect, useState } from 'react'
import { BillableMonthlyChart } from './billable-monthly-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface MonthlyBillableData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface BillableMonthlyChartClientProps {
  organizationId: string
  selectedStaff?: string | null
}

export function BillableMonthlyChartClient({ 
  organizationId, 
  selectedStaff
}: BillableMonthlyChartClientProps) {
  const [data, setData] = useState<MonthlyBillableData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        // Build query with optional staff filter
        let url = `/api/billable/monthly?organizationId=${organizationId}&t=${Date.now()}`
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
  }, [organizationId, selectedStaff])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billable - monthly</CardTitle>
          <CardDescription>Monthly billable amount comparison</CardDescription>
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
        <BillableMonthlyChart data={data} />
      </CardContent>
    </Card>
  )
}

