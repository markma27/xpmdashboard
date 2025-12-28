import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { DashboardProvider } from '@/components/charts/dashboard-context'
import { DashboardHeader } from '@/components/charts/dashboard-header'
import { DashboardContainer } from '@/components/charts/dashboard-container'

export default async function DashboardPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <DashboardProvider>
      <AppLayout 
        organizations={organizations} 
        activeOrgId={activeOrgId}
        header={<DashboardHeader />}
      >
        <DashboardContainer organizationId={org.id} />
      </AppLayout>
    </DashboardProvider>
  )
}

