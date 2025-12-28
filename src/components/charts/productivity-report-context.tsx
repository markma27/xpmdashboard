'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ProductivityReportContextValue {
  displayDate: string
  setDisplayDate: (date: string) => void
  activeDate: string
  displayStaff: string | null
  setDisplayStaff: (staff: string | null) => void
  activeStaff: string | null
  selectedMonth: string | null
  setSelectedMonth: (month: string | null) => void
  staffList: string[]
  lastUpdated: string | null
  handleUpdate: () => void
}

const ProductivityReportContext = createContext<ProductivityReportContextValue | undefined>(undefined)

export function ProductivityReportProvider({ 
  organizationId, 
  children 
}: { 
  organizationId: string
  children: ReactNode 
}) {
  const today = new Date().toISOString().split('T')[0]
  const [displayDate, setDisplayDate] = useState(today)
  const [activeDate, setActiveDate] = useState(today)
  const [displayStaff, setDisplayStaff] = useState<string | null>(null)
  const [activeStaff, setActiveStaff] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [staffList, setStaffList] = useState<string[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const handleUpdate = () => {
    if (displayDate) {
      setActiveDate(displayDate)
    }
    setActiveStaff(displayStaff)
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const [staffResponse, lastUploadResponse] = await Promise.all([
          fetch(
            `/api/productivity/staff?organizationId=${organizationId}&t=${Date.now()}`,
            {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              },
            }
          ),
          fetch(
            `/api/timesheet/last-upload?organizationId=${organizationId}&t=${Date.now()}`,
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
          setStaffList(result)
        }
        
        if (lastUploadResponse.ok) {
          const uploadResult = await lastUploadResponse.json()
          setLastUpdated(uploadResult.lastUploadDate)
        }
      } catch (err) {
        console.error('Failed to fetch data:', err)
      }
    }

    fetchData()
  }, [organizationId])

  return (
    <ProductivityReportContext.Provider value={{
      displayDate,
      setDisplayDate,
      activeDate,
      displayStaff,
      setDisplayStaff,
      activeStaff,
      selectedMonth,
      setSelectedMonth,
      staffList,
      lastUpdated,
      handleUpdate,
    }}>
      {children}
    </ProductivityReportContext.Provider>
  )
}

export function useProductivityReport() {
  const context = useContext(ProductivityReportContext)
  if (!context) {
    throw new Error('useProductivityReport must be used within ProductivityReportProvider')
  }
  return context
}
