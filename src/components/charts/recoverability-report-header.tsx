'use client'

import { BillableFilters, BillableFilter } from './billable-filters'

interface RecoverabilityReportHeaderProps {
  lastUpdated?: string | null
  pendingFilters: BillableFilter[]
  appliedFilters: BillableFilter[]
  onPendingFiltersChange: (filters: BillableFilter[]) => void
  onApplyFilters: () => void
  onSaveFilters?: () => void
  savingFilters?: boolean
  organizationId: string
  staffList: string[]
  partnerList: string[]
  clientManagerList: string[]
}

export function RecoverabilityReportHeader({
  lastUpdated,
  pendingFilters,
  appliedFilters,
  onPendingFiltersChange,
  onApplyFilters,
  onSaveFilters,
  savingFilters = false,
  organizationId,
  staffList,
  partnerList,
  clientManagerList,
}: RecoverabilityReportHeaderProps) {
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
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <h1 className="text-3xl font-bold">Recoverability Report</h1>
        <p className="text-muted-foreground">
          View recoverability data by month and client groups
        </p>
        {formattedDate && (
          <p className="text-sm text-red-800 mt-1">
            Last updated: {formattedDate}
          </p>
        )}
      </div>
      <div className="flex items-start gap-4">
        <BillableFilters
          organizationId={organizationId}
          filters={pendingFilters}
          onFiltersChange={onPendingFiltersChange}
          onApplyFilters={onApplyFilters}
          onSaveFilters={onSaveFilters}
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

