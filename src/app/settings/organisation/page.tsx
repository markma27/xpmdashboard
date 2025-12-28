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
        <Card>
          <CardHeader>
            <CardTitle>Organization Information</CardTitle>
            <CardDescription>Update your organization&apos;s basic information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Organization Name</label>
                <p className="mt-1 text-sm text-muted-foreground">{org.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Organization Slug</label>
                <p className="mt-1 text-sm text-muted-foreground">{org.slug}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Organization settings editing coming soon
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

