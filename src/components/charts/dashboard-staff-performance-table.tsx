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

  // Format date as DD MMM YYYY for column header
  const formatDateForHeader = (dateString: string | undefined) => {
    if (!dateString) return null
    const date = new Date(dateString + 'T00:00:00') // Add time to avoid timezone issues
    const day = date.getDate().toString().padStart(2, '0')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }

  const formattedAsOfDate = formatDateForHeader(asOfDate)

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
        
        // Fetch both staff performance data and KPI data in parallel
        const [staffResponse, kpiResponse] = await Promise.all([
          fetch(`/api/dashboard/staff-performance?${baseParams}${filtersParam}`, {
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
        ])
        
        if (!staffResponse.ok) {
          throw new Error('Failed to fetch staff performance data')
        }
        
        const result: StaffPerformanceResponse = await staffResponse.json()
        setData(result.data || result) // Support both old format (array) and new format (object with data and totals)
        
        // Use KPI API's billable percentage for totals to ensure consistency with KPI card
        let finalTotals = result.totals || null
        if (kpiResponse.ok && finalTotals) {
          try {
            const kpiData = await kpiResponse.json()
            if (kpiData.ytdBillablePercentage !== undefined) {
              // Override the billable percentage with the exact value from KPI API
              finalTotals = {
                ...finalTotals,
                currentYear: {
                  ...finalTotals.currentYear,
                  billablePercentage: kpiData.ytdBillablePercentage,
                },
              }
            }
          } catch (err) {
            // Silently fail - use the original totals
            console.error('Failed to parse KPI data:', err)
          }
        }
        
        setTotals(finalTotals)
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
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Staff Performance</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b bg-slate-50/50">
                {/* Current Year Columns - spans all columns including Staff */}
                <th colSpan={11} className="text-center py-2 px-2 font-bold text-slate-700 bg-slate-100/50 uppercase tracking-wider text-[10px]">
                  Current Year Performance Metrics{formattedAsOfDate && <span className="font-normal text-slate-500 text-[9px] normal-case ml-1">(YTD to {formattedAsOfDate})</span>}
                </th>
              </tr>
              <tr className="border-b bg-slate-50/30">
                <th 
                  className="text-left py-2 px-4 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none sticky left-0 bg-slate-50/30 z-20 border-r"
                  onClick={() => handleSort('staff')}
                >
                  Staff<SortIcon column="staff" />
                </th>
                {/* Current Year sub-headers */}
                <th 
                  className="text-right py-2 px-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30"
                  onClick={() => handleSort('currentYearBillableAmount')}
                >
                  Billable $<SortIcon column="currentYearBillableAmount" />
                </th>
                <th 
                  className="text-right py-2 px-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none bg-slate-50/30"
                  onClick={() => handleSort('currentYearBillablePercentage')}
                >
                  Billable %<SortIcon column="currentYearBillablePercentage" />
                </th>
                <th 
                  className="text-right py-2 px-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none bg-slate-50/30"
                  onClick={() => handleSort('currentYearTargetBillablePercentage')}
                >
                  Target %<SortIcon column="currentYearTargetBillablePercentage" />
                </th>
                <th 
                  className="text-right py-2 px-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30"
                  onClick={() => handleSort('currentYearBillableVariance')}
                >
                  Var %<SortIcon column="currentYearBillableVariance" />
                </th>
                <th 
                  className="text-right py-2 px-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30"
                  onClick={() => handleSort('currentYearRecoverabilityAmount')}
                >
                  Write On/Off $<SortIcon column="currentYearRecoverabilityAmount" />
                </th>
                <th 
                  className="text-right py-2 px-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none bg-slate-50/30"
                  onClick={() => handleSort('currentYearRecoverabilityPercentage')}
                >
                  Recov %<SortIcon column="currentYearRecoverabilityPercentage" />
                </th>
                <th 
                  className="text-right py-2 px-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none bg-slate-50/30"
                  onClick={() => handleSort('currentYearTargetRecoverabilityPercentage')}
                >
                  Target %<SortIcon column="currentYearTargetRecoverabilityPercentage" />
                </th>
                <th 
                  className="text-right py-2 px-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30"
                  onClick={() => handleSort('currentYearRecoverabilityVariance')}
                >
                  Var %<SortIcon column="currentYearRecoverabilityVariance" />
                </th>
                <th 
                  className="text-right py-2 px-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none bg-slate-50/30"
                  onClick={() => handleSort('currentYearBillableHours')}
                >
                  Hours<SortIcon column="currentYearBillableHours" />
                </th>
                <th 
                  className="text-right py-2 px-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none bg-slate-50/30"
                  onClick={() => handleSort('currentYearAverageRate')}
                >
                  Avg Rate<SortIcon column="currentYearAverageRate" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedData.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">{item.staff}</td>
                  {/* Current Year data */}
                  <td className={`py-2 px-2 text-right font-medium border-r ${item.currentYear.billableAmount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {formatCurrency(item.currentYear.billableAmount)}
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-slate-900">
                    {formatPercentage(item.currentYear.billablePercentage)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-500">
                    {item.currentYear.targetBillablePercentage !== null 
                      ? formatPercentage(item.currentYear.targetBillablePercentage)
                      : '-'}
                  </td>
                  <td className={`py-2 px-2 text-right font-bold border-r ${item.currentYear.billableVariance !== null && item.currentYear.billableVariance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {item.currentYear.billableVariance !== null 
                      ? (item.currentYear.billableVariance > 0 ? '+' : '') + formatPercentage(item.currentYear.billableVariance)
                      : '-'}
                  </td>
                  <td className={`py-2 px-2 text-right font-medium border-r ${item.currentYear.recoverabilityAmount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {formatCurrency(item.currentYear.recoverabilityAmount)}
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-slate-900">
                    {formatPercentage(item.currentYear.recoverabilityPercentage)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-500">
                    {formatPercentage(item.currentYear.targetRecoverabilityPercentage)}
                  </td>
                  <td className={`py-2 px-2 text-right font-bold border-r ${item.currentYear.recoverabilityVariance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {(item.currentYear.recoverabilityVariance > 0 ? '+' : '') + formatPercentage(item.currentYear.recoverabilityVariance)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-700">
                    {formatHours(item.currentYear.billableHours)}
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-slate-900">
                    {formatCurrency(item.currentYear.averageHourlyRate)}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              {totals && (
                <tr className="border-t-2 border-slate-200 font-bold bg-slate-50/80 rounded-b-lg">
                  <td className="py-2 px-4 sticky left-0 bg-slate-50/80 z-10 border-r rounded-bl-lg">TOTAL</td>
                  {/* Current Year totals */}
                  <td className={`py-2 px-2 text-right border-r ${totals.currentYear.billableAmount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {formatCurrency(totals.currentYear.billableAmount)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-900">
                    {formatPercentage(totals.currentYear.billablePercentage)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-500">
                    {totals.currentYear.targetBillablePercentage !== null 
                      ? formatPercentage(totals.currentYear.targetBillablePercentage)
                      : '-'}
                  </td>
                  <td className={`py-2 px-2 text-right border-r ${totals.currentYear.billableVariance !== null && totals.currentYear.billableVariance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {totals.currentYear.billableVariance !== null 
                      ? (totals.currentYear.billableVariance > 0 ? '+' : '') + formatPercentage(totals.currentYear.billableVariance)
                      : '-'}
                  </td>
                  <td className={`py-2 px-2 text-right border-r ${totals.currentYear.recoverabilityAmount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {formatCurrency(totals.currentYear.recoverabilityAmount)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-900">
                    {formatPercentage(totals.currentYear.recoverabilityPercentage)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-500">
                    {formatPercentage(totals.currentYear.targetRecoverabilityPercentage)}
                  </td>
                  <td className={`py-2 px-2 text-right border-r ${totals.currentYear.recoverabilityVariance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {(totals.currentYear.recoverabilityVariance > 0 ? '+' : '') + formatPercentage(totals.currentYear.recoverabilityVariance)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-700">
                    {formatHours(totals.currentYear.billableHours)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-900 rounded-br-lg">
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
