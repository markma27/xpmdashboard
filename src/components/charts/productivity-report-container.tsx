'use client'

import { useState, useEffect } from 'react'
import { ProductivityMonthlyChartClient } from './productivity-monthly-chart-client'
import { ProductivityPercentageChartClient } from './productivity-percentage-chart-client'
// Hidden charts - Standard Hours, Capacity Reducing Hours, and Total Hours
// import { ProductivityStandardHoursChartClient } from './productivity-standard-hours-chart-client'
// import { ProductivityCapacityReducingChartClient } from './productivity-capacity-reducing-chart-client'
// import { ProductivityTotalHoursChartClient } from './productivity-total-hours-chart-client'
import { ProductivityClientGroupsTable } from './productivity-client-groups-table'
import { ProductivityReportHeader } from './productivity-report-header'
import { ProductivityKPICards } from './productivity-kpi-cards'

interface ProductivityReportContainerProps {
  organizationId: string
}

export function ProductivityReportContainer({ organizationId }: ProductivityReportContainerProps) {
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [staffList, setStaffList] = useState<string[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Fetch staff list and last upload date on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [staffResponse, lastUploadResponse] = await Promise.all([
          fetch(
            `/api/productivity/staff?organizationId=${organizationId}&t=${Date.now()}`,
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
      <ProductivityReportHeader
        selectedStaff={selectedStaff}
        staffList={staffList}
        onStaffChange={setSelectedStaff}
        lastUpdated={lastUpdated}
      />
      <ProductivityKPICards
        organizationId={organizationId}
        selectedStaff={selectedStaff}
      />
      <ProductivityMonthlyChartClient 
        organizationId={organizationId} 
        selectedStaff={selectedStaff}
        selectedMonth={selectedMonth}
        onMonthClick={setSelectedMonth}
      />
      <ProductivityPercentageChartClient 
        organizationId={organizationId} 
        selectedStaff={selectedStaff}
      />
      {/* Hidden charts - Standard Hours, Capacity Reducing Hours, and Total Hours */}
      {/* <ProductivityStandardHoursChartClient 
        organizationId={organizationId} 
        selectedStaff={selectedStaff}
      />
      <ProductivityCapacityReducingChartClient 
        organizationId={organizationId} 
        selectedStaff={selectedStaff}
      />
      <ProductivityTotalHoursChartClient 
        organizationId={organizationId} 
        selectedStaff={selectedStaff}
      /> */}
      <ProductivityClientGroupsTable 
        organizationId={organizationId} 
        selectedStaff={selectedStaff}
        onStaffChange={setSelectedStaff}
        selectedMonth={selectedMonth}
      />
    </>
  )
}

