'use client'

import { RevenueMonthlyChartClient } from './revenue-monthly-chart-client'
import { RevenueClientGroupsTable } from './revenue-client-groups-table'
import { useRevenueReport } from './revenue-report-context'

interface RevenueReportContainerProps {
  organizationId: string
}

export function RevenueReportContainer({ organizationId }: RevenueReportContainerProps) {
  const { selectedPartner, selectedClientManager, selectedMonth, setSelectedMonth } = useRevenueReport()

  return (
    <>
      <RevenueMonthlyChartClient 
        organizationId={organizationId}
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
        selectedMonth={selectedMonth}
        onMonthClick={setSelectedMonth}
      />
      <RevenueClientGroupsTable 
        organizationId={organizationId}
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
        selectedMonth={selectedMonth}
      />
    </>
  )
}

