'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TableSkeleton } from './chart-skeleton'
import { useRevenueReport } from './revenue-report-context'

interface ClientGroupData {
  clientGroup: string
  currentYear: number
  lastYear: number
  partner: string | null
  clientManager: string | null
}

type SortColumn = 'clientGroup' | 'partner' | 'clientManager' | 'currentYear' | 'lastYear' | 'change'
type SortDirection = 'asc' | 'desc'

interface RevenueClientGroupsTableProps {
  organizationId: string
  selectedPartner?: string | null
  selectedClientManager?: string | null
  selectedMonth?: string | null
}

export function RevenueClientGroupsTable({ 
  organizationId,
  selectedPartner: externalSelectedPartner,
  selectedClientManager: externalSelectedClientManager,
  selectedMonth
}: RevenueClientGroupsTableProps) {
  const { lastUpdated } = useRevenueReport()
  const [data, setData] = useState<ClientGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internalSelectedPartner, setInternalSelectedPartner] = useState<string | null>(null)
  const [internalSelectedClientManager, setInternalSelectedClientManager] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>('currentYear')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  
  // Use external values if provided, otherwise use internal state
  const selectedPartner = externalSelectedPartner !== undefined ? externalSelectedPartner : internalSelectedPartner
  const selectedClientManager = externalSelectedClientManager !== undefined ? externalSelectedClientManager : internalSelectedClientManager

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

  // Format month label for column header when a specific month is selected
  const formatMonthLabel = (monthString: string | null | undefined): { currentYear: string; lastYear: string } | null => {
    if (!monthString) return null
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    
    // Find the month index (0-11)
    const monthIndex = fullMonthNames.findIndex(m => m.toLowerCase() === monthString.toLowerCase())
    if (monthIndex === -1) return null
    
    // Determine the year based on financial year logic and lastUpdated date
    // Financial year runs July to June
    const now = new Date()
    const currentCalendarYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-11
    
    // Determine current financial year start year
    let currentFYStartYear: number
    if (currentMonth >= 6) {
      // July-December: FY starts this year
      currentFYStartYear = currentCalendarYear
    } else {
      // January-June: FY started last year
      currentFYStartYear = currentCalendarYear - 1
    }
    
    // For the selected month, determine which financial year it belongs to
    // Months July-Dec belong to FY starting in the same calendar year
    // Months Jan-Jun belong to FY starting in the previous calendar year
    let selectedMonthYear: number
    if (monthIndex >= 6) {
      // July-December: belongs to FY starting in the same calendar year
      selectedMonthYear = currentFYStartYear
    } else {
      // January-June: belongs to FY starting in the previous calendar year
      selectedMonthYear = currentFYStartYear + 1
    }
    
    const currentYearLabel = `${monthNames[monthIndex]} ${selectedMonthYear}`
    const lastYearLabel = `${monthNames[monthIndex]} ${selectedMonthYear - 1}`
    
    return { currentYear: currentYearLabel, lastYear: lastYearLabel }
  }

  const formattedLastUpdated = formatDateForHeader(lastUpdated)
  const monthLabel = formatMonthLabel(selectedMonth)

  useEffect(() => {
    async function fetchData() {
      try {
        // Clear data first to ensure skeleton shows
        setData([])
        setError(null)
        setLoading(true)
        // Add cache control and timestamp to ensure fresh data on every fetch
        let url = `/api/revenue/client-groups?organizationId=${organizationId}&t=${Date.now()}`
        if (selectedMonth) {
          url += `&month=${encodeURIComponent(selectedMonth)}`
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
  }, [organizationId, selectedMonth])

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
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Invoices by Client Group</CardTitle>
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
        <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Invoices by Client Group</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-muted-foreground">
              No data available. Please upload invoice data first.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Get unique partners from data
  const partners = Array.from(
    new Set(data.map((item) => item.partner).filter(Boolean))
  ).sort() as string[]

  // Get unique client managers from data
  const clientManagers = Array.from(
    new Set(data.map((item) => item.clientManager).filter(Boolean))
  ).sort() as string[]

  // Filter data by selected partner and client manager
  const filteredData = data.filter((item) => {
    const matchesPartner = !selectedPartner || item.partner === selectedPartner
    const matchesClientManager = !selectedClientManager || item.clientManager === selectedClientManager
    return matchesPartner && matchesClientManager
  })

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
      <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Invoices by Client Group</CardTitle>
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
                  Client Group<SortIcon column="clientGroup" />
                </th>
                <th 
                  className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r"
                  onClick={() => handleSort('partner')}
                >
                  Partner<SortIcon column="partner" />
                </th>
                <th 
                  className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r"
                  onClick={() => handleSort('clientManager')}
                >
                  Client Manager<SortIcon column="clientManager" />
                </th>
                <th 
                  className="text-right p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30 max-w-[140px]"
                  onClick={() => handleSort('currentYear')}
                >
                  Current Year{monthLabel ? <span className="font-normal text-slate-500 text-[9px]"> ({monthLabel.currentYear})</span> : formattedLastUpdated && <span className="font-normal text-slate-500 text-[9px]"> (YTD to {formattedLastUpdated})</span>}<SortIcon column="currentYear" />
                </th>
                <th 
                  className="text-right p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30"
                  onClick={() => handleSort('lastYear')}
                >
                  Last Year{monthLabel ? <span className="font-normal text-slate-500 text-[9px]"> ({monthLabel.lastYear})</span> : <span className="font-normal text-slate-500 text-[9px]"> (Full Year)</span>}<SortIcon column="lastYear" />
                </th>
                <th 
                  className="text-right p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSort('change')}
                >
                  Change<SortIcon column="change" />
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
                    <td className={`p-2 text-right font-medium border-r max-w-[140px] ${item.currentYear < 0 ? 'text-red-600' : ''}`}>
                      {formatCurrency(item.currentYear)}
                    </td>
                    <td className="p-2 text-right text-slate-500 border-r">
                      {formatCurrency(item.lastYear)}
                    </td>
                    <td className={`p-2 text-right font-bold ${changeColor}`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-slate-200 font-bold bg-slate-50/80 rounded-b-lg">
                <td className="p-2 border-r rounded-bl-lg">Total</td>
                <td className="p-2 border-r"></td>
                <td className="p-2 border-r"></td>
                <td className="p-2 text-right border-r max-w-[140px]">
                  {formatCurrency(totalCurrentYear)}
                </td>
                <td className="p-2 text-right border-r">
                  {formatCurrency(totalLastYear)}
                </td>
                <td className={`p-2 text-right rounded-br-lg ${calculateChange(totalCurrentYear, totalLastYear) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
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

