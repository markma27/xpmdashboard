'use client'

import { BillableMonthlyChartClient } from './billable-monthly-chart-client'
import { BillableClientGroupsTable } from './billable-client-groups-table'
import { useBillableReport } from './billable-report-context'

interface BillableReportContainerProps {
  organizationId: string
}

export function BillableReportContainer({ organizationId }: BillableReportContainerProps) {
  const { selectedMonth, setSelectedMonth, appliedFilters, isInitializing } = useBillableReport()

  if (isInitializing) {
    return null
  }

  return (
    <>
      <BillableMonthlyChartClient 
        organizationId={organizationId} 
        selectedMonth={selectedMonth}
        onMonthClick={setSelectedMonth}
        filters={appliedFilters}
      />
      <BillableClientGroupsTable 
        organizationId={organizationId} 
        selectedMonth={selectedMonth}
        filters={appliedFilters}
      />
    </>
  )
}

