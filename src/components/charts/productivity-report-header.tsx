'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProductivityReport } from './productivity-report-context'

export function ProductivityReportHeader() {
  const {
    displayDate,
    setDisplayDate,
    displayStaff,
    setDisplayStaff,
    staffList,
    lastUpdated,
    handleUpdate,
  } = useProductivityReport()

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
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <h1 className="text-3xl font-bold">Productivity Analytics</h1>
        <p className="text-muted-foreground">
          Analyse team and individual productivity metrics
        </p>
        {formattedDate && (
          <p className="text-sm text-red-800 mt-1">
            Last updated: {formattedDate}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="productivity-date" className="text-sm font-medium whitespace-nowrap">
            Date:
          </Label>
          <Input
            id="productivity-date"
            type="date"
            value={displayDate}
            onChange={(e) => setDisplayDate(e.target.value)}
            className="w-40 h-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="productivity-staff" className="text-sm font-medium whitespace-nowrap">
            Staff:
          </Label>
          <Select
            value={displayStaff || 'all'}
            onValueChange={(value) => setDisplayStaff(value === 'all' ? null : value)}
          >
            <SelectTrigger id="productivity-staff" className="w-[200px] h-10">
              <SelectValue placeholder="All Staff">
                {displayStaff || 'All Staff'}
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
        <Button
          onClick={handleUpdate}
          className="bg-black text-white hover:bg-black/90 h-10"
        >
          Update
        </Button>
      </div>
    </div>
  )
}

