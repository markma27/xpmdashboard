'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { BillableMonthlyChart } from './billable-monthly-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'
import { BillableFilter } from './billable-filters'
import { useBillableReport } from './billable-report-context'

interface MonthlyBillableData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface BillableMonthlyChartClientProps {
  organizationId: string
  selectedMonth?: string | null
  onMonthClick?: (month: string | null) => void
  filters?: BillableFilter[]
}

export function BillableMonthlyChartClient({ 
  organizationId, 
  selectedMonth,
  onMonthClick,
  filters = []
}: BillableMonthlyChartClientProps) {
  const { filtersLoaded } = useBillableReport()
  const [data, setData] = useState<MonthlyBillableData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Track the last successfully fetched filters to prevent duplicate fetches
  const lastFetchedFiltersRef = useRef<string | undefined>(undefined)

  // Memoize filters string to prevent unnecessary re-fetches when filters array reference changes
  const filtersString = useMemo(() => {
    if (filters.length === 0) return ''
    const filtersParam = filters
      .filter((f) => f.value && f.value !== 'all' && f.value.trim() !== '') // Exclude 'all' values and empty strings
      .map((f) => {
        if (f.operator) {
          return `${f.type}:${f.operator}:${encodeURIComponent(f.value)}`
        }
        return `${f.type}:${encodeURIComponent(f.value)}`
      })
      .join('|')
    return filtersParam
  }, [filters])

  useEffect(() => {
    // Don't fetch until filters are loaded
    if (!filtersLoaded) {
      return
    }

    // Skip if we've already fetched with these exact filters
    if (lastFetchedFiltersRef.current === filtersString) {
      return
    }

    // Create abort controller for this fetch
    const abortController = new AbortController()
    let isCancelled = false
    
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        // Build query with filters (staff filter is now part of filters array)
        let url = `/api/billable/monthly?organizationId=${organizationId}&t=${Date.now()}`
        
        // Add filters to URL
        if (filtersString) {
          url += `&filters=${encodeURIComponent(filtersString)}`
        }
        
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
          signal: abortController.signal,
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch billable data')
        }
        
        const result = await response.json()
        
        // Only update state if not cancelled
        if (!isCancelled) {
          setData(result)
          setLoading(false)
          // Mark this filter combination as successfully fetched
          lastFetchedFiltersRef.current = filtersString
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'An error occurred')
          setLoading(false)
        }
      }
    }

    fetchData()
    
    // Cleanup: abort any in-flight request when effect re-runs or unmounts
    return () => {
      isCancelled = true
      abortController.abort()
    }
  }, [organizationId, filtersString, filtersLoaded])

  if (loading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Billable by Month</CardTitle>
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
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Billable by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">
              No data available. Please upload timesheet data first.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Billable by Month</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <BillableMonthlyChart 
          data={data} 
          selectedMonth={selectedMonth}
          onMonthClick={onMonthClick}
        />
      </CardContent>
    </Card>
  )
}

