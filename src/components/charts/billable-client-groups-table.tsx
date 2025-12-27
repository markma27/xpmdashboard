'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TableSkeleton } from './chart-skeleton'

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
  filters = []
}: BillableClientGroupsTableProps) {
  const [data, setData] = useState<ClientGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>('currentYear')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Fetch client group data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        // Build query with optional month and filters (staff filter is now part of filters array)
        let url = `/api/billable/client-groups?organizationId=${organizationId}&t=${Date.now()}`
        if (selectedMonth) {
          url += `&month=${encodeURIComponent(selectedMonth)}`
        }
        
        // Add filters to URL
        if (filters.length > 0) {
          const filtersParam = filters
            .filter((f) => f.value && f.value !== 'all' && f.value.trim() !== '') // Exclude 'all' values and empty strings
            .map((f) => {
              if (f.operator) {
                return `${f.type}:${f.operator}:${encodeURIComponent(f.value)}`
              }
              return `${f.type}:${encodeURIComponent(f.value)}`
            })
            .join('|')
          if (filtersParam) {
            url += `&filters=${encodeURIComponent(filtersParam)}`
          }
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
  }, [organizationId, selectedMonth, filters])

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
      <Card>
        <CardHeader>
          <CardTitle>Billable by Client Group</CardTitle>
          <CardDescription>Detailed billable amount breakdown by client group</CardDescription>
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
          <CardTitle>Billable by Client Group</CardTitle>
          <CardDescription>Detailed billable amount breakdown by client group</CardDescription>
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
    <Card>
      <CardHeader>
        <CardTitle>Billable by Client Group</CardTitle>
        <CardDescription>Detailed billable amount breakdown by client group</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th 
                  className="text-left p-3 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('clientGroup')}
                >
                  Client Group<SortIcon column="clientGroup" />
                </th>
                <th 
                  className="text-left p-3 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('partner')}
                >
                  Partner<SortIcon column="partner" />
                </th>
                <th 
                  className="text-left p-3 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('clientManager')}
                >
                  Client Manager<SortIcon column="clientManager" />
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('currentYear')}
                >
                  Current Year<SortIcon column="currentYear" />
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('lastYear')}
                >
                  Last Year<SortIcon column="lastYear" />
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('change')}
                >
                  Change<SortIcon column="change" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, index) => {
                const change = calculateChange(item.currentYear, item.lastYear)
                const changeColor = change >= 0 ? 'text-green-600' : 'text-red-600'
                
                return (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="p-3">{item.clientGroup}</td>
                    <td className="p-3">{item.partner || '-'}</td>
                    <td className="p-3">{item.clientManager || '-'}</td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(item.currentYear)}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {formatCurrency(item.lastYear)}
                    </td>
                    <td className={`p-3 text-right ${changeColor}`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 font-semibold bg-muted/30">
                <td className="p-3">Total</td>
                <td className="p-3"></td>
                <td className="p-3"></td>
                <td className="p-3 text-right">
                  {formatCurrency(totalCurrentYear)}
                </td>
                <td className="p-3 text-right">
                  {formatCurrency(totalLastYear)}
                </td>
                <td className={`p-3 text-right ${calculateChange(totalCurrentYear, totalLastYear) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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

