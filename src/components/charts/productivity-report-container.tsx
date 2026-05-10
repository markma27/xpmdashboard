'use client'

import dynamic from 'next/dynamic'
import { ChartSkeleton } from './chart-skeleton'
import { useProductivityReport } from './productivity-report-context'

const ProductivityKPICards = dynamic(
  () => import('./productivity-kpi-cards').then((m) => ({ default: m.ProductivityKPICards })),
  {
    loading: () => (
      <div className="min-h-[200px] flex items-center justify-center">
        <ChartSkeleton />
      </div>
    ),
    ssr: false,
  }
)

const ProductivityMonthlyChartClient = dynamic(
  () => import('./productivity-monthly-chart-client').then((m) => ({ default: m.ProductivityMonthlyChartClient })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

const ProductivityPercentageChartClient = dynamic(
  () => import('./productivity-percentage-chart-client').then((m) => ({ default: m.ProductivityPercentageChartClient })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

const ProductivityClientGroupsTable = dynamic(
  () => import('./productivity-client-groups-table').then((m) => ({ default: m.ProductivityClientGroupsTable })),
  {
    loading: () => (
      <div className="min-h-[280px] flex items-center justify-center rounded-lg border bg-card">
        <ChartSkeleton />
      </div>
    ),
    ssr: false,
  }
)

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
  monthlyPercentageChartRef,
}: ProductivityReportContainerProps) {
  const { activeStaff, activeDate, selectedMonth, setSelectedMonth, setDisplayStaff } = useProductivityReport()

  return (
    <>
      <div ref={kpiCardsRef}>
        <ProductivityKPICards organizationId={organizationId} selectedStaff={activeStaff} asOfDate={activeDate} />
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
