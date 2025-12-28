import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { RevenueReportProvider } from '@/components/charts/revenue-report-context'
import { RevenueReportHeader } from '@/components/charts/revenue-report-header'
import { RevenueReportContainer } from '@/components/charts/revenue-report-container'

export default async function RevenueReportPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <RevenueReportProvider organizationId={org.id}>
      <AppLayout 
        organizations={organizations} 
        activeOrgId={activeOrgId}
        header={<RevenueReportHeader />}
      >
        <div className="space-y-6">
          <RevenueReportContainer organizationId={org.id} />
        </div>
      </AppLayout>
    </RevenueReportProvider>
  )
}

