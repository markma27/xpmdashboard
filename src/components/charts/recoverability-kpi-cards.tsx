'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
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
    <div className="grid gap-4 md:grid-cols-2">
      {[...Array(2)].map((_, i) => (
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

export function RecoverabilityKPICards({ organizationId, filters = [] }: RecoverabilityKPICardsProps) {
  const [data, setData] = useState<KPIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Memoize filters string to avoid unnecessary re-renders
  const filtersString = useMemo(() => JSON.stringify(filters), [filters])

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        const baseParams = `organizationId=${organizationId}&t=${Date.now()}`
        const filtersParam = filters.length > 0 
          ? `&filters=${encodeURIComponent(filtersString)}`
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
  }, [organizationId, filtersString])

  // Calculate percentage change for Recoverability % (absolute difference in percentage points)
  const recoverabilityPercentageChange = data !== null
    ? data.currentYearPercentage - data.lastYearPercentage
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
      <KPICard 
        title="Write On / (Off) $"
        currentValue={formatCurrency(data.currentYearAmount)}
        lastYearValue={formatCurrency(data.lastYearAmount)}
        percentageChange={data.percentageChange}
        isNegative={data.currentYearAmount < 0}
      />
      
      {/* Recoverability % Card */}
      <KPICard 
        title="Recoverability %"
        currentValue={`${data.currentYearPercentage.toFixed(1)}%`}
        lastYearValue={`${data.lastYearPercentage.toFixed(1)}%`}
        percentageChange={recoverabilityPercentageChange}
        isPercentageMetric={true}
      />
    </div>
  )
}
