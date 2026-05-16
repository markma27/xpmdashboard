'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import * as XLSX from 'xlsx'
import { Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TableSkeleton } from './chart-skeleton'
import { BillableFilter } from './billable-filters'
import { useBillableReport } from './billable-report-context'
import { dashboardDataFetcher, dashboardSwrConfig } from '@/lib/hooks/use-dashboard-data'

function excelTimestamp() {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

interface ClientGroupData {
  clientGroup: string
  currentYear: number
  lastYear: number
  partner: string | null
  clientManager: string | null
}

type SortColumn = 'clientGroup' | 'partner' | 'clientManager' | 'currentYear' | 'lastYear' | 'change'
type SortDirection = 'asc' | 'desc'

interface BillableClientGroupsTableProps {
  organizationId: string
  selectedMonth?: string | null
  filters?: BillableFilter[]
}

export function BillableClientGroupsTable({
  organizationId,
  selectedMonth,
  filters = [],
}: BillableClientGroupsTableProps) {
  const { lastUpdated, filtersLoaded } = useBillableReport()
  const [sortColumn, setSortColumn] = useState<SortColumn>('currentYear')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const formatDateForHeader = (dateString: string | null) => {
    if (!dateString) return null
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }

  const formatMonthLabel = (
    monthString: string | null | undefined
  ): { currentYear: string; lastYear: string } | null => {
    if (!monthString) return null

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const fullMonthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]

    const monthIndex = fullMonthNames.findIndex((m) => m.toLowerCase() === monthString.toLowerCase())
    if (monthIndex === -1) return null

    const now = new Date()
    const currentCalendarYear = now.getFullYear()
    const currentMonth = now.getMonth()

    let currentFYStartYear: number
    if (currentMonth >= 6) {
      currentFYStartYear = currentCalendarYear
    } else {
      currentFYStartYear = currentCalendarYear - 1
    }

    let selectedMonthYear: number
    if (monthIndex >= 6) {
      selectedMonthYear = currentFYStartYear
    } else {
      selectedMonthYear = currentFYStartYear + 1
    }

    const currentYearLabel = `${monthNames[monthIndex]} ${selectedMonthYear}`
    const lastYearLabel = `${monthNames[monthIndex]} ${selectedMonthYear - 1}`

    return { currentYear: currentYearLabel, lastYear: lastYearLabel }
  }

  const formattedLastUpdated = formatDateForHeader(lastUpdated)
  const monthLabel = formatMonthLabel(selectedMonth)

  const filtersString = useMemo(() => {
    if (filters.length === 0) return ''
    const filtersParam = filters
      .filter((f) => f.value && f.value !== 'all' && f.value.trim() !== '')
      .map((f) => {
        if (f.operator) {
          return `${f.type}:${f.operator}:${encodeURIComponent(f.value)}`
        }
        return `${f.type}:${encodeURIComponent(f.value)}`
      })
      .join('|')
    return filtersParam
  }, [filters])

  const swrKey = useMemo(() => {
    if (!filtersLoaded || !organizationId) return null
    let base = `/api/billable/client-groups?organizationId=${encodeURIComponent(organizationId)}`
    if (selectedMonth) {
      base += `&month=${encodeURIComponent(selectedMonth)}`
    }
    if (filtersString) {
      base += `&filters=${encodeURIComponent(filtersString)}`
    }
    return base
  }, [filtersLoaded, organizationId, selectedMonth, filtersString])

  const { data, error, isLoading } = useSWR<ClientGroupData[]>(
    swrKey,
    dashboardDataFetcher,
    dashboardSwrConfig
  )

  const loading = !filtersLoaded || isLoading

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const calculateChange = (current: number, last: number) => {
    if (last === 0) return current > 0 ? 100 : 0
    return ((current - last) / last) * 100
  }

  if (loading) {
    return <TableSkeleton />
  }

  if (error) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Billable by Client Group</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-destructive">Error: {error.message || 'An error occurred'}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const rawData = data ?? []

  if (rawData.length === 0) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Billable by Client Group</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-muted-foreground">
              No data available. Please upload timesheet data first.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const filteredData = rawData

  const sortedData = [...filteredData].sort((a, b) => {
    let aValue: string | number
    let bValue: string | number

    switch (sortColumn) {
      case 'clientGroup':
        aValue = a.clientGroup || ''
        bValue = b.clientGroup || ''
        break
      case 'partner':
        aValue = a.partner || ''
        bValue = b.partner || ''
        break
      case 'clientManager':
        aValue = a.clientManager || ''
        bValue = b.clientManager || ''
        break
      case 'currentYear':
        aValue = a.currentYear
        bValue = b.currentYear
        break
      case 'lastYear':
        aValue = a.lastYear
        bValue = b.lastYear
        break
      case 'change':
        aValue = calculateChange(a.currentYear, a.lastYear)
        bValue = calculateChange(b.currentYear, b.lastYear)
        break
      default:
        return 0
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue)
      return sortDirection === 'asc' ? comparison : -comparison
    }
    const comparison = (aValue as number) - (bValue as number)
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  const totalCurrentYear = sortedData.reduce((sum, item) => sum + item.currentYear, 0)
  const totalLastYear = sortedData.reduce((sum, item) => sum + item.lastYear, 0)

  const currentYearHeader = monthLabel
    ? `Current Year (${monthLabel.currentYear})`
    : formattedLastUpdated
      ? `Current Year (YTD to ${formattedLastUpdated})`
      : 'Current Year'
  const lastYearHeader = monthLabel
    ? `Last Year (${monthLabel.lastYear})`
    : 'Last Year (Full Year)'

  const handleDownloadExcel = () => {
    const rows = sortedData.map((item) => {
      const change = calculateChange(item.currentYear, item.lastYear)
      return {
        'Client Group': item.clientGroup,
        Partner: item.partner || '',
        'Client Manager': item.clientManager || '',
        [currentYearHeader]: item.currentYear,
        [lastYearHeader]: item.lastYear,
        'Change (%)': Number(change.toFixed(1)),
      }
    })
    const totalChange = calculateChange(totalCurrentYear, totalLastYear)
    rows.push({
      'Client Group': 'Total',
      Partner: '',
      'Client Manager': '',
      [currentYearHeader]: totalCurrentYear,
      [lastYearHeader]: totalLastYear,
      'Change (%)': Number(totalChange.toFixed(1)),
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 20 }, { wch: 28 }, { wch: 24 }, { wch: 12 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Billable by Client Group')
    XLSX.writeFile(workbook, `billable_by_client_group_${excelTimestamp()}.xlsx`)
  }

  return (
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="relative py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Billable by Client Group</CardTitle>
        <button
          type="button"
          onClick={handleDownloadExcel}
          aria-label="Download as Excel"
          title="Download as Excel"
          className="absolute right-2 inset-y-0 my-auto h-6 w-6 inline-flex items-center justify-center rounded-md text-slate-600 hover:text-emerald-700 hover:bg-white/60 active:scale-95 transition-all"
        >
          <Download className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b bg-slate-50/50">
                <th
                  className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r"
                  onClick={() => handleSort('clientGroup')}
                >
                  Client Group
                  <SortIcon column="clientGroup" />
                </th>
                <th
                  className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r"
                  onClick={() => handleSort('partner')}
                >
                  Partner
                  <SortIcon column="partner" />
                </th>
                <th
                  className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r"
                  onClick={() => handleSort('clientManager')}
                >
                  Client Manager
                  <SortIcon column="clientManager" />
                </th>
                <th
                  className="text-right p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30 max-w-[140px]"
                  onClick={() => handleSort('currentYear')}
                >
                  Current Year
                  {monthLabel ? (
                    <span className="font-normal text-slate-500 text-[9px]"> ({monthLabel.currentYear})</span>
                  ) : (
                    formattedLastUpdated && (
                      <span className="font-normal text-slate-500 text-[9px]"> (YTD to {formattedLastUpdated})</span>
                    )
                  )}
                  <SortIcon column="currentYear" />
                </th>
                <th
                  className="text-right p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30"
                  onClick={() => handleSort('lastYear')}
                >
                  Last Year
                  {monthLabel ? (
                    <span className="font-normal text-slate-500 text-[9px]"> ({monthLabel.lastYear})</span>
                  ) : (
                    <span className="font-normal text-slate-500 text-[9px]"> (Full Year)</span>
                  )}
                  <SortIcon column="lastYear" />
                </th>
                <th
                  className="text-right p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSort('change')}
                >
                  Change
                  <SortIcon column="change" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedData.map((item, index) => {
                const change = calculateChange(item.currentYear, item.lastYear)
                const changeColor = change >= 0 ? 'text-emerald-600' : 'text-red-600'

                return (
                  <tr key={index} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-2 border-r">{item.clientGroup}</td>
                    <td className="p-2 border-r">{item.partner || '-'}</td>
                    <td className="p-2 border-r">{item.clientManager || '-'}</td>
                    <td className="p-2 text-right font-medium border-r max-w-[140px]">
                      {formatCurrency(item.currentYear)}
                    </td>
                    <td className="p-2 text-right text-slate-500 border-r">{formatCurrency(item.lastYear)}</td>
                    <td className={`p-2 text-right font-bold ${changeColor}`}>
                      {change >= 0 ? '+' : ''}
                      {change.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-slate-200 font-bold bg-slate-50/80 rounded-b-lg">
                <td className="p-2 border-r rounded-bl-lg">Total</td>
                <td className="p-2 border-r"></td>
                <td className="p-2 border-r"></td>
                <td className="p-2 text-right border-r max-w-[140px]">{formatCurrency(totalCurrentYear)}</td>
                <td className="p-2 text-right border-r">{formatCurrency(totalLastYear)}</td>
                <td
                  className={`p-2 text-right rounded-br-lg ${
                    calculateChange(totalCurrentYear, totalLastYear) >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {calculateChange(totalCurrentYear, totalLastYear) >= 0 ? '+' : ''}
                  {calculateChange(totalCurrentYear, totalLastYear).toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
