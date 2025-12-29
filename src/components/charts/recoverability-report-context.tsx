'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { BillableFilter } from './billable-filters'

interface RecoverabilityReportContextValue {
  selectedMonth: string | null
  setSelectedMonth: (month: string | null) => void
  staffList: string[]
  partnerList: string[]
  clientManagerList: string[]
  lastUpdated: string | null
  pendingFilters: BillableFilter[]
  setPendingFilters: (filters: BillableFilter[]) => void
  appliedFilters: BillableFilter[]
  setAppliedFilters: (filters: BillableFilter[]) => void
  savingFilters: boolean
  setSavingFilters: (saving: boolean) => void
  isInitializing: boolean
  handleSaveFilters: () => Promise<void>
  organizationId: string
}

const RecoverabilityReportContext = createContext<RecoverabilityReportContextValue | undefined>(undefined)

export function RecoverabilityReportProvider({ 
  organizationId, 
  children 
}: { 
  organizationId: string
  children: ReactNode 
}) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [staffList, setStaffList] = useState<string[]>([])
  const [partnerList, setPartnerList] = useState<string[]>([])
  const [clientManagerList, setClientManagerList] = useState<string[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [pendingFilters, setPendingFilters] = useState<BillableFilter[]>([])
  const [appliedFilters, setAppliedFilters] = useState<BillableFilter[]>([])
  const [savingFilters, setSavingFilters] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const savedFiltersResponse = await fetch(
          `/api/recoverability/saved-filters?organizationId=${organizationId}&t=${Date.now()}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }
        )
        
        if (savedFiltersResponse.ok) {
          const savedFiltersResult = await savedFiltersResponse.json()
          if (savedFiltersResult.filters && savedFiltersResult.filters.length > 0) {
            setPendingFilters(savedFiltersResult.filters)
            setAppliedFilters(savedFiltersResult.filters)
          }
        }
        
        setIsInitializing(false)
        
        const [staffResponse, partnersResponse, clientManagersResponse, lastUploadResponse] = await Promise.all([
          fetch(
            `/api/billable/staff?organizationId=${organizationId}&t=${Date.now()}`,
            {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              },
            }
          ),
          fetch(
            `/api/billable/partners?organizationId=${organizationId}&t=${Date.now()}`,
            {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              },
            }
          ),
          fetch(
            `/api/billable/client-managers?organizationId=${organizationId}&t=${Date.now()}`,
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
        
        if (staffResponse.ok) {
          const result = await staffResponse.json()
          const staffArray = Array.isArray(result) ? result : []
          setStaffList(staffArray)
        }
        
        if (partnersResponse.ok) {
          const result = await partnersResponse.json()
          const partnersArray = Array.isArray(result) ? result : []
          setPartnerList(partnersArray)
        }
        
        if (clientManagersResponse.ok) {
          const result = await clientManagersResponse.json()
          const clientManagersArray = Array.isArray(result) ? result : []
          setClientManagerList(clientManagersArray)
        }
        
        if (lastUploadResponse.ok) {
          const uploadResult = await lastUploadResponse.json()
          setLastUpdated(uploadResult.lastUploadDate)
        }
      } catch (err) {
        console.error('Failed to fetch recoverability data:', err)
      }
    }

    fetchData()
  }, [organizationId])

  const handleSaveFilters = async () => {
    try {
      setSavingFilters(true)
      const response = await fetch(
        `/api/recoverability/saved-filters?organizationId=${organizationId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filters: appliedFilters }),
        }
      )
      
      if (!response.ok) {
        throw new Error('Failed to save filters')
      }
      
      console.log('Filters saved successfully')
    } catch (err) {
      console.error('Failed to save filters:', err)
      alert('Failed to save filters. Please try again.')
    } finally {
      setSavingFilters(false)
    }
  }

  return (
    <RecoverabilityReportContext.Provider value={{
      selectedMonth,
      setSelectedMonth,
      staffList,
      partnerList,
      clientManagerList,
      lastUpdated,
      pendingFilters,
      setPendingFilters,
      appliedFilters,
      setAppliedFilters,
      savingFilters,
      setSavingFilters,
      isInitializing,
      handleSaveFilters,
      organizationId,
    }}>
      {children}
    </RecoverabilityReportContext.Provider>
  )
}

export function useRecoverabilityReport() {
  const context = useContext(RecoverabilityReportContext)
  if (!context) {
    throw new Error('useRecoverabilityReport must be used within RecoverabilityReportProvider')
  }
  return context
}
