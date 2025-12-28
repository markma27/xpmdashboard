'use client'

import { RecoverabilityMonthlyChartClient } from './recoverability-monthly-chart-client'
import { RecoverabilityClientGroupsTable } from './recoverability-client-groups-table'
import { RecoverabilityKPICards } from './recoverability-kpi-cards'
import { useRecoverabilityReport } from './recoverability-report-context'

interface RecoverabilityReportContainerProps {
  organizationId: string
}

export function RecoverabilityReportContainer({ organizationId }: RecoverabilityReportContainerProps) {
  const { selectedMonth, setSelectedMonth, appliedFilters, isInitializing } = useRecoverabilityReport()

  if (isInitializing) {
    return null
  }

  return (
    <>
      <RecoverabilityKPICards
        organizationId={organizationId}
        filters={appliedFilters}
      />
      <RecoverabilityMonthlyChartClient 
        organizationId={organizationId}
        selectedMonth={selectedMonth}
        onMonthClick={setSelectedMonth}
        filters={appliedFilters}
      />
      <RecoverabilityClientGroupsTable 
        organizationId={organizationId}
        selectedMonth={selectedMonth}
        filters={appliedFilters}
      />
    </>
  )
}

