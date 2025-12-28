'use client'

import { WIPChartsClient } from './wip-charts-client'
import { WIPClientGroupsTable } from './wip-client-groups-table'
import { WIPAgingCharts } from './wip-aging-charts'
import { useWIPReport } from './wip-report-context'

interface WIPReportContainerProps {
  organizationId: string
}

export function WIPReportContainer({ organizationId }: WIPReportContainerProps) {
  const { selectedPartner, selectedClientManager } = useWIPReport()

  return (
    <>
      <WIPChartsClient 
        organizationId={organizationId}
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
      />
      <WIPAgingCharts 
        organizationId={organizationId}
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
      />
      <WIPClientGroupsTable 
        organizationId={organizationId}
        selectedPartner={selectedPartner}
        selectedClientManager={selectedClientManager}
      />
    </>
  )
}

