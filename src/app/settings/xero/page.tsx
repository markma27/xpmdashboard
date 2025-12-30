import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { isAdmin } from '@/lib/rbac'
import { AppLayout } from '@/components/layout/app-layout'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { XeroConnectionList } from '@/components/xero-connection-list'
import { SyncStatus } from '@/components/sync-status'

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
    <AppLayout 
      organizations={organizations} 
      activeOrgId={activeOrgId}
      header={
        <PageHeader 
          title="Xero Connection"
          description="Connect your Xero Practice Manager account"
          organizationName={org.name}
        />
      }
    >
      <div className="space-y-6">
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
        <Card>
          <CardHeader>
            <CardTitle>Sync Status</CardTitle>
            <CardDescription>
              Last sync status for all XPM tables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SyncStatus organizationId={org.id} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
