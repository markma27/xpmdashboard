'use client'

import { useState, useEffect } from 'react'
import { BillableMonthlyChartClient } from './billable-monthly-chart-client'
import { BillableClientGroupsTable } from './billable-client-groups-table'
import { BillableReportHeader } from './billable-report-header'
import { BillableFilters, BillableFilter } from './billable-filters'

interface BillableReportContainerProps {
  organizationId: string
}

export function BillableReportContainer({ organizationId }: BillableReportContainerProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [staffList, setStaffList] = useState<string[]>([])
  const [partnerList, setPartnerList] = useState<string[]>([])
  const [clientManagerList, setClientManagerList] = useState<string[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [pendingFilters, setPendingFilters] = useState<BillableFilter[]>([])
  const [appliedFilters, setAppliedFilters] = useState<BillableFilter[]>([])
  const [savingFilters, setSavingFilters] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  // Fetch staff list, last upload date, and saved filters on mount
  // Load saved filters FIRST before rendering charts/tables to avoid double loading
  useEffect(() => {
    async function fetchData() {
      try {
        // First, fetch saved filters to set initial state
        const savedFiltersResponse = await fetch(
          `/api/billable/saved-filters?organizationId=${organizationId}&t=${Date.now()}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }
        )
        
        if (savedFiltersResponse.ok) {
          const savedFiltersResult = await savedFiltersResponse.json()
          if (savedFiltersResult.filters && savedFiltersResult.filters.length > 0) {
            // Load saved filters and apply them automatically BEFORE rendering charts
            setPendingFilters(savedFiltersResult.filters)
            setAppliedFilters(savedFiltersResult.filters)
          }
        }
        
        // Mark initialization as complete so charts can start loading
        setIsInitializing(false)
        
        // Then fetch other data in parallel
        const [staffResponse, partnersResponse, clientManagersResponse, lastUploadResponse] = await Promise.all([
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
            `/api/billable/partners?organizationId=${organizationId}&t=${Date.now()}`,
            {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              },
            }
          ),
          fetch(
            `/api/billable/client-managers?organizationId=${organizationId}&t=${Date.now()}`,
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
          const staffArray = Array.isArray(result) ? result : []
          setStaffList(staffArray)
        }
        
        if (partnersResponse.ok) {
          const result = await partnersResponse.json()
          const partnersArray = Array.isArray(result) ? result : []
          setPartnerList(partnersArray)
        }
        
        if (clientManagersResponse.ok) {
          const result = await clientManagersResponse.json()
          const clientManagersArray = Array.isArray(result) ? result : []
          setClientManagerList(clientManagersArray)
        }
        
        if (lastUploadResponse.ok) {
          const uploadResult = await lastUploadResponse.json()
          setLastUpdated(uploadResult.lastUploadDate)
        }
      } catch (err) {
        // Silently fail - staff list is not critical
        console.error('Failed to fetch data:', err)
        setIsInitializing(false) // Make sure to set this even on error
      }
    }

    fetchData()
  }, [organizationId])

  // Handle save filters
  const handleSaveFilters = async () => {
    try {
      setSavingFilters(true)
      const response = await fetch(
        `/api/billable/saved-filters?organizationId=${organizationId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filters: appliedFilters }),
        }
      )
      
      if (!response.ok) {
        throw new Error('Failed to save filters')
      }
      
      // Show success feedback (you could add a toast notification here)
      console.log('Filters saved successfully')
    } catch (err) {
      console.error('Failed to save filters:', err)
      alert('Failed to save filters. Please try again.')
    } finally {
      setSavingFilters(false)
    }
  }

  return (
    <>
      <BillableReportHeader
        lastUpdated={lastUpdated}
        pendingFilters={pendingFilters}
        appliedFilters={appliedFilters}
        onPendingFiltersChange={setPendingFilters}
        onApplyFilters={() => setAppliedFilters([...pendingFilters])}
        onSaveFilters={handleSaveFilters}
        savingFilters={savingFilters}
        organizationId={organizationId}
        staffList={staffList}
        partnerList={partnerList}
        clientManagerList={clientManagerList}
      />
      {/* Only render charts/tables after initialization is complete to avoid double loading */}
      {!isInitializing && (
        <>
          <BillableMonthlyChartClient 
            organizationId={organizationId} 
            selectedMonth={selectedMonth}
            onMonthClick={setSelectedMonth}
            filters={appliedFilters}
          />
          <BillableClientGroupsTable 
            organizationId={organizationId} 
            selectedMonth={selectedMonth}
            filters={appliedFilters}
          />
        </>
      )}
    </>
  )
}

