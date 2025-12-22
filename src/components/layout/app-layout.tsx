import { Sidebar } from '@/components/sidebar'
import { OrgSelector } from '@/components/org-selector'
import { Organization } from '@/lib/auth'
import { UserMenu } from '@/components/user-menu'

interface AppLayoutProps {
  children: React.ReactNode
  organizations: Organization[]
  activeOrgId: string | null
}

export function AppLayout({ children, organizations, activeOrgId }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b px-6">
          <OrgSelector organizations={organizations} activeOrgId={activeOrgId} />
          <UserMenu />
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

