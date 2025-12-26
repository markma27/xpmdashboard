'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface BillableReportHeaderProps {
  selectedStaff: string | null
  staffList: string[]
  onStaffChange: (staff: string | null) => void
  lastUpdated?: string | null
}

export function BillableReportHeader({
  selectedStaff,
  staffList,
  onStaffChange,
  lastUpdated,
}: BillableReportHeaderProps) {
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
        <h1 className="text-3xl font-bold">Billable Report</h1>
        <p className="text-muted-foreground">
          View billable hours and amounts by month and client groups
        </p>
        {formattedDate && (
          <p className="text-sm text-red-800 mt-1">
            Last updated: {formattedDate}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 pt-2">
        <span className="text-sm text-muted-foreground">Staff:</span>
        <Select
          value={selectedStaff || 'all'}
          onValueChange={(value) => onStaffChange(value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Staff">
              {selectedStaff || 'All Staff'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Staff</SelectItem>
            {staffList.map((staff) => (
              <SelectItem key={staff} value={staff}>
                {staff}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

