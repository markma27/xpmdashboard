'use client'

import { useEffect, useState } from 'react'
import { RecoverabilityMonthlyChart } from './recoverability-monthly-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'

interface MonthlyRecoverabilityData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface RecoverabilityMonthlyChartClientProps {
  organizationId: string
  selectedPartner?: string | null
  selectedClientManager?: string | null
}

export function RecoverabilityMonthlyChartClient({ 
  organizationId,
  selectedPartner,
  selectedClientManager
}: RecoverabilityMonthlyChartClientProps) {
  const [data, setData] = useState<MonthlyRecoverabilityData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        // Build query with optional filters
        let url = `/api/recoverability/monthly?organizationId=${organizationId}&t=${Date.now()}`
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
  }, [organizationId, selectedPartner, selectedClientManager])

  if (loading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recoverability - monthly</CardTitle>
          <CardDescription>Monthly recoverability comparison</CardDescription>
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
          <CardTitle>Recoverability - monthly</CardTitle>
          <CardDescription>Monthly recoverability comparison</CardDescription>
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
    <Card>
      <CardHeader>
        <CardTitle>Recoverability - monthly</CardTitle>
        <CardDescription>Monthly recoverability comparison</CardDescription>
      </CardHeader>
      <CardContent>
        <RecoverabilityMonthlyChart data={data} />
      </CardContent>
    </Card>
  )
}

