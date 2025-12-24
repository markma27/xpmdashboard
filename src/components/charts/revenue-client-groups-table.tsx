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

interface RevenueClientGroupsTableProps {
  organizationId: string
  selectedPartner?: string | null
  selectedClientManager?: string | null
}

export function RevenueClientGroupsTable({ 
  organizationId,
  selectedPartner: externalSelectedPartner,
  selectedClientManager: externalSelectedClientManager
}: RevenueClientGroupsTableProps) {
  const [data, setData] = useState<ClientGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internalSelectedPartner, setInternalSelectedPartner] = useState<string | null>(null)
  const [internalSelectedClientManager, setInternalSelectedClientManager] = useState<string | null>(null)
  
  // Use external values if provided, otherwise use internal state
  const selectedPartner = externalSelectedPartner !== undefined ? externalSelectedPartner : internalSelectedPartner
  const selectedClientManager = externalSelectedClientManager !== undefined ? externalSelectedClientManager : internalSelectedClientManager

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        // Add cache control and timestamp to ensure fresh data on every fetch
        const response = await fetch(
          `/api/revenue/client-groups?organizationId=${organizationId}&t=${Date.now()}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }
        )
        
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
  }, [organizationId])

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
          <CardTitle>Billings by Client Group</CardTitle>
          <CardDescription>Detailed revenue breakdown by client group</CardDescription>
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
          <CardTitle>Billings by Client Group</CardTitle>
          <CardDescription>Detailed revenue breakdown by client group</CardDescription>
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

  const totalCurrentYear = filteredData.reduce((sum, item) => sum + item.currentYear, 0)
  const totalLastYear = filteredData.reduce((sum, item) => sum + item.lastYear, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billings by Client Group</CardTitle>
        <CardDescription>Detailed revenue breakdown by client group</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-semibold">Client Group</th>
                <th className="text-left p-3 font-semibold">Partner</th>
                <th className="text-left p-3 font-semibold">Client Manager</th>
                <th className="text-right p-3 font-semibold">Current Year</th>
                <th className="text-right p-3 font-semibold">Last Year</th>
                <th className="text-right p-3 font-semibold">Change</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, index) => {
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

