import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { isAdmin } from '@/lib/rbac'
import { AppLayout } from '@/components/layout/app-layout'
import { WIPTimesheetUploadForm } from '@/components/wip-timesheet-upload-form'

export default async function WIPTimesheetUploadPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  if (!isAdmin(org)) {
    return (
      <AppLayout organizations={organizations} activeOrgId={activeOrgId}>
        <div className="space-y-6">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
            <h2 className="text-xl font-semibold text-destructive">Unauthorized</h2>
            <p className="mt-2 text-muted-foreground">
              You need admin permissions to access this page
            </p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout organizations={organizations} activeOrgId={activeOrgId}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">WIP Timesheet Upload</h1>
          <p className="text-muted-foreground">
            Upload CSV files exported from XPM for Work In Progress reporting
          </p>
        </div>
        <WIPTimesheetUploadForm />
      </div>
    </AppLayout>
  )
}

