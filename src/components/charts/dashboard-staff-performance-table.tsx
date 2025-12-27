'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TableSkeleton } from './chart-skeleton'

interface StaffPerformanceData {
  staff: string
  currentYear: {
    billableAmount: number
    billablePercentage: number
    targetBillablePercentage: number | null
    billableVariance: number | null
    recoverabilityAmount: number
    recoverabilityPercentage: number
    targetRecoverabilityPercentage: number
    recoverabilityVariance: number
    billableHours: number
    averageHourlyRate: number
  }
}

interface StaffPerformanceResponse {
  data: StaffPerformanceData[]
  totals: {
    currentYear: {
      billableAmount: number
      billablePercentage: number
      targetBillablePercentage: number | null
      billableVariance: number | null
      recoverabilityAmount: number
      recoverabilityPercentage: number
      targetRecoverabilityPercentage: number
      recoverabilityVariance: number
      billableHours: number
      averageHourlyRate: number
    }
  }
}

type SortColumn = 'staff' | 'currentYearBillableAmount' | 'currentYearBillablePercentage' | 'currentYearTargetBillablePercentage' | 'currentYearBillableVariance' | 'currentYearRecoverabilityAmount' | 'currentYearRecoverabilityPercentage' | 'currentYearTargetRecoverabilityPercentage' | 'currentYearRecoverabilityVariance' | 'currentYearBillableHours' | 'currentYearAverageRate'
type SortDirection = 'asc' | 'desc'

interface DashboardStaffPerformanceTableProps {
  organizationId: string
  asOfDate?: string
}

