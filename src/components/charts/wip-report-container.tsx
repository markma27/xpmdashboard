'use client'

import { useState, useEffect } from 'react'
import { WIPChartsClient } from './wip-charts-client'
import { WIPClientGroupsTable } from './wip-client-groups-table'
import { WIPReportHeader } from './wip-report-header'
import { WIPAgingCharts } from './wip-aging-charts'

interface ClientGroupData {
  clientGroup: string
  amount: number
  partner: string | null
  clientManager: string | null
}

interface WIPReportContainerProps {
  organizationId: string
}

export function WIPReportContainer({ organizationId }: WIPReportContainerProps) {
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
            `/api/wip/client-groups?organizationId=${organizationId}&t=${Date.now()}`,
            {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              },
            }
          ),
          fetch(
            `/api/wip/last-upload?organizationId=${organizationId}&t=${Date.now()}`,
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
        console.error('Failed to fetch WIP data:', err)
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
      <WIPReportHeader
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
        partners={partners}
        clientManagers={clientManagers}
        onPartnerChange={setSelectedPartner}
        onClientManagerChange={setSelectedClientManager}
        lastUpdated={lastUpdated}
      />
      <WIPChartsClient 
        organizationId={organizationId}
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
      />
      <WIPAgingCharts 
        organizationId={organizationId}
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
      />
      <WIPClientGroupsTable 
        organizationId={organizationId}
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
      />
    </>
  )
}

