'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  currentValue: string
  lastYearValue: string
  percentageChange: number | null
  isPercentageMetric?: boolean
  isNegative?: boolean
  lastYearDate?: string | null
}

function KPICard({ 
  title, 
  currentValue, 
  lastYearValue, 
  percentageChange, 
  isPercentageMetric = false,
  isNegative = false,
  lastYearDate = null
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
          <div className="border-t border-slate-100 pt-3 flex items-center">
            {/* Last Year Text */}
            <div className="text-sm font-medium text-slate-500 flex items-center flex-1">
              <span>Last Year{lastYearDate && <span className="text-[10px] text-slate-400"> (YTD to {lastYearDate})</span>}</span>
            </div>

            {/* Last Year Value */}
            <div className="flex items-center justify-center border-l border-slate-100 pl-4 pr-4 min-w-[120px] self-stretch">
              <span className="text-sm font-medium text-slate-500">{lastYearValue}</span>
            </div>

            {/* Percentage Change */}
            {percentageChange !== null && (
              <div className="flex items-center justify-center gap-1.5 border-l border-slate-100 pl-4 self-stretch">
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="overflow-hidden shadow-sm border-slate-200">
          <CardContent className="p-0">
            {/* Title Skeleton */}
            <div className="py-2 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
              <div className="h-5 w-24 bg-muted animate-pulse rounded" />
            </div>
            <div className="py-5 text-center">
              <div className="h-8 w-32 bg-muted animate-pulse rounded mx-auto" />
            </div>
            <div className="px-4 pb-4">
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
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
      <KPICard 
        title="Billable %"
        currentValue={`${data.ytdBillablePercentage.toFixed(1)}%`}
        lastYearValue={`${data.lastYearBillablePercentage.toFixed(1)}%`}
        percentageChange={billablePercentageChange}
        isPercentageMetric={true}
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
      
      {/* Combined Average Rate Card */}
      <KPICard 
        title="Average Hourly Rate $"
        currentValue={`$${Math.round(data.ytdAverageRate).toLocaleString('en-US')}`}
        lastYearValue={`$${Math.round(data.lastYearAverageRate).toLocaleString('en-US')}`}
        percentageChange={ratePercentageChange}
        lastYearDate={formattedLastYearDate}
      />
    </div>
  )
}
