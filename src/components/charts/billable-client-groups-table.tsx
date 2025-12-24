'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ClientGroupData {
  clientGroup: string
  currentYear: number
  lastYear: number
  partner: string | null
  clientManager: string | null
}

interface BillableClientGroupsTableProps {
  organizationId: string
  selectedStaff?: string | null
  onStaffChange?: (staff: string | null) => void
}

export function BillableClientGroupsTable({ 
  organizationId, 
  selectedStaff: externalSelectedStaff,
  onStaffChange 
}: BillableClientGroupsTableProps) {
  const [data, setData] = useState<ClientGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internalSelectedStaff, setInternalSelectedStaff] = useState<string | null>(null)
  
  // Use external selectedStaff if provided, otherwise use internal state
  const selectedStaff = externalSelectedStaff !== undefined ? externalSelectedStaff : internalSelectedStaff

  // Fetch client group data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        // Build query with optional staff filter
        let url = `/api/billable/client-groups?organizationId=${organizationId}&t=${Date.now()}`
        if (selectedStaff) {
          url += `&staff=${encodeURIComponent(selectedStaff)}`
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
  }, [organizationId, selectedStaff])

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
          <CardTitle>Billable by Client Group</CardTitle>
          <CardDescription>Detailed billable amount breakdown by client group</CardDescription>
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

  const totalCurrentYear = filteredData.reduce((sum, item) => sum + item.currentYear, 0)
  const totalLastYear = filteredData.reduce((sum, item) => sum + item.lastYear, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billable by Client Group</CardTitle>
        <CardDescription>Detailed billable amount breakdown by client group</CardDescription>
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

