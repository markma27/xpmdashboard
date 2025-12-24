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
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Fetch staff list and last upload date on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [staffResponse, lastUploadResponse] = await Promise.all([
          fetch(
            `/api/billable/staff?organizationId=${organizationId}&t=${Date.now()}`,
            {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              },
            }
          ),
          fetch(
            `/api/timesheet/last-upload?organizationId=${organizationId}&t=${Date.now()}`,
            {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              },
            }
          ),
        ])
        
        if (staffResponse.ok) {
          const result = await staffResponse.json()
          setStaffList(result)
        }
        
        if (lastUploadResponse.ok) {
          const uploadResult = await lastUploadResponse.json()
          setLastUpdated(uploadResult.lastUploadDate)
        }
      } catch (err) {
        // Silently fail - staff list is not critical
        console.error('Failed to fetch data:', err)
      }
    }

    fetchData()
  }, [organizationId])

  return (
    <>
      <BillableReportHeader
        selectedStaff={selectedStaff}
        staffList={staffList}
        onStaffChange={setSelectedStaff}
        lastUpdated={lastUpdated}
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

