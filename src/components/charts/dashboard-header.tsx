'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useDashboard } from './dashboard-context'

export function DashboardHeader() {
  const { displayDate, setDisplayDate, handleUpdate } = useDashboard()

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="dashboard-date" className="text-sm font-medium whitespace-nowrap">
          Date:
        </Label>
        <Input
          id="dashboard-date"
          type="date"
          value={displayDate}
          onChange={(e) => setDisplayDate(e.target.value)}
          className="w-40 h-10"
        />
        <Button
          onClick={handleUpdate}
          className="bg-black text-white hover:bg-black/90 h-10"
        >
          Update
        </Button>
      </div>
    </div>
  )
}
