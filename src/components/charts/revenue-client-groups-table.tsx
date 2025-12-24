'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ClientGroupData {
  clientGroup: string
  currentYear: number
  lastYear: number
  partner: string | null
  clientManager: string | null
}

interface RevenueClientGroupsTableProps {
  organizationId: string
}

export function RevenueClientGroupsTable({ organizationId }: RevenueClientGroupsTableProps) {
  const [data, setData] = useState<ClientGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null)
  const [selectedClientManager, setSelectedClientManager] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(
          `/api/revenue/client-groups?organizationId=${organizationId}`
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
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billings by Client Group</CardTitle>
          <CardDescription>Detailed revenue breakdown by client group</CardDescription>
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
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle>Billings by Client Group</CardTitle>
            <CardDescription>Detailed revenue breakdown by client group</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Partner Filter Slicers */}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant={selectedPartner === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPartner(null)}
              >
                All Partners
              </Button>
              {partners.map((partner) => (
                <Button
                  key={partner}
                  variant={selectedPartner === partner ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPartner(partner)}
                >
                  {partner}
                </Button>
              ))}
            </div>
            
            {/* Client Manager Filter Slicers */}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant={selectedClientManager === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedClientManager(null)}
              >
                All Managers
              </Button>
              {clientManagers.map((manager) => (
                <Button
                  key={manager}
                  variant={selectedClientManager === manager ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedClientManager(manager)}
                >
                  {manager}
                </Button>
              ))}
            </div>
          </div>
        </div>
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

