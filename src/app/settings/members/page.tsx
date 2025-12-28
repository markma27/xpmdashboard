import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { isAdmin } from '@/lib/rbac'
import { AppLayout } from '@/components/layout/app-layout'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MemberList } from '@/components/member-list'

export default async function MembersSettingsPage() {
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
          title="Member Management"
          description="Manage organization members and permissions"
        />
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization Members</CardTitle>
            <CardDescription>View and manage organization members</CardDescription>
          </CardHeader>
          <CardContent>
            <MemberList organizationId={org.id} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

