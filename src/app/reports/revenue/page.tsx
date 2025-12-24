import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { RevenueMonthlyChartClient } from '@/components/charts/revenue-monthly-chart-client'
import { RevenueClientGroupsTable } from '@/components/charts/revenue-client-groups-table'

export default async function RevenueReportPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <AppLayout organizations={organizations} activeOrgId={activeOrgId}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Revenue Report</h1>
          <p className="text-muted-foreground">
            View revenue data by month, client groups, and partners/managers
          </p>
        </div>
        <RevenueMonthlyChartClient organizationId={org.id} />
        <RevenueClientGroupsTable organizationId={org.id} />
      </div>
    </AppLayout>
  )
}

