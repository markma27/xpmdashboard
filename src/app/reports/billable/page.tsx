import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { BillableReportProvider } from '@/components/charts/billable-report-context'
import { BillableReportHeader } from '@/components/charts/billable-report-header'
import { BillableReportContainer } from '@/components/charts/billable-report-container'

export default async function BillableReportPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <BillableReportProvider organizationId={org.id}>
      <AppLayout 
        organizations={organizations} 
        activeOrgId={activeOrgId}
        header={<BillableReportHeader organizationName={org.name} />}
      >
        <div className="space-y-6">
          <BillableReportContainer organizationId={org.id} />
        </div>
      </AppLayout>
    </BillableReportProvider>
  )
}

