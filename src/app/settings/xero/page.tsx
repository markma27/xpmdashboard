import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { isAdmin } from '@/lib/rbac'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { XeroConnectionList } from '@/components/xero-connection-list'

export default async function XeroSettingsPage() {
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
          <h1 className="text-3xl font-bold">Xero Connection</h1>
          <p className="text-muted-foreground">
            Connect your Xero Practice Manager account
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Xero Connections</CardTitle>
            <CardDescription>
              Connect your Xero account to sync Practice Manager data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <XeroConnectionList organizationId={org.id} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
