'use client'

import { useState } from 'react'
import { DashboardKPICards } from './dashboard-kpi-cards'
import { DashboardPartnerChartsClient } from './dashboard-partner-charts-client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface DashboardContainerProps {
  organizationId: string
}

export function DashboardContainer({ organizationId }: DashboardContainerProps) {
  // Default to today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]
  const [displayDate, setDisplayDate] = useState(today) // Date shown in picker
  const [activeDate, setActiveDate] = useState(today) // Date used for data fetching

  // Handle Update button click
  const handleUpdate = () => {
    if (displayDate) {
      setActiveDate(displayDate)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Firm Dashboard</h1>
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

      <DashboardKPICards organizationId={organizationId} asOfDate={activeDate} />

      <DashboardPartnerChartsClient organizationId={organizationId} asOfDate={activeDate} />
    </div>
  )
}
