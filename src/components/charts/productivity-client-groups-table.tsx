'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TableSkeleton } from './chart-skeleton'
import { useProductivityReport } from './productivity-report-context'

interface ClientGroupData {
  clientGroup: string
  currentYear: number
  lastYear: number
  currentYearAmount?: number
  lastYearAmount?: number
  partner: string | null
  clientManager: string | null
}

type SortColumn = 'clientGroup' | 'partner' | 'clientManager' | 'currentYear' | 'lastYear' | 'currentYearAmount' | 'lastYearAmount' | 'currentYearRate' | 'lastYearRate' | 'change'
type SortDirection = 'asc' | 'desc'

interface ProductivityClientGroupsTableProps {
  organizationId: string
  selectedStaff?: string | null
  onStaffChange?: (staff: string | null) => void
  selectedMonth?: string | null
  asOfDate?: string
}

export function ProductivityClientGroupsTable({ 
  organizationId, 
  selectedStaff: externalSelectedStaff,
  onStaffChange,
  selectedMonth,
  asOfDate
}: ProductivityClientGroupsTableProps) {
  const { lastUpdated } = useProductivityReport()
  const [data, setData] = useState<ClientGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internalSelectedStaff, setInternalSelectedStaff] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>('currentYear')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  
  // Use external selectedStaff if provided, otherwise use internal state
  const selectedStaff = externalSelectedStaff !== undefined ? externalSelectedStaff : internalSelectedStaff

  // Format date as DD MMM YYYY for column header
  const formatDateForHeader = (dateString: string | null) => {
    if (!dateString) return null
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }

  const formattedLastUpdated = formatDateForHeader(lastUpdated)

  // Fetch client group data
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
        
        // Build query with optional staff, month, date filters, and saved filters
        let url = `/api/productivity/client-groups?organizationId=${organizationId}&t=${Date.now()}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`
        if (selectedStaff) {
          url += `&staff=${encodeURIComponent(selectedStaff)}`
        }
        if (selectedMonth) {
          url += `&month=${encodeURIComponent(selectedMonth)}`
        }
        
        // Add staff filter to billableFilters if selectedStaff is provided
        let filtersWithStaff = [...billableFilters]
        if (selectedStaff) {
          // Remove existing staff filter if any, then add the new one
          filtersWithStaff = filtersWithStaff.filter(f => f.type !== 'staff')
          filtersWithStaff.push({ type: 'staff', value: selectedStaff })
        }
        
        // Add filters parameter if filters exist
        if (filtersWithStaff.length > 0) {
          url += `&filters=${encodeURIComponent(JSON.stringify(filtersWithStaff))}`
        }
        
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch client group data')
        }
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, selectedStaff, selectedMonth, asOfDate])

  const formatHours = (hours: number) => {
    if (hours === 0) return '-'
    return Math.round(hours).toLocaleString('en-US')
  }

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatRate = (amount: number, hours: number) => {
    if (hours === 0 || amount === 0) return '-'
    const rate = amount / hours
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(rate)
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
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Billable & Average Rate by Client Group</CardTitle>
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
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Billable & Average Rate by Client Group</CardTitle>
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

  // No client-side filtering needed - API handles staff filtering
  const filteredData = data

  // Sort data
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
      case 'currentYearAmount':
        aValue = a.currentYearAmount || 0
        bValue = b.currentYearAmount || 0
        break
      case 'lastYearAmount':
        aValue = a.lastYearAmount || 0
        bValue = b.lastYearAmount || 0
        break
      case 'currentYearRate':
        aValue = (a.currentYearAmount || 0) / (a.currentYear || 1)
        bValue = (b.currentYearAmount || 0) / (b.currentYear || 1)
        break
      case 'lastYearRate':
        aValue = (a.lastYearAmount || 0) / (a.lastYear || 1)
        bValue = (b.lastYearAmount || 0) / (b.lastYear || 1)
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
    } else {
      const comparison = (aValue as number) - (bValue as number)
      return sortDirection === 'asc' ? comparison : -comparison
    }
  })

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column and default to descending
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

  return (
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Billable & Average Rate by Client Group</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b bg-slate-50/50">
                <th 
                  rowSpan={2}
                  className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none align-bottom border-r"
                  onClick={() => handleSort('clientGroup')}
                >
                  Client Group<SortIcon column="clientGroup" />
                </th>
                <th 
                  rowSpan={2}
                  className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none align-bottom border-r"
                  onClick={() => handleSort('partner')}
                >
                  Partner<SortIcon column="partner" />
                </th>
                <th 
                  rowSpan={2}
                  className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none align-bottom border-r"
                  onClick={() => handleSort('clientManager')}
                >
                  Client Manager<SortIcon column="clientManager" />
                </th>
                <th 
                  colSpan={3}
                  className="text-center p-2 font-bold text-slate-700 bg-slate-100/50 uppercase tracking-wider text-[10px] border-r"
                >
                  Current Year{formattedLastUpdated && <span className="font-normal text-slate-500 text-[9px] normal-case ml-1">(YTD to {formattedLastUpdated})</span>}
                </th>
                <th 
                  colSpan={3}
                  className="text-center p-2 font-bold text-slate-700 bg-slate-100/50 uppercase tracking-wider text-[10px] border-r"
                >
                  Last Year<span className="font-normal text-slate-500 text-[9px] normal-case ml-1">(Full Year)</span>
                </th>
                <th 
                  rowSpan={2}
                  className="text-right p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap align-bottom"
                  onClick={() => handleSort('change')}
                >
                  Change<SortIcon column="change" />
                  <div className="text-[9px] font-normal text-slate-500 mt-1">(Hours)</div>
                </th>
              </tr>
              <tr className="border-b bg-slate-50/30">
                <th 
                  className="text-right p-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap border-r bg-slate-50/30"
                  onClick={() => handleSort('currentYear')}
                >
                  Billable Hours<SortIcon column="currentYear" />
                </th>
                <th 
                  className="text-right p-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap border-r bg-slate-50/30"
                  onClick={() => handleSort('currentYearAmount')}
                >
                  Billable $<SortIcon column="currentYearAmount" />
                </th>
                <th 
                  className="text-right p-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap border-r bg-slate-50/30"
                  onClick={() => handleSort('currentYearRate')}
                >
                  Ave. Rate<SortIcon column="currentYearRate" />
                </th>
                <th 
                  className="text-right p-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap border-r bg-slate-50/30"
                  onClick={() => handleSort('lastYear')}
                >
                  Billable Hours<SortIcon column="lastYear" />
                </th>
                <th 
                  className="text-right p-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap border-r bg-slate-50/30"
                  onClick={() => handleSort('lastYearAmount')}
                >
                  Billable $<SortIcon column="lastYearAmount" />
                </th>
                <th 
                  className="text-right p-2 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap border-r bg-slate-50/30"
                  onClick={() => handleSort('lastYearRate')}
                >
                  Ave. Rate<SortIcon column="lastYearRate" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedData.map((item, index) => {
                const change = calculateChange(item.currentYear, item.lastYear)
                const changeColor = change >= 0 ? 'text-emerald-600' : 'text-red-600'
                const currentYearAmount = item.currentYearAmount || 0
                const lastYearAmount = item.lastYearAmount || 0
                
                return (
                  <tr key={index} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-2 border-r">{item.clientGroup}</td>
                    <td className="p-2 border-r">{item.partner || '-'}</td>
                    <td className="p-2 border-r">{item.clientManager || '-'}</td>
                    <td className="p-2 text-right font-medium whitespace-nowrap border-r">
                      {formatHours(item.currentYear)}
                    </td>
                    <td className="p-2 text-right font-medium whitespace-nowrap border-r">
                      {formatCurrency(currentYearAmount)}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap border-r">
                      {formatRate(currentYearAmount, item.currentYear)}
                    </td>
                    <td className="p-2 text-right text-slate-500 whitespace-nowrap border-r">
                      {formatHours(item.lastYear)}
                    </td>
                    <td className="p-2 text-right text-slate-500 whitespace-nowrap border-r">
                      {formatCurrency(lastYearAmount)}
                    </td>
                    <td className="p-2 text-right text-slate-500 whitespace-nowrap border-r">
                      {formatRate(lastYearAmount, item.lastYear)}
                    </td>
                    <td className={`p-2 text-right whitespace-nowrap font-bold ${changeColor}`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-slate-200 font-bold bg-slate-50/80 rounded-b-lg">
                <td className="p-2 border-r rounded-bl-lg">Total</td>
                <td className="p-2 border-r"></td>
                <td className="p-2 border-r"></td>
                <td className="p-2 text-right whitespace-nowrap border-r">
                  {formatHours(totalCurrentYear)}
                </td>
                <td className="p-2 text-right whitespace-nowrap border-r">
                  {formatCurrency(sortedData.reduce((sum, item) => sum + (item.currentYearAmount || 0), 0))}
                </td>
                <td className="p-2 text-right whitespace-nowrap border-r">
                  {formatRate(
                    sortedData.reduce((sum, item) => sum + (item.currentYearAmount || 0), 0),
                    totalCurrentYear
                  )}
                </td>
                <td className="p-2 text-right whitespace-nowrap border-r">
                  {formatHours(totalLastYear)}
                </td>
                <td className="p-2 text-right whitespace-nowrap border-r">
                  {formatCurrency(sortedData.reduce((sum, item) => sum + (item.lastYearAmount || 0), 0))}
                </td>
                <td className="p-2 text-right whitespace-nowrap border-r">
                  {formatRate(
                    sortedData.reduce((sum, item) => sum + (item.lastYearAmount || 0), 0),
                    totalLastYear
                  )}
                </td>
                <td className={`p-2 text-right whitespace-nowrap rounded-br-lg ${calculateChange(totalCurrentYear, totalLastYear) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
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

