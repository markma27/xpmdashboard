'use client'

import { useState, useEffect } from 'react'
import { RecoverabilityMonthlyChartClient } from './recoverability-monthly-chart-client'
import { RecoverabilityClientGroupsTable } from './recoverability-client-groups-table'
import { RecoverabilityReportHeader } from './recoverability-report-header'

interface ClientGroupData {
  clientGroup: string
  currentYear: number
  lastYear: number
  partner: string | null
  clientManager: string | null
}

interface RecoverabilityReportContainerProps {
  organizationId: string
}

export function RecoverabilityReportContainer({ organizationId }: RecoverabilityReportContainerProps) {
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null)
  const [selectedClientManager, setSelectedClientManager] = useState<string | null>(null)
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
            `/api/recoverability/client-groups?organizationId=${organizationId}&t=${Date.now()}`,
            {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              },
            }
          ),
          fetch(
            `/api/recoverability/last-upload?organizationId=${organizationId}&t=${Date.now()}`,
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
        console.error('Failed to fetch recoverability data:', err)
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
      <RecoverabilityReportHeader
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
        partners={partners}
        clientManagers={clientManagers}
        onPartnerChange={setSelectedPartner}
        onClientManagerChange={setSelectedClientManager}
        lastUpdated={lastUpdated}
      />
      <RecoverabilityMonthlyChartClient 
        organizationId={organizationId}
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
      />
      <RecoverabilityClientGroupsTable 
        organizationId={organizationId}
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
      />
    </>
  )
}

