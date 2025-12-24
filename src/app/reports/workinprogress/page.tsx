import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { WIPReportContainer } from '@/components/charts/wip-report-container'

export default async function WorkInProgressReportPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <AppLayout organizations={organizations} activeOrgId={activeOrgId}>
      <div className="space-y-6">
        <WIPReportContainer organizationId={org.id} />
      </div>
    </AppLayout>
  )
}

