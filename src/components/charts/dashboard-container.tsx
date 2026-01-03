'use client'

import { DashboardKPICards } from './dashboard-kpi-cards'
import { DashboardPartnerChartsClient } from './dashboard-partner-charts-client'
import { DashboardStaffPerformanceTable } from './dashboard-staff-performance-table'
import { useDashboard } from './dashboard-context'

interface DashboardContainerProps {
  organizationId: string
}

export function DashboardContainer({ organizationId }: DashboardContainerProps) {
  const { activeDate } = useDashboard()

  return (
    <div className="space-y-3">
      <DashboardKPICards organizationId={organizationId} asOfDate={activeDate} />

      <DashboardPartnerChartsClient organizationId={organizationId} asOfDate={activeDate} />

      <DashboardStaffPerformanceTable organizationId={organizationId} asOfDate={activeDate} />
    </div>
  )
}
