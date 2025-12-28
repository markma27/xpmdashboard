import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { WIPReportProvider } from '@/components/charts/wip-report-context'
import { WIPReportHeader } from '@/components/charts/wip-report-header'
import { WIPReportContainer } from '@/components/charts/wip-report-container'

export default async function WorkInProgressReportPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <WIPReportProvider organizationId={org.id}>
      <AppLayout 
        organizations={organizations} 
        activeOrgId={activeOrgId}
        header={<WIPReportHeader />}
      >
        <div className="space-y-6">
          <WIPReportContainer organizationId={org.id} />
        </div>
      </AppLayout>
    </WIPReportProvider>
  )
}

