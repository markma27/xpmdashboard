'use client'

import { BillableFilters } from './billable-filters'
import { useRecoverabilityReport } from './recoverability-report-context'
import { Button } from '@/components/ui/button'

interface RecoverabilityReportHeaderProps {
  organizationName?: string
}

export function RecoverabilityReportHeader({ organizationName }: RecoverabilityReportHeaderProps) {
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
  } = useRecoverabilityReport()

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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Recoverability</h1>
          {organizationName && (
            <>
              <div className="h-5 w-px bg-gray-300" />
              <span className="text-base font-normal text-slate-400 tracking-normal">{organizationName}</span>
            </>
          )}
        </div>
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
          filterOptionsApi="recoverability"
        />
      </div>
    </div>
  )
}

