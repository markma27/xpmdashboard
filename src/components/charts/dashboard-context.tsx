'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { getTodayLocal } from '@/lib/utils'

interface DashboardContextValue {
  displayDate: string
  setDisplayDate: (date: string) => void
  activeDate: string
  handleUpdate: () => void
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const today = getTodayLocal()
  const [displayDate, setDisplayDate] = useState(today)
  const [activeDate, setActiveDate] = useState(today)

  const handleUpdate = () => {
    if (displayDate) {
      setActiveDate(displayDate)
    }
  }

  return (
    <DashboardContext.Provider value={{ displayDate, setDisplayDate, activeDate, handleUpdate }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider')
  }
  return context
}
