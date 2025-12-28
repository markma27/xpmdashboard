import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { ProductivityReportProvider } from '@/components/charts/productivity-report-context'
import { ProductivityReportHeader } from '@/components/charts/productivity-report-header'
import { ProductivityReportContainer } from '@/components/charts/productivity-report-container'

export default async function ProductivityReportPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <ProductivityReportProvider organizationId={org.id}>
      <AppLayout 
        organizations={organizations} 
        activeOrgId={activeOrgId}
        header={<ProductivityReportHeader />}
      >
        <div className="space-y-6">
          <ProductivityReportContainer organizationId={org.id} />
        </div>
      </AppLayout>
    </ProductivityReportProvider>
  )
}

