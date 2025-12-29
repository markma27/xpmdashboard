import { Sidebar } from '@/components/sidebar'
import { Organization } from '@/lib/auth'

interface AppLayoutProps {
  children: React.ReactNode
  organizations: Organization[]
  activeOrgId: string | null
  header?: React.ReactNode
}

export function AppLayout({ children, organizations, activeOrgId, header }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {header && (
          <header className="border-b border-gray-200 bg-gray-50 px-6 py-3 shrink-0">
            {header}
          </header>
        )}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-gutter-stable p-6 bg-gray-150">{children}</main>
      </div>
    </div>
  )
}

