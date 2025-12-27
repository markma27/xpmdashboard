'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DashboardKPICardsProps {
  organizationId: string
  asOfDate?: string
}

interface DashboardKPIData {
  revenue: {
    currentYear: number
    lastYear: number
    percentageChange: number | null
  }
  billableAmount: {
    currentYear: number
    lastYear: number
    percentageChange: number | null
  }
}

interface ProductivityKPIData {
  ytdBillablePercentage: number
  lastYearBillablePercentage: number
  ytdAverageRate: number
  lastYearAverageRate: number
}

interface RecoverabilityKPIData {
  currentYearAmount: number
  lastYearAmount: number
  percentageChange: number | null
  currentYearPercentage: number
  lastYearPercentage: number
}

function KPICardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold">
              <span className="inline-block h-4 w-24 bg-muted animate-pulse rounded" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 bg-white">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="h-3 w-16 bg-muted animate-pulse rounded mx-auto mb-2" />
                <div className="h-8 w-20 bg-muted animate-pulse rounded mx-auto" />
              </div>
              <div className="text-center border-l border-gray-200">
                <div className="h-3 w-16 bg-muted animate-pulse rounded mx-auto mb-2" />
                <div className="h-8 w-20 bg-muted animate-pulse rounded mx-auto" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function DashboardKPICards({ organizationId, asOfDate }: DashboardKPICardsProps) {
  const [dashboardData, setDashboardData] = useState<DashboardKPIData | null>(null)
  const [productivityData, setProductivityData] = useState<ProductivityKPIData | null>(null)
  const [recoverabilityData, setRecoverabilityData] = useState<RecoverabilityKPIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch saved filters first, then fetch data with filters applied
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
        
        // Add filters parameter if filters exist
        const filtersParam = billableFilters.length > 0 
          ? `&filters=${encodeURIComponent(JSON.stringify(billableFilters))}`
          : ''
        
        // Fetch dashboard KPI data, productivity KPI data, and recoverability KPI data in parallel
        const [dashboardResponse, productivityResponse, recoverabilityResponse] = await Promise.all([
          fetch(`/api/dashboard/kpi?${baseParams}${filtersParam}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }),
          fetch(`/api/productivity/kpi?${baseParams}${filtersParam}`, {
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
        
        if (!dashboardResponse.ok) {
          throw new Error('Failed to fetch dashboard KPI data')
        }
        
        if (!productivityResponse.ok) {
          throw new Error('Failed to fetch productivity KPI data')
        }
        
        if (!recoverabilityResponse.ok) {
          throw new Error('Failed to fetch recoverability KPI data')
        }
        
        const dashboardKpiData = await dashboardResponse.json()
        const productivityKpiData = await productivityResponse.json()
        const recoverabilityKpiData = await recoverabilityResponse.json()
        
        setDashboardData(dashboardKpiData)
        setProductivityData(productivityKpiData)
        setRecoverabilityData(recoverabilityKpiData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, asOfDate])

  // Format currency with parentheses for negative values and red color
  const formatCurrency = (amount: number) => {
    const absAmount = Math.abs(amount)
    const formatted = absAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    if (amount < 0) {
      return `($${formatted})`
    }
    return `$${formatted}`
  }

  // Calculate percentage changes
  // For percentage metrics (Billable %, Recoverability %), use absolute difference (percentage points)
  // For dollar/rate metrics (Hourly Rate), use percentage change rate
  const billablePercentageChange = productivityData !== null
    ? productivityData.ytdBillablePercentage - productivityData.lastYearBillablePercentage
    : null

  const hourlyRatePercentageChange = productivityData && productivityData.lastYearAverageRate > 0
    ? ((productivityData.ytdAverageRate - productivityData.lastYearAverageRate) / productivityData.lastYearAverageRate) * 100
    : null

  // Calculate percentage change for Recoverability % (absolute difference in percentage points)
  const recoverabilityPercentageChange = recoverabilityData !== null
    ? recoverabilityData.currentYearPercentage - recoverabilityData.lastYearPercentage
    : null

  if (loading) {
    return <KPICardSkeleton />
  }

  if (error || !dashboardData || !productivityData || !recoverabilityData) {
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
      {/* Total Invoice $ Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pt-3 pb-3 bg-blue-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Invoice $</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-3 bg-white">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Current Year</div>
              <div className={`text-2xl font-bold ${
                dashboardData.revenue.currentYear < 0 ? 'text-red-600' : 'text-black'
              }`}>
                {formatCurrency(dashboardData.revenue.currentYear)}
              </div>
            </div>
            <div className="text-center border-l border-gray-200">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Last Year</div>
              <div className={`text-2xl font-bold ${
                dashboardData.revenue.lastYear < 0 ? 'text-red-600' : 'text-black'
              }`}>
                {formatCurrency(dashboardData.revenue.lastYear)}
              </div>
            </div>
          </div>
          {dashboardData.revenue.percentageChange !== null && (
            <div className="pt-3 border-t border-gray-200 text-center">
              <div className="text-xs text-muted-foreground font-medium mb-1">% Change</div>
              <div className={`text-base font-semibold ${
                dashboardData.revenue.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {dashboardData.revenue.percentageChange >= 0 ? '+' : ''}{dashboardData.revenue.percentageChange.toFixed(1)}%
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billable $ Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pt-3 pb-3 bg-purple-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Billable $</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-3 bg-white">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Current Year</div>
              <div className={`text-2xl font-bold ${
                dashboardData.billableAmount.currentYear < 0 ? 'text-red-600' : 'text-black'
              }`}>
                {formatCurrency(dashboardData.billableAmount.currentYear)}
              </div>
            </div>
            <div className="text-center border-l border-gray-200">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Last Year</div>
              <div className={`text-2xl font-bold ${
                dashboardData.billableAmount.lastYear < 0 ? 'text-red-600' : 'text-black'
              }`}>
                {formatCurrency(dashboardData.billableAmount.lastYear)}
              </div>
            </div>
          </div>
          {dashboardData.billableAmount.percentageChange !== null && (
            <div className="pt-3 border-t border-gray-200 text-center">
              <div className="text-xs text-muted-foreground font-medium mb-1">% Change</div>
              <div className={`text-base font-semibold ${
                dashboardData.billableAmount.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {dashboardData.billableAmount.percentageChange >= 0 ? '+' : ''}{dashboardData.billableAmount.percentageChange.toFixed(1)}%
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billable % Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pt-3 pb-3 bg-green-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Billable %</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-3 bg-white">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Current Year</div>
              <div className="text-2xl font-bold text-black">
                {productivityData.ytdBillablePercentage.toFixed(1)}%
              </div>
            </div>
            <div className="text-center border-l border-gray-200">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Last Year</div>
              <div className="text-2xl font-bold text-black">
                {productivityData.lastYearBillablePercentage.toFixed(1)}%
              </div>
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

      {/* Hourly Rate Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pt-3 pb-3 bg-yellow-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Hourly Rate $</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-3 bg-white">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Current Year</div>
              <div className="text-2xl font-bold text-black">
                ${Math.round(productivityData.ytdAverageRate).toLocaleString('en-US')}
              </div>
            </div>
            <div className="text-center border-l border-gray-200">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Last Year</div>
              <div className="text-2xl font-bold text-black">
                ${Math.round(productivityData.lastYearAverageRate).toLocaleString('en-US')}
              </div>
            </div>
          </div>
          {hourlyRatePercentageChange !== null && (
            <div className="pt-3 border-t border-gray-200 text-center">
              <div className="text-xs text-muted-foreground font-medium mb-1">% Change</div>
              <div className={`text-base font-semibold ${
                hourlyRatePercentageChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {hourlyRatePercentageChange >= 0 ? '+' : ''}{hourlyRatePercentageChange.toFixed(1)}%
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recoverability $ Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pt-3 pb-3 bg-orange-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Write On / (Off) $</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-3 bg-white">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Current Year</div>
              <div className={`text-2xl font-bold ${
                recoverabilityData.currentYearAmount < 0 ? 'text-red-600' : 'text-black'
              }`}>
                {formatCurrency(recoverabilityData.currentYearAmount)}
              </div>
            </div>
            <div className="text-center border-l border-gray-200">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Last Year</div>
              <div className={`text-2xl font-bold ${
                recoverabilityData.lastYearAmount < 0 ? 'text-red-600' : 'text-black'
              }`}>
                {formatCurrency(recoverabilityData.lastYearAmount)}
              </div>
            </div>
          </div>
          {recoverabilityData.percentageChange !== null && (
            <div className="pt-3 border-t border-gray-200 text-center">
              <div className="text-xs text-muted-foreground font-medium mb-1">% Change</div>
              <div className={`text-base font-semibold ${
                recoverabilityData.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {recoverabilityData.percentageChange >= 0 ? '+' : ''}{recoverabilityData.percentageChange.toFixed(1)}%
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recoverability % Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pt-3 pb-3 bg-green-100/50 border-b">
          <CardTitle className="text-sm font-semibold text-black">Recoverability %</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-3 bg-white">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Current Year</div>
              <div className="text-2xl font-bold text-black">
                {recoverabilityData.currentYearPercentage.toFixed(1)}%
              </div>
            </div>
            <div className="text-center border-l border-gray-200">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Last Year</div>
              <div className="text-2xl font-bold text-black">
                {recoverabilityData.lastYearPercentage.toFixed(1)}%
              </div>
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
