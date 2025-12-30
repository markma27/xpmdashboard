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
        name: 'Productivity',
        href: '/reports/productivity',
        icon: TrendingUp,
      },
      {
        name: 'Work In Progress',
        href: '/reports/workinprogress',
        icon: Briefcase,
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
      // Hidden for now - Xero Connection not needed
      // {
      //   name: 'Xero Connection',
      //   href: '/settings/xero',
      //   icon: Link2,
      // },
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
    <div className="flex h-full w-52 flex-col bg-gray-50 border-r border-gray-200 shrink-0">
      <div className="flex h-14 items-center justify-center px-4 shrink-0">
        <Image
          src="/Logo.svg"
          alt="Logo"
          width={120}
          height={36}
          className="h-auto w-auto object-contain"
          priority
        />
      </div>
      
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-2.5 scrollbar-none">
        {navigation.map((section, sectionIdx) => (
          <div key={section.title || sectionIdx} className="space-y-1">
            {section.title && (
              <div className={cn(
                "px-3 text-[9px] font-bold tracking-wider text-slate-500 uppercase",
                (section.title === 'SETTINGS' || section.title === 'REPORTS' || section.title === 'UPLOAD') && "mb-3"
              )}>
                {section.title}
              </div>
            )}
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all duration-200 whitespace-nowrap',
                      isActive
                        ? 'bg-brand text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                    )}
                  >
                    <item.icon className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isActive ? "text-white" : "text-slate-500"
                    )} />
                    {item.name}
                  </Link>
                )
              })}
            </div>
            {sectionIdx < navigation.length - 1 && (
              <div className="pt-1">
                <div className="h-px bg-slate-200 mx-2" />
              </div>
            )}
          </div>
        ))}
      </nav>
      
      <div className="border-t border-gray-200 p-2 shrink-0">
        <div className="flex items-center justify-center scale-90 origin-center">
          <UserMenu />
        </div>
      </div>
    </div>
  )
}
