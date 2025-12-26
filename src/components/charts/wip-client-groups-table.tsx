'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ClientGroupData {
  clientGroup: string
  amount: number
  partner: string | null
  clientManager: string | null
  aging: {
    lessThan30: number
    days30to60: number
    days60to90: number
    days90to120: number
    days120Plus: number
  }
}

interface WIPClientGroupsTableProps {
  organizationId: string
  selectedPartner?: string | null
  selectedClientManager?: string | null
}

type SortColumn = 'clientGroup' | 'partner' | 'clientManager' | 'amount' | 'lessThan30' | 'days30to60' | 'days60to90' | 'days90to120' | 'days120Plus'
type SortDirection = 'asc' | 'desc'

export function WIPClientGroupsTable({ 
  organizationId,
  selectedPartner: externalSelectedPartner,
  selectedClientManager: externalSelectedClientManager
}: WIPClientGroupsTableProps) {
  const [data, setData] = useState<ClientGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>('amount')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        // Build query with optional filters
        let url = `/api/wip/client-groups?organizationId=${organizationId}&t=${Date.now()}`
        if (externalSelectedPartner) {
          url += `&partner=${encodeURIComponent(externalSelectedPartner)}`
        }
        if (externalSelectedClientManager) {
          url += `&clientManager=${encodeURIComponent(externalSelectedClientManager)}`
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
  }, [organizationId, externalSelectedPartner, externalSelectedClientManager])

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>WIP by Client Group</CardTitle>
          <CardDescription>Detailed WIP breakdown by client group</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>WIP by Client Group</CardTitle>
          <CardDescription>Detailed WIP breakdown by client group</CardDescription>
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
          <CardTitle>WIP by Client Group</CardTitle>
          <CardDescription>Detailed WIP breakdown by client group</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-muted-foreground">
              No data available. Please upload WIP timesheet data first.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Filter data by selected partner and client manager
  const filteredData = data.filter((item) => {
    const matchesPartner = !externalSelectedPartner || item.partner === externalSelectedPartner
    const matchesClientManager = !externalSelectedClientManager || item.clientManager === externalSelectedClientManager
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
      case 'amount':
        aValue = a.amount
        bValue = b.amount
        break
      case 'lessThan30':
        aValue = a.aging?.lessThan30 || 0
        bValue = b.aging?.lessThan30 || 0
        break
      case 'days30to60':
        aValue = a.aging?.days30to60 || 0
        bValue = b.aging?.days30to60 || 0
        break
      case 'days60to90':
        aValue = a.aging?.days60to90 || 0
        bValue = b.aging?.days60to90 || 0
        break
      case 'days90to120':
        aValue = a.aging?.days90to120 || 0
        bValue = b.aging?.days90to120 || 0
        break
      case 'days120Plus':
        aValue = a.aging?.days120Plus || 0
        bValue = b.aging?.days120Plus || 0
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

  const totalAmount = sortedData.reduce((sum, item) => sum + item.amount, 0)
  const totalAging = sortedData.reduce(
    (acc, item) => ({
      lessThan30: acc.lessThan30 + (item.aging?.lessThan30 || 0),
      days30to60: acc.days30to60 + (item.aging?.days30to60 || 0),
      days60to90: acc.days60to90 + (item.aging?.days60to90 || 0),
      days90to120: acc.days90to120 + (item.aging?.days90to120 || 0),
      days120Plus: acc.days120Plus + (item.aging?.days120Plus || 0),
    }),
    { lessThan30: 0, days30to60: 0, days60to90: 0, days90to120: 0, days120Plus: 0 }
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>WIP by Client Group</CardTitle>
        <CardDescription>Detailed WIP breakdown by client group</CardDescription>
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
                  onClick={() => handleSort('amount')}
                >
                  WIP Amount<SortIcon column="amount" />
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('lessThan30')}
                >
                  &lt; 30 days<SortIcon column="lessThan30" />
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('days30to60')}
                >
                  30 - 60 days<SortIcon column="days30to60" />
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('days60to90')}
                >
                  60 - 90 days<SortIcon column="days60to90" />
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('days90to120')}
                >
                  90 - 120 days<SortIcon column="days90to120" />
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('days120Plus')}
                >
                  120 days +<SortIcon column="days120Plus" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, index) => (
                <tr key={index} className="border-b hover:bg-muted/50">
                  <td className="p-3">{item.clientGroup}</td>
                  <td className="p-3">{item.partner || '-'}</td>
                  <td className="p-3">{item.clientManager || '-'}</td>
                  <td className="p-3 text-right font-medium">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(item.aging?.lessThan30 || 0)}
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(item.aging?.days30to60 || 0)}
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(item.aging?.days60to90 || 0)}
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(item.aging?.days90to120 || 0)}
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(item.aging?.days120Plus || 0)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 font-semibold bg-muted/30">
                <td className="p-3">Total</td>
                <td className="p-3"></td>
                <td className="p-3"></td>
                <td className="p-3 text-right">
                  {formatCurrency(totalAmount)}
                </td>
                <td className="p-3 text-right">
                  {formatCurrency(totalAging.lessThan30)}
                </td>
                <td className="p-3 text-right">
                  {formatCurrency(totalAging.days30to60)}
                </td>
                <td className="p-3 text-right">
                  {formatCurrency(totalAging.days60to90)}
                </td>
                <td className="p-3 text-right">
                  {formatCurrency(totalAging.days90to120)}
                </td>
                <td className="p-3 text-right">
                  {formatCurrency(totalAging.days120Plus)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

