'use client'

import { createContext, useContext, useRef, ReactNode } from 'react'

interface ProductivityPDFContextValue {
  kpiCardsRef: React.RefObject<HTMLDivElement>
  monthlyHoursChartRef: React.RefObject<HTMLDivElement>
  monthlyPercentageChartRef: React.RefObject<HTMLDivElement>
}

const ProductivityPDFContext = createContext<ProductivityPDFContextValue | undefined>(undefined)

export function ProductivityPDFProvider({ children }: { children: ReactNode }) {
  const kpiCardsRef = useRef<HTMLDivElement>(null)
  const monthlyHoursChartRef = useRef<HTMLDivElement>(null)
  const monthlyPercentageChartRef = useRef<HTMLDivElement>(null)

  return (
    <ProductivityPDFContext.Provider value={{
      kpiCardsRef,
      monthlyHoursChartRef,
      monthlyPercentageChartRef,
    }}>
      {children}
    </ProductivityPDFContext.Provider>
  )
}

export function useProductivityPDF() {
  const context = useContext(ProductivityPDFContext)
  if (!context) {
    throw new Error('useProductivityPDF must be used within ProductivityPDFProvider')
  }
  return context
}
