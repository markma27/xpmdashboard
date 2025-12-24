import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { RevenueReportContainer } from '@/components/charts/revenue-report-container'

export default async function RevenueReportPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <AppLayout organizations={organizations} activeOrgId={activeOrgId}>
      <div className="space-y-6">
        <RevenueReportContainer organizationId={org.id} />
      </div>
    </AppLayout>
  )
}

