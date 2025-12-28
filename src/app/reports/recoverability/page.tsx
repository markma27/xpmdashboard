import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { RecoverabilityReportProvider } from '@/components/charts/recoverability-report-context'
import { RecoverabilityReportHeader } from '@/components/charts/recoverability-report-header'
import { RecoverabilityReportContainer } from '@/components/charts/recoverability-report-container'

export default async function RecoverabilityReportPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <RecoverabilityReportProvider organizationId={org.id}>
      <AppLayout 
        organizations={organizations} 
        activeOrgId={activeOrgId}
        header={<RecoverabilityReportHeader />}
      >
        <div className="space-y-6">
          <RecoverabilityReportContainer organizationId={org.id} />
        </div>
      </AppLayout>
    </RecoverabilityReportProvider>
  )
}

