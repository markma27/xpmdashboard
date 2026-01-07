import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { ProductivityReportProvider } from '@/components/charts/productivity-report-context'
import { ProductivityPDFProvider } from '@/components/charts/productivity-pdf-context'
import { ProductivityReportHeaderWrapper, ProductivityReportContentWrapper } from '@/components/charts/productivity-report-wrapper'

export default async function ProductivityReportPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <ProductivityReportProvider organizationId={org.id}>
      <ProductivityPDFProvider>
        <AppLayout 
          organizations={organizations} 
          activeOrgId={activeOrgId}
          header={<ProductivityReportHeaderWrapper organizationName={org.name} />}
        >
          <div className="space-y-6">
            <ProductivityReportContentWrapper organizationId={org.id} />
          </div>
        </AppLayout>
      </ProductivityPDFProvider>
    </ProductivityReportProvider>
  )
}

