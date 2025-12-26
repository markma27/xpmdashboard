'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  Settings,
  DollarSign,
  Clock,
  Briefcase,
  BarChart3,
  Upload,
  Users,
} from 'lucide-react'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Reports',
    icon: FileText,
    children: [
      {
        name: 'Revenue',
        href: '/reports/revenue',
        icon: DollarSign,
      },
      {
        name: 'Billable',
        href: '/reports/billable',
        icon: Clock,
      },
      {
        name: 'Recoverability',
        href: '/reports/recoverability',
        icon: BarChart3,
      },
      {
        name: 'Work In Progress',
        href: '/reports/workinprogress',
        icon: Briefcase,
      },
      {
        name: 'Productivity',
        href: '/reports/productivity',
        icon: BarChart3,
      },
    ],
  },
  {
    name: 'Settings',
    icon: Settings,
    children: [
      {
        name: 'Organization',
        href: '/settings/organisation',
        icon: Settings,
      },
      {
        name: 'Members',
        href: '/settings/members',
        icon: Settings,
      },
      {
        name: 'Staff',
        href: '/settings/staff',
        icon: Users,
      },
      {
        name: 'Xero Connection',
        href: '/settings/xero',
        icon: Settings,
      },
      {
        name: 'Sync',
        href: '/settings/sync',
        icon: Settings,
      },
      {
        name: 'Timesheet Upload',
        href: '/settings/timesheet',
        icon: Upload,
      },
      {
        name: 'WIP Upload',
        href: '/settings/wip-timesheet',
        icon: Upload,
      },
      {
        name: 'Recoverability Upload',
        href: '/settings/recoverability-timesheet',
        icon: Upload,
      },
      {
        name: 'Invoice Upload',
        href: '/settings/invoice',
        icon: Upload,
      },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-semibold">XPM Analytics</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          if (item.children) {
            return (
              <div key={item.name} className="space-y-1">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                  {item.name}
                </div>
                {item.children.map((child) => {
                  const isActive = pathname === child.href
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <child.icon className="h-4 w-4" />
                      {child.name}
                    </Link>
                  )
                })}
              </div>
            )
          }

          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

