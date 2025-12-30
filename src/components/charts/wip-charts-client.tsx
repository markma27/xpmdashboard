'use client'

import { useEffect, useState } from 'react'
import { WIPPartnerChart } from './wip-partner-chart'
import { WIPClientManagerChart } from './wip-client-manager-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'

interface PartnerData {
  partner: string
  amount: number
}

interface ClientManagerData {
  clientManager: string
  amount: number
}

interface WIPChartsClientProps {
  organizationId: string
  selectedPartner?: string | null
  selectedClientManager?: string | null
}

export function WIPChartsClient({ 
  organizationId,
  selectedPartner,
  selectedClientManager
}: WIPChartsClientProps) {
  const [partnerData, setPartnerData] = useState<PartnerData[]>([])
  const [clientManagerData, setClientManagerData] = useState<ClientManagerData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        // Build query with optional filters
        let queryParams = `organizationId=${organizationId}&t=${Date.now()}`
        if (selectedPartner) {
          queryParams += `&partner=${encodeURIComponent(selectedPartner)}`
        }
        if (selectedClientManager) {
          queryParams += `&clientManager=${encodeURIComponent(selectedClientManager)}`
        }
        
        // Fetch both datasets in parallel
        const [partnerResponse, managerResponse] = await Promise.all([
          fetch(`/api/wip/by-partner?${queryParams}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          }),
          fetch(`/api/wip/by-client-manager?${queryParams}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          }),
        ])
        
        if (!partnerResponse.ok || !managerResponse.ok) {
          throw new Error('Failed to fetch WIP data')
        }
        
        const partnerResult = await partnerResponse.json()
        const managerResult = await managerResponse.json()
        
        setPartnerData(partnerResult)
        setClientManagerData(managerResult)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, selectedPartner, selectedClientManager])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartSkeleton title="WIP by Partner" />
        <ChartSkeleton title="WIP by Client Manager" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">WIP Charts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-destructive">Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">WIP by Partner</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {partnerData.length === 0 ? (
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-muted-foreground">No data available</p>
            </div>
          ) : (
            <WIPPartnerChart data={partnerData} />
          )}
        </CardContent>
      </Card>
      <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">WIP by Client Manager</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {clientManagerData.length === 0 ? (
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-muted-foreground">No data available</p>
            </div>
          ) : (
            <WIPClientManagerChart data={clientManagerData} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

