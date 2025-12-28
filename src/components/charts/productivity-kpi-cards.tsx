'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function KPICardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Billable % Card Skeleton */}
      <Card className="overflow-hidden">
        <CardHeader className="pt-3 pb-3 bg-green-100/50 border-b">
          <CardTitle className="text-sm font-semibold">
            <span className="inline-block h-4 w-24 bg-muted animate-pulse rounded" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-3 bg-white">
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
      
      {/* Recoverability % Card Skeleton */}
      <Card className="overflow-hidden">
        <CardHeader className="pt-3 pb-3 bg-blue-100/50 border-b">
          <CardTitle className="text-sm font-semibold">
            <span className="inline-block h-4 w-32 bg-muted animate-pulse rounded" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-3 bg-white">
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
        <CardHeader className="pt-3 pb-3 bg-orange-100/50 border-b">
          <CardTitle className="text-sm font-semibold">
            <span className="inline-block h-4 w-32 bg-muted animate-pulse rounded" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-3 bg-white">
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

interface ProductivityKPICardsProps {
  organizationId: string
  selectedStaff?: string | null
  asOfDate?: string
}

interface KPIData {
  ytdBillablePercentage: number
  lastYearBillablePercentage: number
  targetBillablePercentage: number
  ytdAverageRate: number
  lastYearAverageRate: number
}

interface RecoverabilityKPIData {
  currentYearAmount: number
  lastYearAmount: number
  percentageChange: number | null
  currentYearPercentage: number
  lastYearPercentage: number
  targetPercentage: number
}

export function ProductivityKPICards({ organizationId, selectedStaff, asOfDate }: ProductivityKPICardsProps) {
  const [data, setData] = useState<KPIData | null>(null)
  const [recoverabilityData, setRecoverabilityData] = useState<RecoverabilityKPIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        // First, fetch saved filters from Billable page
        let billableFilters: any[] = []
        try {
          const filtersResponse = await fetch(
            `/api/billable/saved-filters?organizationId=${organizationId}&t=${Date.now()}`,
            {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              },
            }
          )
          
          if (filtersResponse.ok) {
            const result = await filtersResponse.json()
            if (result.filters && Array.isArray(result.filters)) {
              billableFilters = result.filters
            }
          }
        } catch (err) {
          // Silently fail - filters are optional
          console.error('Failed to fetch saved filters:', err)
        }
        
        const baseParams = `organizationId=${organizationId}&t=${Date.now()}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`
        const staffParam = selectedStaff ? `&staff=${encodeURIComponent(selectedStaff)}` : ''
        
        // Add staff filter to billableFilters if selectedStaff is provided
        let filtersWithStaff = [...billableFilters]
        if (selectedStaff) {
          // Remove existing staff filter if any, then add the new one
          filtersWithStaff = filtersWithStaff.filter(f => f.type !== 'staff')
          filtersWithStaff.push({ type: 'staff', value: selectedStaff })
        }
        
        // Add filters parameter if filters exist
        const filtersParam = filtersWithStaff.length > 0 
          ? `&filters=${encodeURIComponent(JSON.stringify(filtersWithStaff))}`
          : ''
        
        // Fetch productivity and recoverability data in parallel
        const [productivityResponse, recoverabilityResponse] = await Promise.all([
          fetch(`/api/productivity/kpi?${baseParams}${staffParam}${filtersParam}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }),
          fetch(`/api/recoverability/kpi?${baseParams}${filtersParam}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }),
        ])
        
        if (!productivityResponse.ok) {
          throw new Error('Failed to fetch productivity KPI data')
        }
        
        if (!recoverabilityResponse.ok) {
          throw new Error('Failed to fetch recoverability KPI data')
        }
        
        const kpiData = await productivityResponse.json()
        const recoverabilityKpiData = await recoverabilityResponse.json()
        setData(kpiData)
        setRecoverabilityData(recoverabilityKpiData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, selectedStaff, asOfDate])

  // Calculate percentage change for Billable % (absolute difference in percentage points)
  const billablePercentageChange = data !== null
    ? data.ytdBillablePercentage - data.lastYearBillablePercentage
    : null

  // Calculate percentage change for Average Rate (percentage change rate)
  const ratePercentageChange = data !== null
    ? data.lastYearAverageRate > 0
      ? ((data.ytdAverageRate - data.lastYearAverageRate) / data.lastYearAverageRate) * 100
      : data.lastYearAverageRate === 0 && data.ytdAverageRate > 0
        ? 100
        : null
    : null

  // Calculate percentage change for Recoverability % (absolute difference in percentage points)
  const recoverabilityPercentageChange = recoverabilityData !== null
    ? recoverabilityData.currentYearPercentage - recoverabilityData.lastYearPercentage
    : null

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

  if (error || !data || !recoverabilityData) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Combined Billable % Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pt-3 pb-3 bg-green-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Billable %</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-3 bg-white">
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

      {/* Recoverability % Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pt-3 pb-3 bg-blue-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Recoverability %</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-3 bg-white">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Current Year</div>
              <div className="text-2xl font-bold text-black">
                {recoverabilityData.currentYearPercentage.toFixed(1)}%
              </div>
            </div>
            <div className="text-center border-x border-gray-200">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Last Year</div>
              <div className="text-2xl font-bold text-black">
                {recoverabilityData.lastYearPercentage.toFixed(1)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Target</div>
              <div className="text-2xl font-bold text-black">{recoverabilityData.targetPercentage.toFixed(1)}%</div>
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
      
      {/* Combined Average Rate Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pt-3 pb-3 bg-orange-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Average Hourly Rate $</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-3 bg-white">
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
