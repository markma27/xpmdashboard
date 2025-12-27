'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function KPICardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Billable % Card Skeleton */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-green-100/50 border-b">
          <CardTitle className="text-sm font-semibold">
            <span className="inline-block h-4 w-24 bg-muted animate-pulse rounded" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 bg-white">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="h-3 w-16 bg-muted animate-pulse rounded mx-auto mb-2" />
              <div className="h-8 w-20 bg-muted animate-pulse rounded mx-auto" />
            </div>
            <div className="text-center border-x border-gray-200">
              <div className="h-3 w-16 bg-muted animate-pulse rounded mx-auto mb-2" />
              <div className="h-8 w-20 bg-muted animate-pulse rounded mx-auto" />
            </div>
            <div className="text-center">
              <div className="h-3 w-12 bg-muted animate-pulse rounded mx-auto mb-2" />
              <div className="h-8 w-20 bg-muted animate-pulse rounded mx-auto" />
            </div>
          </div>
          <div className="pt-3 border-t border-gray-200 text-center">
            <div className="h-3 w-16 bg-muted animate-pulse rounded mx-auto mb-1" />
            <div className="h-5 w-16 bg-muted animate-pulse rounded mx-auto" />
          </div>
        </CardContent>
      </Card>
      
      {/* Hourly Rate Card Skeleton */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-orange-100/50 border-b">
          <CardTitle className="text-sm font-semibold">
            <span className="inline-block h-4 w-32 bg-muted animate-pulse rounded" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 bg-white">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center">
              <div className="h-3 w-20 bg-muted animate-pulse rounded mx-auto mb-2" />
              <div className="h-8 w-20 bg-muted animate-pulse rounded mx-auto" />
            </div>
            <div className="text-center border-l border-gray-200">
              <div className="h-3 w-16 bg-muted animate-pulse rounded mx-auto mb-2" />
              <div className="h-8 w-20 bg-muted animate-pulse rounded mx-auto" />
            </div>
          </div>
          <div className="pt-3 border-t border-gray-200 text-center">
            <div className="h-3 w-16 bg-muted animate-pulse rounded mx-auto mb-1" />
            <div className="h-5 w-16 bg-muted animate-pulse rounded mx-auto" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface ProductivityKPICardsProps {
  organizationId: string
  selectedStaff?: string | null
}

interface KPIData {
  ytdBillablePercentage: number
  lastYearBillablePercentage: number
  targetBillablePercentage: number
  ytdAverageRate: number
  lastYearAverageRate: number
}

export function ProductivityKPICards({ organizationId, selectedStaff }: ProductivityKPICardsProps) {
  const [data, setData] = useState<KPIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        const baseParams = `organizationId=${organizationId}&t=${Date.now()}`
        const staffParam = selectedStaff ? `&staff=${encodeURIComponent(selectedStaff)}` : ''
        
        const response = await fetch(`/api/productivity/kpi?${baseParams}${staffParam}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch KPI data')
        }
        
        const kpiData = await response.json()
        setData(kpiData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, selectedStaff])

  // Calculate percentage change for Billable %
  const billablePercentageChange = data && data.lastYearBillablePercentage > 0
    ? ((data.ytdBillablePercentage - data.lastYearBillablePercentage) / data.lastYearBillablePercentage) * 100
    : null

  // Calculate percentage change for Average Rate
  const ratePercentageChange = data && data.lastYearAverageRate > 0
    ? ((data.ytdAverageRate - data.lastYearAverageRate) / data.lastYearAverageRate) * 100
    : null

  if (loading) {
    return <KPICardSkeleton />
  }

  if (error || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-destructive">{error || 'No data available'}</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Combined Billable % Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-green-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Billable %</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 bg-white">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Current Year</div>
              <div className="text-2xl font-bold text-black">{data.ytdBillablePercentage.toFixed(1)}%</div>
            </div>
            <div className="text-center border-x border-gray-200">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Last Year</div>
              <div className="text-2xl font-bold text-black">{data.lastYearBillablePercentage.toFixed(1)}%</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Target</div>
              <div className="text-2xl font-bold text-black">{data.targetBillablePercentage.toFixed(1)}%</div>
            </div>
          </div>
          {billablePercentageChange !== null && (
            <div className="pt-3 border-t border-gray-200 text-center">
              <div className="text-xs text-muted-foreground font-medium mb-1">% Change</div>
              <div className={`text-base font-semibold ${
                billablePercentageChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {billablePercentageChange >= 0 ? '+' : ''}{billablePercentageChange.toFixed(1)}%
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Combined Average Rate Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-orange-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Hourly Rate $</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 bg-white">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Current Year</div>
              <div className="text-2xl font-bold text-black">${Math.round(data.ytdAverageRate).toLocaleString('en-US')}</div>
            </div>
            <div className="text-center border-l border-gray-200">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Last Year</div>
              <div className="text-2xl font-bold text-black">${Math.round(data.lastYearAverageRate).toLocaleString('en-US')}</div>
            </div>
          </div>
          {ratePercentageChange !== null && (
            <div className="pt-3 border-t border-gray-200 text-center">
              <div className="text-xs text-muted-foreground font-medium mb-1">% Change</div>
              <div className={`text-base font-semibold ${
                ratePercentageChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {ratePercentageChange >= 0 ? '+' : ''}{ratePercentageChange.toFixed(1)}%
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
