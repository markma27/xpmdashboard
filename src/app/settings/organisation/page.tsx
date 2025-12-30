import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { isAdmin } from '@/lib/rbac'
import { AppLayout } from '@/components/layout/app-layout'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function OrganisationSettingsPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  if (!isAdmin(org)) {
    return (
      <AppLayout organizations={organizations} activeOrgId={activeOrgId}>
        <div className="space-y-6">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
            <h2 className="text-lg font-bold text-destructive">Unauthorized</h2>
            <p className="mt-2 text-xs text-slate-500">
              You need admin permissions to access this page
            </p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout 
      organizations={organizations} 
      activeOrgId={activeOrgId}
      header={
        <PageHeader 
          title="Organization Settings"
          description="Manage your organization information"
        />
      }
    >
      <div className="space-y-6">
        <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
          <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
            <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Organization Information</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wider">Organization Name</label>
                <p className="mt-1 text-sm text-slate-700">{org.name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wider">Organization Slug</label>
                <p className="mt-1 text-sm text-slate-700">{org.slug}</p>
              </div>
              <p className="text-xs text-slate-500">
                Organization settings editing coming soon
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

