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
}

export function BillableReportHeader({
  selectedStaff,
  staffList,
  onStaffChange,
}: BillableReportHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <h1 className="text-3xl font-bold">Billable Report</h1>
        <p className="text-muted-foreground">
          View billable hours and amounts by month, client groups, and partners/managers
        </p>
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

