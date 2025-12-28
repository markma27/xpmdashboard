'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ClientGroupData {
  clientGroup: string
  amount: number
  partner: string | null
  clientManager: string | null
}

interface WIPReportContextValue {
  selectedPartner: string | null
  setSelectedPartner: (partner: string | null) => void
  selectedClientManager: string | null
  setSelectedClientManager: (manager: string | null) => void
  partners: string[]
  clientManagers: string[]
  lastUpdated: string | null
  loading: boolean
}

const WIPReportContext = createContext<WIPReportContextValue | undefined>(undefined)

export function WIPReportProvider({ 
  organizationId, 
  children 
}: { 
  organizationId: string
  children: ReactNode 
}) {
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null)
  const [selectedClientManager, setSelectedClientManager] = useState<string | null>(null)
  const [data, setData] = useState<ClientGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

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

  const partners = Array.from(
    new Set(data.map((item) => item.partner).filter(Boolean))
  ).sort() as string[]

  const clientManagers = Array.from(
    new Set(data.map((item) => item.clientManager).filter(Boolean))
  ).sort() as string[]

  return (
    <WIPReportContext.Provider value={{
      selectedPartner,
      setSelectedPartner,
      selectedClientManager,
      setSelectedClientManager,
      partners,
      clientManagers,
      lastUpdated,
      loading,
    }}>
      {children}
    </WIPReportContext.Provider>
  )
}

export function useWIPReport() {
  const context = useContext(WIPReportContext)
  if (!context) {
    throw new Error('useWIPReport must be used within WIPReportProvider')
  }
  return context
}
