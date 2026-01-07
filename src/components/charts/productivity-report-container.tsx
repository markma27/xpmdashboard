'use client'

import { ProductivityMonthlyChartClient } from './productivity-monthly-chart-client'
import { ProductivityPercentageChartClient } from './productivity-percentage-chart-client'
import { ProductivityClientGroupsTable } from './productivity-client-groups-table'
import { ProductivityKPICards } from './productivity-kpi-cards'
import { useProductivityReport } from './productivity-report-context'

interface ProductivityReportContainerProps {
  organizationId: string
  kpiCardsRef?: React.RefObject<HTMLDivElement>
  monthlyHoursChartRef?: React.RefObject<HTMLDivElement>
  monthlyPercentageChartRef?: React.RefObject<HTMLDivElement>
}

export function ProductivityReportContainer({ 
  organizationId, 
  kpiCardsRef,
  monthlyHoursChartRef,
  monthlyPercentageChartRef
}: ProductivityReportContainerProps) {
  const { activeStaff, activeDate, selectedMonth, setSelectedMonth, setDisplayStaff } = useProductivityReport()

  return (
    <>
      <div ref={kpiCardsRef}>
        <ProductivityKPICards
          organizationId={organizationId}
          selectedStaff={activeStaff}
          asOfDate={activeDate}
        />
      </div>
      <div ref={monthlyHoursChartRef}>
        <ProductivityMonthlyChartClient 
          organizationId={organizationId} 
          selectedStaff={activeStaff}
          selectedMonth={selectedMonth}
          onMonthClick={setSelectedMonth}
          asOfDate={activeDate}
        />
      </div>
      <div ref={monthlyPercentageChartRef}>
        <ProductivityPercentageChartClient 
          organizationId={organizationId} 
          selectedStaff={activeStaff}
          asOfDate={activeDate}
        />
      </div>
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

