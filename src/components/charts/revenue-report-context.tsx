'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ClientGroupData {
  clientGroup: string
  currentYear: number
  lastYear: number
  partner: string | null
  clientManager: string | null
}

interface RevenueReportContextValue {
  selectedPartner: string | null
  setSelectedPartner: (partner: string | null) => void
  selectedClientManager: string | null
  setSelectedClientManager: (manager: string | null) => void
  selectedMonth: string | null
  setSelectedMonth: (month: string | null) => void
  partners: string[]
  clientManagers: string[]
  lastUpdated: string | null
  loading: boolean
}

const RevenueReportContext = createContext<RevenueReportContextValue | undefined>(undefined)

export function RevenueReportProvider({ 
  organizationId, 
  children 
}: { 
  organizationId: string
  children: ReactNode 
}) {
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null)
  const [selectedClientManager, setSelectedClientManager] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [data, setData] = useState<ClientGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

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
        console.error('Failed to fetch invoice data:', err)
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
    <RevenueReportContext.Provider value={{
      selectedPartner,
      setSelectedPartner,
      selectedClientManager,
      setSelectedClientManager,
      selectedMonth,
      setSelectedMonth,
      partners,
      clientManagers,
      lastUpdated,
      loading,
    }}>
      {children}
    </RevenueReportContext.Provider>
  )
}

export function useRevenueReport() {
  const context = useContext(RevenueReportContext)
  if (!context) {
    throw new Error('useRevenueReport must be used within RevenueReportProvider')
  }
  return context
}
