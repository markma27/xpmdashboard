import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { ProductivityReportContainer } from '@/components/charts/productivity-report-container'

export default async function ProductivityReportPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <AppLayout organizations={organizations} activeOrgId={activeOrgId}>
      <div className="space-y-6">
        <ProductivityReportContainer organizationId={org.id} />
      </div>
    </AppLayout>
  )
}

