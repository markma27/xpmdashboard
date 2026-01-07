'use client'

import { useCallback, useState } from 'react'
import { ProductivityReportHeader } from './productivity-report-header'
import { ProductivityReportContainer } from './productivity-report-container'
import { generateProductivityPDF } from '@/lib/pdf-utils'
import { useProductivityPDF } from './productivity-pdf-context'
import { useProductivityReport } from './productivity-report-context'

interface ProductivityReportHeaderWrapperProps {
  organizationName?: string
}

export function ProductivityReportHeaderWrapper({ organizationName }: ProductivityReportHeaderWrapperProps) {
  const { kpiCardsRef, monthlyHoursChartRef, monthlyPercentageChartRef } = useProductivityPDF()
  const { activeDate, activeStaff } = useProductivityReport()
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDownloadPDF = useCallback(async () => {
    if (isGenerating) return

    try {
      setIsGenerating(true)
      await generateProductivityPDF({
        kpiCardsElement: kpiCardsRef.current,
        monthlyHoursChartElement: monthlyHoursChartRef.current,
        monthlyPercentageChartElement: monthlyPercentageChartRef.current,
        date: activeDate,
        staff: activeStaff,
        organizationName,
      })
    } catch (error) {
      console.error('Failed to generate PDF:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate PDF. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }, [kpiCardsRef, monthlyHoursChartRef, monthlyPercentageChartRef, activeDate, activeStaff, organizationName, isGenerating])

  return (
    <ProductivityReportHeader 
      organizationName={organizationName} 
      onDownloadPDF={handleDownloadPDF}
      isGeneratingPDF={isGenerating}
    />
  )
}

interface ProductivityReportContentWrapperProps {
  organizationId: string
}

export function ProductivityReportContentWrapper({ organizationId }: ProductivityReportContentWrapperProps) {
  const { kpiCardsRef, monthlyHoursChartRef, monthlyPercentageChartRef } = useProductivityPDF()

  return (
    <ProductivityReportContainer 
      organizationId={organizationId}
      kpiCardsRef={kpiCardsRef}
      monthlyHoursChartRef={monthlyHoursChartRef}
      monthlyPercentageChartRef={monthlyPercentageChartRef}
    />
  )
}
