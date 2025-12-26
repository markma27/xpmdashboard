'use client'

import { useState, useEffect } from 'react'
import { RevenueMonthlyChartClient } from './revenue-monthly-chart-client'
import { RevenueClientGroupsTable } from './revenue-client-groups-table'
import { RevenueReportHeader } from './revenue-report-header'

interface ClientGroupData {
  clientGroup: string
  currentYear: number
  lastYear: number
  partner: string | null
  clientManager: string | null
}

interface RevenueReportContainerProps {
  organizationId: string
}

export function RevenueReportContainer({ organizationId }: RevenueReportContainerProps) {
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null)
  const [selectedClientManager, setSelectedClientManager] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [data, setData] = useState<ClientGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Fetch data to extract partners and client managers
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [dataResponse, lastUploadResponse] = await Promise.all([
          fetch(
            `/api/revenue/client-groups?organizationId=${organizationId}&t=${Date.now()}`,
            {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              },
            }
          ),
          fetch(
            `/api/invoice/last-upload?organizationId=${organizationId}&t=${Date.now()}`,
            {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              },
            }
          ),
        ])
        
        if (dataResponse.ok) {
          const result = await dataResponse.json()
          setData(result)
        }
        
        if (lastUploadResponse.ok) {
          const uploadResult = await lastUploadResponse.json()
          setLastUpdated(uploadResult.lastUploadDate)
        }
      } catch (err) {
        console.error('Failed to fetch revenue data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId])

  // Extract unique partners and client managers from data
  const partners = Array.from(
    new Set(data.map((item) => item.partner).filter(Boolean))
  ).sort() as string[]

  const clientManagers = Array.from(
    new Set(data.map((item) => item.clientManager).filter(Boolean))
  ).sort() as string[]

  return (
    <>
      <RevenueReportHeader
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
        partners={partners}
        clientManagers={clientManagers}
        onPartnerChange={setSelectedPartner}
        onClientManagerChange={setSelectedClientManager}
        lastUpdated={lastUpdated}
      />
      <RevenueMonthlyChartClient 
        organizationId={organizationId}
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
        selectedMonth={selectedMonth}
        onMonthClick={setSelectedMonth}
      />
      <RevenueClientGroupsTable 
        organizationId={organizationId}
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
        selectedMonth={selectedMonth}
      />
    </>
  )
}

