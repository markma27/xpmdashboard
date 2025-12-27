'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BillableFilter } from './billable-filters'

interface RecoverabilityKPICardsProps {
  organizationId: string
  filters?: BillableFilter[]
}

interface KPIData {
  currentYearAmount: number
  lastYearAmount: number
  percentageChange: number | null
  currentYearPercentage: number
  lastYearPercentage: number
  targetPercentage: number
}

function KPICardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Recoverability $ Card Skeleton */}
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
              <div className="h-8 w-24 bg-muted animate-pulse rounded mx-auto" />
            </div>
            <div className="text-center border-l border-gray-200">
              <div className="h-3 w-16 bg-muted animate-pulse rounded mx-auto mb-2" />
              <div className="h-8 w-24 bg-muted animate-pulse rounded mx-auto" />
            </div>
          </div>
          <div className="pt-3 border-t border-gray-200 text-center">
            <div className="h-3 w-16 bg-muted animate-pulse rounded mx-auto mb-1" />
            <div className="h-5 w-16 bg-muted animate-pulse rounded mx-auto" />
          </div>
        </CardContent>
      </Card>
      
      {/* Recoverability % Card Skeleton */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-green-100/50 border-b">
          <CardTitle className="text-sm font-semibold">
            <span className="inline-block h-4 w-32 bg-muted animate-pulse rounded" />
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
    </div>
  )
}

export function RecoverabilityKPICards({ organizationId, filters = [] }: RecoverabilityKPICardsProps) {
  const [data, setData] = useState<KPIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        const baseParams = `organizationId=${organizationId}&t=${Date.now()}`
        const filtersParam = filters.length > 0 
          ? `&filters=${encodeURIComponent(JSON.stringify(filters))}`
          : ''
        
        const response = await fetch(`/api/recoverability/kpi?${baseParams}${filtersParam}`, {
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
  }, [organizationId, JSON.stringify(filters)])

  // Calculate percentage change for Recoverability %
  const recoverabilityPercentageChange = data && data.lastYearPercentage > 0
    ? ((data.currentYearPercentage - data.lastYearPercentage) / data.lastYearPercentage) * 100
    : (data && data.currentYearPercentage > 0 && data.lastYearPercentage === 0 ? 100 : null)

  // Format currency with parentheses for negative values and red color
  const formatCurrency = (amount: number) => {
    const absAmount = Math.abs(amount)
    const formatted = absAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    if (amount < 0) {
      return `($${formatted})`
    }
    return `$${formatted}`
  }

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
      {/* Recoverability $ Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-orange-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Recoverability $</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 bg-white">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Current Year</div>
              <div className={`text-2xl font-bold ${
                data.currentYearAmount < 0 ? 'text-red-600' : 'text-black'
              }`}>
                {formatCurrency(data.currentYearAmount)}
              </div>
            </div>
            <div className="text-center border-l border-gray-200">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Last Year</div>
              <div className={`text-2xl font-bold ${
                data.lastYearAmount < 0 ? 'text-red-600' : 'text-black'
              }`}>
                {formatCurrency(data.lastYearAmount)}
              </div>
            </div>
          </div>
          {data.percentageChange !== null && (
            <div className="pt-3 border-t border-gray-200 text-center">
              <div className="text-xs text-muted-foreground font-medium mb-1">% Change</div>
              <div className={`text-base font-semibold ${
                data.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {data.percentageChange >= 0 ? '+' : ''}{data.percentageChange.toFixed(1)}%
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Recoverability % Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-green-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Recoverability %</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 bg-white">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Current Year</div>
              <div className="text-2xl font-bold text-black">
                {data.currentYearPercentage.toFixed(1)}%
              </div>
            </div>
            <div className="text-center border-x border-gray-200">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Last Year</div>
              <div className="text-2xl font-bold text-black">
                {data.lastYearPercentage.toFixed(1)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Target</div>
              <div className="text-2xl font-bold text-black">{data.targetPercentage.toFixed(1)}%</div>
            </div>
          </div>
          {recoverabilityPercentageChange !== null && (
            <div className="pt-3 border-t border-gray-200 text-center">
              <div className="text-xs text-muted-foreground font-medium mb-1">% Change</div>
              <div className={`text-base font-semibold ${
                recoverabilityPercentageChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {recoverabilityPercentageChange >= 0 ? '+' : ''}{recoverabilityPercentageChange.toFixed(1)}%
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
