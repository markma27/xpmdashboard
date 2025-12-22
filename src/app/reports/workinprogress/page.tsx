import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'

export default async function WorkInProgressReportPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <AppLayout organizations={organizations} activeOrgId={activeOrgId}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Work In Progress Report</h1>
          <p className="text-muted-foreground">
            View projects and work in progress
          </p>
        </div>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Report content coming soon - Connect Xero and sync data first
        </div>
      </div>
    </AppLayout>
  )
}

