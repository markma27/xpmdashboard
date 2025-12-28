'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  DollarSign,
  Clock,
  Briefcase,
  BarChart3,
  Upload,
  Users,
  TrendingUp,
  Building2,
  UserCog,
  Link2,
} from 'lucide-react'
import { UserMenu } from '@/components/user-menu'

interface NavItem {
  name: string
  href: string
  icon: any
}

interface NavSection {
  title: string | null
  items: NavItem[]
}

const navigation: NavSection[] = [
  {
    title: null,
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      {
        name: 'Invoice',
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
        icon: TrendingUp,
      },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      {
        name: 'Staff',
        href: '/settings/staff',
        icon: Users,
      },
      {
        name: 'Organisation',
        href: '/settings/organisation',
        icon: Building2,
      },
      {
        name: 'Users',
        href: '/settings/members',
        icon: UserCog,
      },
      {
        name: 'Xero Connection',
        href: '/settings/xero',
        icon: Link2,
      },
    ],
  },
  {
    title: 'UPLOAD',
    items: [
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
    <div className="flex h-full w-64 flex-col bg-[#f8f9fa] border-r border-gray-200">
      <div className="flex h-20 items-center justify-center px-6">
        <Image
          src="/Logo.svg"
          alt="XPM Dashboard"
          width={150}
          height={50}
          className="h-auto w-auto object-contain"
          priority
        />
      </div>
      
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {navigation.map((section, sectionIdx) => (
          <div key={section.title || sectionIdx} className="space-y-2">
            {section.title && (
              <div className="px-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                {section.title}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] font-medium transition-all duration-200',
                      isActive
                        ? 'bg-[#1a1f2e] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                    )}
                  >
                    <item.icon className={cn(
                      "h-4.5 w-4.5 shrink-0",
                      isActive ? "text-white" : "text-slate-500"
                    )} />
                    {item.name}
                  </Link>
                )
              })}
            </div>
            {sectionIdx < navigation.length - 1 && (
              <div className="pt-2">
                <div className="h-px bg-slate-200 mx-2" />
              </div>
            )}
          </div>
        ))}
      </nav>
      
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center justify-center">
          <UserMenu />
        </div>
      </div>
    </div>
  )
}
