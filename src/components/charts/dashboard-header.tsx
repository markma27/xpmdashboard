'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useDashboard } from './dashboard-context'

interface DashboardHeaderProps {
  organizationName?: string
}

export function DashboardHeader({ organizationName }: DashboardHeaderProps) {
  const { displayDate, setDisplayDate, handleUpdate } = useDashboard()

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        {organizationName && (
          <>
            <div className="h-5 w-px bg-gray-300" />
            <span className="text-base font-normal text-slate-400 tracking-normal">{organizationName}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="dashboard-date" className="text-xs font-medium whitespace-nowrap text-slate-600 uppercase tracking-wider">
          Date:
        </Label>
        <Input
          id="dashboard-date"
          type="date"
          value={displayDate}
          onChange={(e) => setDisplayDate(e.target.value)}
          className="w-36 h-9 text-xs"
        />
        <Button
          onClick={handleUpdate}
          size="sm"
          className="bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] transition-all duration-150 h-9 px-4 font-semibold"
        >
          Update
        </Button>
      </div>
    </div>
  )
}
