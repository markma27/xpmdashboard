'use client'

import { BillableFilters } from './billable-filters'
import { useBillableReport } from './billable-report-context'
import { Button } from '@/components/ui/button'

export function BillableReportHeader() {
  const {
    lastUpdated,
    pendingFilters,
    appliedFilters,
    setPendingFilters,
    setAppliedFilters,
    savingFilters,
    handleSaveFilters,
    organizationId,
    staffList,
    partnerList,
    clientManagerList,
  } = useBillableReport()

  const handleApplyFilters = () => {
    setAppliedFilters([...pendingFilters])
  }
  // Format date as DD MMM YYYY
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }

  const formattedDate = formatDate(lastUpdated || null)

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billable</h1>
        {formattedDate && (
          <p className="text-xs text-red-800 mt-1">
            Last updated: {formattedDate}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <BillableFilters
          organizationId={organizationId}
          filters={pendingFilters}
          onFiltersChange={setPendingFilters}
          onApplyFilters={handleApplyFilters}
          onSaveFilters={handleSaveFilters}
          saving={savingFilters}
          staffList={staffList}
          partnerList={partnerList}
          clientManagerList={clientManagerList}
        />
      </div>
    </div>
  )
}

