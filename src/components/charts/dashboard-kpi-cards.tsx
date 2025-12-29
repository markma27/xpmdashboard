'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface KPICardProps {
  title: string
  currentValue: string
  lastYearValue: string
  percentageChange: number | null
  isNegative?: boolean
  isPercentageMetric?: boolean
}

function KPICard({ 
  title, 
  currentValue, 
  lastYearValue, 
  percentageChange, 
  isNegative = false,
  isPercentageMetric = false 
}: KPICardProps) {
  const isPositiveChange = percentageChange !== null && percentageChange >= 0
  
  return (
    <Card className="overflow-hidden shadow-sm border-slate-200 bg-white transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardContent className="p-0">
        {/* Title */}
        <div className="py-2 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <span className="text-lg font-bold text-slate-900">
            {title}
          </span>
        </div>

        {/* Current Year Value */}
        <div className="py-5 text-center">
          <span className={cn(
            "text-3xl font-bold tracking-tight",
            isNegative ? "text-red-600" : "text-slate-900"
          )}>
            {currentValue}
          </span>
        </div>

        <div className="px-4 pb-4">
          <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
            {/* Last Year */}
            <div className="text-sm font-medium text-slate-500">
              Last Year: {lastYearValue}
            </div>

            {/* Percentage Change */}
            {percentageChange !== null && (
              <div className="flex items-center gap-1.5 border-l border-slate-100 pl-4">
                {isPositiveChange ? (
                  <ArrowUp className="h-4 w-4 text-emerald-500 fill-emerald-500" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-500 fill-red-500" />
                )}
                <span className={cn(
                  "text-base font-bold",
                  isPositiveChange ? "text-emerald-500" : "text-red-500"
                )}>
                  {isPositiveChange ? '+' : ''}{percentageChange.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function KPICardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="overflow-hidden border-slate-200">
          <CardContent className="p-0">
            <div className="pt-4 text-center">
              <div className="h-5 w-24 bg-muted animate-pulse rounded mx-auto" />
            </div>
            <div className="py-5 text-center">
              <div className="h-9 w-40 bg-muted animate-pulse rounded mx-auto" />
            </div>
            <div className="px-4 pb-4">
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-5 w-16 bg-muted animate-pulse rounded" />
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {/* Total Invoice $ Card */}
      <KPICard 
        title="Invoice $"
        currentValue={formatCurrency(dashboardData.revenue.currentYear)}
        lastYearValue={formatCurrency(dashboardData.revenue.lastYear)}
        percentageChange={dashboardData.revenue.percentageChange}
        isNegative={dashboardData.revenue.currentYear < 0}
      />

      {/* Billable $ Card */}
      <KPICard 
        title="Billable $"
        currentValue={formatCurrency(dashboardData.billableAmount.currentYear)}
        lastYearValue={formatCurrency(dashboardData.billableAmount.lastYear)}
        percentageChange={dashboardData.billableAmount.percentageChange}
        isNegative={dashboardData.billableAmount.currentYear < 0}
      />

      {/* Billable % Card */}
      <KPICard 
        title="Billable %"
        currentValue={`${productivityData.ytdBillablePercentage.toFixed(1)}%`}
        lastYearValue={`${productivityData.lastYearBillablePercentage.toFixed(1)}%`}
        percentageChange={billablePercentageChange}
        isPercentageMetric={true}
      />

      {/* Hourly Rate Card */}
      <KPICard 
        title="Avg Hourly Rate"
        currentValue={`$${Math.round(productivityData.ytdAverageRate).toLocaleString('en-US')}`}
        lastYearValue={`$${Math.round(productivityData.lastYearAverageRate).toLocaleString('en-US')}`}
        percentageChange={hourlyRatePercentageChange}
      />

      {/* Recoverability $ Card */}
      <KPICard 
        title="Write On / (Off) $"
        currentValue={formatCurrency(recoverabilityData.currentYearAmount)}
        lastYearValue={formatCurrency(recoverabilityData.lastYearAmount)}
        percentageChange={recoverabilityData.percentageChange}
        isNegative={recoverabilityData.currentYearAmount < 0}
      />

      {/* Recoverability % Card */}
      <KPICard 
        title="Recoverability %"
        currentValue={`${recoverabilityData.currentYearPercentage.toFixed(1)}%`}
        lastYearValue={`${recoverabilityData.lastYearPercentage.toFixed(1)}%`}
        percentageChange={recoverabilityPercentageChange}
        isPercentageMetric={true}
      />
    </div>
  )
}
