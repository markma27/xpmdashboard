import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { DashboardKPICards } from '@/components/charts/dashboard-kpi-cards'

export default async function DashboardPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <AppLayout organizations={organizations} activeOrgId={activeOrgId}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Firm Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {org.name}
          </p>
        </div>

        <DashboardKPICards organizationId={org.id} />
      </div>
    </AppLayout>
  )
}