export function DashboardStaffPerformanceTable({ organizationId, asOfDate }: DashboardStaffPerformanceTableProps) {
  const [data, setData] = useState<StaffPerformanceData[]>([])
  const [totals, setTotals] = useState<StaffPerformanceResponse['totals'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>('currentYearBillableAmount')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        // First, fetch saved filters from Billable page (same as KPI cards)
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
        
        const response = await fetch(`/api/dashboard/staff-performance?${baseParams}${filtersParam}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch staff performance data')
        }
        
        const result: StaffPerformanceResponse = await response.json()
        setData(result.data || result) // Support both old format (array) and new format (object with data and totals)
        setTotals(result.totals || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, asOfDate])

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '-'
    const absAmount = Math.abs(amount)
    const formatted = absAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    if (amount < 0) {
      return `($${formatted})`
    }
    return `$${formatted}`
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const formatHours = (hours: number) => {
    if (hours === 0) return '-'
    return Math.round(hours).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    let aValue: string | number
    let bValue: string | number

    switch (sortColumn) {
      case 'staff':
        aValue = a.staff
        bValue = b.staff
        break
      case 'currentYearBillableAmount':
        aValue = a.currentYear.billableAmount
        bValue = b.currentYear.billableAmount
        break
      case 'currentYearBillablePercentage':
        aValue = a.currentYear.billablePercentage
        bValue = b.currentYear.billablePercentage
        break
      case 'currentYearTargetBillablePercentage':
        aValue = a.currentYear.targetBillablePercentage ?? 0
        bValue = b.currentYear.targetBillablePercentage ?? 0
        break
      case 'currentYearBillableVariance':
        aValue = a.currentYear.billableVariance ?? 0
        bValue = b.currentYear.billableVariance ?? 0
        break
      case 'currentYearRecoverabilityAmount':
        aValue = a.currentYear.recoverabilityAmount
        bValue = b.currentYear.recoverabilityAmount
        break
      case 'currentYearRecoverabilityPercentage':
        aValue = a.currentYear.recoverabilityPercentage
        bValue = b.currentYear.recoverabilityPercentage
        break
      case 'currentYearTargetRecoverabilityPercentage':
        aValue = a.currentYear.targetRecoverabilityPercentage
        bValue = b.currentYear.targetRecoverabilityPercentage
        break
      case 'currentYearRecoverabilityVariance':
        aValue = a.currentYear.recoverabilityVariance
        bValue = b.currentYear.recoverabilityVariance
        break
      case 'currentYearBillableHours':
        aValue = a.currentYear.billableHours
        bValue = b.currentYear.billableHours
        break
      case 'currentYearAverageRate':
        aValue = a.currentYear.averageHourlyRate
        bValue = b.currentYear.averageHourlyRate
        break
      default:
        return 0
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue)
      return sortDirection === 'asc' ? comparison : -comparison
    } else {
      const comparison = (aValue as number) - (bValue as number)
      return sortDirection === 'asc' ? comparison : -comparison
    }
  })

  if (loading) {
    return <TableSkeleton />
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Staff Performance</CardTitle>
          <CardDescription>Staff performance metrics comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-destructive">Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Staff Performance</CardTitle>
          <CardDescription>Staff performance metrics comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-muted-foreground">No data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff Performance</CardTitle>
        <CardDescription>Staff performance metrics: Billable $, Billable %, Target %, Variance %, Recoverability $, Recoverability %, Target %, Variance %, Billable Hours, Average Hourly Rate</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th 
                  className="text-left p-3 font-semibold cursor-pointer hover:bg-muted/50 select-none sticky left-0 bg-muted/50 z-10"
                  onClick={() => handleSort('staff')}
                >
                  Staff<SortIcon column="staff" />
                </th>
                {/* Current Year Columns */}
                <th colSpan={10} className="text-center p-3 font-semibold border-l">
                  Current Year
                </th>
              </tr>
              <tr className="border-b bg-muted/30">
                <th className="p-3"></th>
                {/* Current Year sub-headers */}
                <th 
                  className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none border-l"
                  onClick={() => handleSort('currentYearBillableAmount')}
                >
                  Billable $<SortIcon column="currentYearBillableAmount" />
                </th>
                <th 
                  className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('currentYearBillablePercentage')}
                >
                  Billable %<SortIcon column="currentYearBillablePercentage" />
                </th>
                <th 
                  className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('currentYearTargetBillablePercentage')}
                >
                  Target %<SortIcon column="currentYearTargetBillablePercentage" />
                </th>
                <th 
                  className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none border-r"
                  onClick={() => handleSort('currentYearBillableVariance')}
                >
                  Variance %<SortIcon column="currentYearBillableVariance" />
                </th>
                <th 
                  className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none border-l"
                  onClick={() => handleSort('currentYearRecoverabilityAmount')}
                >
                  Write On / (Off) $<SortIcon column="currentYearRecoverabilityAmount" />
                </th>
                <th 
                  className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('currentYearRecoverabilityPercentage')}
                >
                  Recoverability %<SortIcon column="currentYearRecoverabilityPercentage" />
                </th>
                <th 
                  className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('currentYearTargetRecoverabilityPercentage')}
                >
                  Target %<SortIcon column="currentYearTargetRecoverabilityPercentage" />
                </th>
                <th 
                  className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none border-r"
                  onClick={() => handleSort('currentYearRecoverabilityVariance')}
                >
                  Variance %<SortIcon column="currentYearRecoverabilityVariance" />
                </th>
                <th 
                  className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none border-l"
                  onClick={() => handleSort('currentYearBillableHours')}
                >
                  Billable Hours<SortIcon column="currentYearBillableHours" />
                </th>
                <th 
                  className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none border-r"
                  onClick={() => handleSort('currentYearAverageRate')}
                >
                  Avg Hourly Rate<SortIcon column="currentYearAverageRate" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, index) => (
                <tr key={index} className="border-b hover:bg-muted/50 group">
                  <td className="p-3 font-medium sticky left-0 bg-white group-hover:bg-muted/50 z-10">{item.staff}</td>
                  {/* Current Year data */}
                  <td className={`p-3 text-right border-l ${item.currentYear.billableAmount < 0 ? 'text-red-600' : ''}`}>
                    {formatCurrency(item.currentYear.billableAmount)}
                  </td>
                  <td className="p-3 text-right">
                    {formatPercentage(item.currentYear.billablePercentage)}
                  </td>
                  <td className="p-3 text-right">
                    {item.currentYear.targetBillablePercentage !== null 
                      ? formatPercentage(item.currentYear.targetBillablePercentage)
                      : '-'}
                  </td>
                  <td className={`p-3 text-right border-r ${item.currentYear.billableVariance !== null && item.currentYear.billableVariance < 0 ? 'text-red-600' : ''}`}>
                    {item.currentYear.billableVariance !== null 
                      ? formatPercentage(item.currentYear.billableVariance)
                      : '-'}
                  </td>
                  <td className={`p-3 text-right border-l ${item.currentYear.recoverabilityAmount < 0 ? 'text-red-600' : ''}`}>
                    {formatCurrency(item.currentYear.recoverabilityAmount)}
                  </td>
                  <td className="p-3 text-right">
                    {formatPercentage(item.currentYear.recoverabilityPercentage)}
                  </td>
                  <td className="p-3 text-right">
                    {formatPercentage(item.currentYear.targetRecoverabilityPercentage)}
                  </td>
                  <td className={`p-3 text-right border-r ${item.currentYear.recoverabilityVariance < 0 ? 'text-red-600' : ''}`}>
                    {formatPercentage(item.currentYear.recoverabilityVariance)}
                  </td>
                  <td className="p-3 text-right border-l">
                    {formatHours(item.currentYear.billableHours)}
                  </td>
                  <td className="p-3 text-right border-r">
                    {formatCurrency(item.currentYear.averageHourlyRate)}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              {totals && (
                <tr className="border-t-2 font-semibold bg-muted/30">
                  <td className="p-3 sticky left-0 bg-muted/30 z-10">Total</td>
                  {/* Current Year totals */}
                  <td className="p-3 text-right border-l">
                    {formatCurrency(totals.currentYear.billableAmount)}
                  </td>
                  <td className="p-3 text-right">
                    {formatPercentage(totals.currentYear.billablePercentage)}
                  </td>
                  <td className="p-3 text-right">
                    {totals.currentYear.targetBillablePercentage !== null 
                      ? formatPercentage(totals.currentYear.targetBillablePercentage)
                      : '-'}
                  </td>
                  <td className="p-3 text-right border-r">
                    {totals.currentYear.billableVariance !== null 
                      ? formatPercentage(totals.currentYear.billableVariance)
                      : '-'}
                  </td>
                  <td className="p-3 text-right border-l">
                    {formatCurrency(totals.currentYear.recoverabilityAmount)}
                  </td>
                  <td className="p-3 text-right">
                    {formatPercentage(totals.currentYear.recoverabilityPercentage)}
                  </td>
                  <td className="p-3 text-right">
                    {formatPercentage(totals.currentYear.targetRecoverabilityPercentage)}
                  </td>
                  <td className={`p-3 text-right border-r ${totals.currentYear.recoverabilityVariance < 0 ? 'text-red-600' : ''}`}>
                    {formatPercentage(totals.currentYear.recoverabilityVariance)}
                  </td>
                  <td className="p-3 text-right border-l">
                    {formatHours(totals.currentYear.billableHours)}
                  </td>
                  <td className="p-3 text-right border-r">
                    {formatCurrency(totals.currentYear.averageHourlyRate)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
