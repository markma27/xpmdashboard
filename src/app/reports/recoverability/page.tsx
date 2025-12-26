import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { RecoverabilityReportContainer } from '@/components/charts/recoverability-report-container'

export default async function RecoverabilityReportPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <AppLayout organizations={organizations} activeOrgId={activeOrgId}>
      <div className="space-y-6">
        <RecoverabilityReportContainer organizationId={org.id} />
      </div>
    </AppLayout>
  )
}

