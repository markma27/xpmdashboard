'use client'

import { useEffect, useState } from 'react'
import { WIPAgingPieChart } from './wip-aging-pie-chart'
import { WIPAgingBarChart } from './wip-aging-bar-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AgingData {
  lessThan30: number
  days30to60: number
  days60to90: number
  days90to120: number
  days120Plus: number
  total: number
  percentages: {
    lessThan30: number
    days30to60: number
    days60to90: number
    days90to120: number
    days120Plus: number
  }
}

interface WIPAgingChartsProps {
  organizationId: string
  selectedPartner?: string | null
  selectedClientManager?: string | null
}

export function WIPAgingCharts({ 
  organizationId,
  selectedPartner,
  selectedClientManager
}: WIPAgingChartsProps) {
  const [data, setData] = useState<AgingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        // Build query with optional filters
        let queryParams = `organizationId=${organizationId}&t=${Date.now()}`
        if (selectedPartner) {
          queryParams += `&partner=${encodeURIComponent(selectedPartner)}`
        }
        if (selectedClientManager) {
          queryParams += `&clientManager=${encodeURIComponent(selectedClientManager)}`
        }
        
        const response = await fetch(`/api/wip/aging-summary?${queryParams}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch WIP aging data')
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
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
            <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">WIP Aging by Percentage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-muted-foreground">Loading chart data...</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
            <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">WIP Aging by Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-muted-foreground">Loading chart data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">WIP Aging Charts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-destructive">Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
            <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">WIP Aging by Percentage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-muted-foreground">No data available</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
            <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">WIP Aging by Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-muted-foreground">No data available</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">WIP Aging by Percentage</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <WIPAgingPieChart data={data} />
        </CardContent>
      </Card>
      <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">WIP Aging by Amount</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <WIPAgingBarChart data={data} />
        </CardContent>
      </Card>
    </div>
  )
}

