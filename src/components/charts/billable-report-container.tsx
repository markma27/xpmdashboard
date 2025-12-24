'use client'

import { useState, useEffect } from 'react'
import { BillableMonthlyChartClient } from './billable-monthly-chart-client'
import { BillableClientGroupsTable } from './billable-client-groups-table'
import { BillableReportHeader } from './billable-report-header'

interface BillableReportContainerProps {
  organizationId: string
}

export function BillableReportContainer({ organizationId }: BillableReportContainerProps) {
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null)
  const [staffList, setStaffList] = useState<string[]>([])

  // Fetch staff list on mount
  useEffect(() => {
    async function fetchStaffList() {
      try {
        const response = await fetch(
          `/api/billable/staff?organizationId=${organizationId}&t=${Date.now()}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }
        )
        
        if (response.ok) {
          const result = await response.json()
          setStaffList(result)
        }
      } catch (err) {
        // Silently fail - staff list is not critical
        console.error('Failed to fetch staff list:', err)
      }
    }

    fetchStaffList()
  }, [organizationId])

  return (
    <>
      <BillableReportHeader
        selectedStaff={selectedStaff}
        staffList={staffList}
        onStaffChange={setSelectedStaff}
      />
      <BillableMonthlyChartClient 
        organizationId={organizationId} 
        selectedStaff={selectedStaff}
      />
      <BillableClientGroupsTable 
        organizationId={organizationId} 
        selectedStaff={selectedStaff}
        onStaffChange={setSelectedStaff}
      />
    </>
  )
}

