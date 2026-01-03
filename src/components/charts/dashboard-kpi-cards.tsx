'use client'

import useSWR from 'swr'
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
  lastYearDate?: string | null
}

// SWR fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

// SWR config for KPI data
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 60000,        // 60 seconds deduping
  refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  errorRetryCount: 3,
}

function KPICard({ 
  title, 
  currentValue, 
  lastYearValue, 
  percentageChange, 
  isNegative = false,
  isPercentageMetric = false,
  lastYearDate = null
}: KPICardProps) {
  const isPositiveChange = percentageChange !== null && percentageChange >= 0
  
  return (
    <Card className="overflow-hidden shadow-sm border-slate-200 bg-white transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardContent className="p-0">
        {/* Title */}
        <div className="py-1.5 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <span className="text-base font-bold text-slate-900">
            {title}
          </span>
        </div>

        {/* Current Year Value */}
        <div className="py-3 text-center">
          <span className={cn(
            "text-xl font-bold tracking-tight",
            isNegative ? "text-red-600" : "text-slate-900"
          )}>
            {currentValue}
          </span>
        </div>

        <div className="px-2.5 pb-2.5">
          <div className="border-t border-slate-100 pt-2 flex flex-col md:flex-row md:items-center gap-1 md:gap-0">
            {/* Last Year Text - Stack date below on tablet */}
            <div className="text-xs font-medium text-slate-500 flex flex-col md:flex-row md:items-center flex-1 min-w-0">
              <span className="whitespace-nowrap">Last Year</span>
              {lastYearDate && (
                <span className="text-[8px] md:text-[9px] text-slate-400 md:ml-1 whitespace-nowrap">(YTD to {lastYearDate})</span>
              )}
            </div>

            {/* Last Year Value */}
            <div className="flex items-center justify-start md:justify-center md:border-l md:border-slate-100 md:pl-2.5 md:pr-2.5 md:min-w-[90px] md:self-stretch">
              <span className="text-xs font-medium text-slate-500">{lastYearValue}</span>
            </div>

            {/* Percentage Change */}
            {percentageChange !== null && (
              <div className="flex items-center justify-start md:justify-center gap-1 md:border-l md:border-slate-100 md:pl-2.5 md:pr-2 md:self-stretch min-w-0">
                {isPositiveChange ? (
                  <ArrowUp className="h-3 w-3 text-emerald-500 fill-emerald-500 flex-shrink-0" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-red-500 fill-red-500 flex-shrink-0" />
                )}
                <span className={cn(
                  "text-sm font-bold whitespace-nowrap",
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
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {/* Title Skeleton */}
            <div className="py-1.5 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            </div>
            <div className="py-3 text-center">
              <div className="h-6 w-24 bg-muted animate-pulse rounded mx-auto" />
            </div>
            <div className="px-2.5 pb-2.5">
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
  // First, fetch saved filters
  const { data: filtersData } = useSWR<{ filters: any[] }>(
    `/api/billable/saved-filters?organizationId=${organizationId}`,
    fetcher,
    { ...swrConfig, refreshInterval: 0 }
  )
  
  const billableFilters = filtersData?.filters || []
  const filtersParam = billableFilters.length > 0 
    ? `&filters=${encodeURIComponent(JSON.stringify(billableFilters))}`
    : ''
  
  // Build base params
  const baseParams = `organizationId=${organizationId}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`

  // Format last year date for display
  const formatLastYearDate = (dateString: string | undefined): string | null => {
    if (!dateString) return null
    const date = new Date(dateString + 'T00:00:00') // Add time to avoid timezone issues
    const day = date.getDate().toString().padStart(2, '0')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }

  // Calculate last year end date (same day last year, but not exceeding last year's FY end)
  // This matches the logic in /api/dashboard/kpi/route.ts
  const calculateLastYearDate = (): string | null => {
    if (!asOfDate) return null
    
    // Use asOfDate as currentYearEnd (same as API)
    const currentYearEnd = asOfDate
    
    // Parse the date to determine financial year
    const asOf = new Date(asOfDate + 'T00:00:00')
    const currentMonth = asOf.getMonth() // 0-11
    const currentYear = asOf.getFullYear()
    
    // Determine current financial year
    let currentFYStartYear: number
    if (currentMonth >= 6) {
      currentFYStartYear = currentYear
    } else {
      currentFYStartYear = currentYear - 1
    }
    
    const lastFYEndYear = currentFYStartYear
    
    // For last year "same time", calculate the same day last year
    // Directly manipulate the date string to avoid timezone issues (same as API)
    const [year, month, day] = currentYearEnd.split('-').map(Number)
    const lastYearEndDate = `${year - 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const lastYearFYEnd = `${lastFYEndYear}-06-30`
    // Use the earlier of last year same date or last year FY end
    const lastYearEnd = lastYearEndDate <= lastYearFYEnd ? lastYearEndDate : lastYearFYEnd
    
    return formatLastYearDate(lastYearEnd)
  }

  const formattedLastYearDate = calculateLastYearDate()
  
  // Fetch all KPI data using SWR (these run in parallel automatically)
  const { data: dashboardData, error: dashboardError, isLoading: dashboardLoading } = useSWR<DashboardKPIData>(
    `/api/dashboard/kpi?${baseParams}${filtersParam}`,
    fetcher,
    swrConfig
  )
  
  const { data: productivityData, error: productivityError, isLoading: productivityLoading } = useSWR<ProductivityKPIData>(
    `/api/productivity/kpi?${baseParams}${filtersParam}`,
    fetcher,
    swrConfig
  )
  
  const { data: recoverabilityData, error: recoverabilityError, isLoading: recoverabilityLoading } = useSWR<RecoverabilityKPIData>(
    `/api/recoverability/kpi?${baseParams}${filtersParam}`,
    fetcher,
    swrConfig
  )

  // Format currency with parentheses for negative values and red color
  const formatCurrency = (amount: number) => {
    const absAmount = Math.abs(amount)
    const formatted = absAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    if (amount < 0) {
      return `($${formatted})`
    }
    return `$${formatted}`
  }

  // Check loading state
  const isLoading = dashboardLoading || productivityLoading || recoverabilityLoading
  const hasError = dashboardError || productivityError || recoverabilityError

  if (isLoading) {
    return <KPICardSkeleton />
  }

  if (hasError || !dashboardData || !productivityData || !recoverabilityData) {
    return (
      <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-destructive">
              {dashboardError?.message || productivityError?.message || recoverabilityError?.message || 'No data available'}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate percentage changes
  const billablePercentageChange = productivityData !== null
    ? productivityData.ytdBillablePercentage - productivityData.lastYearBillablePercentage
    : null

  const hourlyRatePercentageChange = productivityData
    ? Math.abs(productivityData.lastYearAverageRate) > 0.01
      ? ((productivityData.ytdAverageRate - productivityData.lastYearAverageRate) / Math.abs(productivityData.lastYearAverageRate)) * 100
      : Math.abs(productivityData.ytdAverageRate) > 0.01
        ? (productivityData.ytdAverageRate > 0 ? 100 : -100)
        : null
    : null

  const recoverabilityPercentageChange = recoverabilityData !== null
    ? recoverabilityData.currentYearPercentage - recoverabilityData.lastYearPercentage
    : null

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {/* Total Invoice $ Card */}
      <KPICard 
        title="Invoice $"
        currentValue={formatCurrency(dashboardData.revenue.currentYear)}
        lastYearValue={formatCurrency(dashboardData.revenue.lastYear)}
        percentageChange={dashboardData.revenue.percentageChange}
        isNegative={dashboardData.revenue.currentYear < 0}
        lastYearDate={formattedLastYearDate}
      />

      {/* Billable $ Card */}
      <KPICard 
        title="Billable $"
        currentValue={formatCurrency(dashboardData.billableAmount.currentYear)}
        lastYearValue={formatCurrency(dashboardData.billableAmount.lastYear)}
        percentageChange={dashboardData.billableAmount.percentageChange}
        isNegative={dashboardData.billableAmount.currentYear < 0}
        lastYearDate={formattedLastYearDate}
      />

      {/* Billable % Card */}
      <KPICard 
        title="Billable %"
        currentValue={`${productivityData.ytdBillablePercentage.toFixed(1)}%`}
        lastYearValue={`${productivityData.lastYearBillablePercentage.toFixed(1)}%`}
        percentageChange={billablePercentageChange}
        isPercentageMetric={true}
        lastYearDate={formattedLastYearDate}
      />

      {/* Hourly Rate Card */}
      <KPICard 
        title="Average Hourly Rate"
        currentValue={`$${Math.round(productivityData.ytdAverageRate).toLocaleString('en-US')}`}
        lastYearValue={`$${Math.round(productivityData.lastYearAverageRate).toLocaleString('en-US')}`}
        percentageChange={hourlyRatePercentageChange}
        lastYearDate={formattedLastYearDate}
      />

      {/* Recoverability $ Card */}
      <KPICard 
        title="Write On / (Off) $"
        currentValue={formatCurrency(recoverabilityData.currentYearAmount)}
        lastYearValue={formatCurrency(recoverabilityData.lastYearAmount)}
        percentageChange={recoverabilityData.percentageChange}
        isNegative={recoverabilityData.currentYearAmount < 0}
        lastYearDate={formattedLastYearDate}
      />

      {/* Recoverability % Card */}
      <KPICard 
        title="Recoverability %"
        currentValue={`${recoverabilityData.currentYearPercentage.toFixed(1)}%`}
        lastYearValue={`${recoverabilityData.lastYearPercentage.toFixed(1)}%`}
        percentageChange={recoverabilityPercentageChange}
        isPercentageMetric={true}
        lastYearDate={formattedLastYearDate}
      />
    </div>
  )
}
