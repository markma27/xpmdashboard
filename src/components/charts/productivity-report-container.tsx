'use client'

import { ProductivityMonthlyChartClient } from './productivity-monthly-chart-client'
import { ProductivityPercentageChartClient } from './productivity-percentage-chart-client'
import { ProductivityClientGroupsTable } from './productivity-client-groups-table'
import { ProductivityKPICards } from './productivity-kpi-cards'
import { useProductivityReport } from './productivity-report-context'

interface ProductivityReportContainerProps {
  organizationId: string
}

export function ProductivityReportContainer({ organizationId }: ProductivityReportContainerProps) {
  const { activeStaff, activeDate, selectedMonth, setSelectedMonth, setDisplayStaff } = useProductivityReport()

  return (
    <>
      <ProductivityKPICards
        organizationId={organizationId}
        selectedStaff={activeStaff}
        asOfDate={activeDate}
      />
      <ProductivityMonthlyChartClient 
        organizationId={organizationId} 
        selectedStaff={activeStaff}
        selectedMonth={selectedMonth}
        onMonthClick={setSelectedMonth}
        asOfDate={activeDate}
      />
      <ProductivityPercentageChartClient 
        organizationId={organizationId} 
        selectedStaff={activeStaff}
        asOfDate={activeDate}
      />
      <ProductivityClientGroupsTable 
        organizationId={organizationId} 
        selectedStaff={activeStaff}
        onStaffChange={setDisplayStaff}
        selectedMonth={selectedMonth}
        asOfDate={activeDate}
      />
    </>
  )
}

