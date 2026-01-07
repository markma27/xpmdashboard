'use client'

import { useEffect, useRef, useState } from 'react'
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
import { useProductivityPDF } from './productivity-pdf-context'

interface ProductivityReportHeaderProps {
  organizationName?: string
  onDownloadPDF?: () => void
  isGeneratingPDF?: boolean
}

export function ProductivityReportHeader({ organizationName, onDownloadPDF, isGeneratingPDF }: ProductivityReportHeaderProps) {
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
  const { kpiCardsRef } = useProductivityPDF()
  const [buttonRightOffset, setButtonRightOffset] = useState<number | null>(null)
  const headerRightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateAlignment = () => {
      if (kpiCardsRef.current && headerRightRef.current) {
        const kpiContainer = kpiCardsRef.current
        
        // Get the third card (Average Hourly Rate $) - it's the last child in the grid
        const gridElement = kpiContainer.querySelector('[class*="grid"]')
        if (gridElement) {
          const cards = gridElement.children
          if (cards.length >= 3) {
            const thirdCard = cards[2] as HTMLElement
            const thirdCardRect = thirdCard.getBoundingClientRect()
            const thirdCardRight = thirdCardRect.right
            
            // Get header right container position
            const headerRightRect = headerRightRef.current.getBoundingClientRect()
            const headerRight = headerRightRect.right
            
            // Calculate offset needed to align PDF button right edge with third card right edge
            // If header right is to the right of card right, we need negative margin to move button left
            // If header right is to the left of card right, we need positive margin to move button right
            const offset = headerRight - thirdCardRight
            setButtonRightOffset(-offset) // Negative because we want to move button in opposite direction
          }
        }
      }
    }

    // Update on mount and resize
    updateAlignment()
    window.addEventListener('resize', updateAlignment)
    
    // Also update after a short delay to ensure KPI cards are rendered
    const timeout = setTimeout(updateAlignment, 100)
    const timeout2 = setTimeout(updateAlignment, 500) // Additional delay for slower renders

    return () => {
      window.removeEventListener('resize', updateAlignment)
      clearTimeout(timeout)
      clearTimeout(timeout2)
    }
  }, [kpiCardsRef])

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Productivity</h1>
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
      <div ref={headerRightRef} className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="productivity-date" className="text-xs font-medium whitespace-nowrap text-slate-600 uppercase tracking-wider">
            Date:
          </Label>
          <Input
            id="productivity-date"
            type="date"
            value={displayDate}
            onChange={(e) => setDisplayDate(e.target.value)}
            className="w-36 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="productivity-staff" className="text-xs font-medium whitespace-nowrap text-slate-600 uppercase tracking-wider">
            Staff:
          </Label>
          <Select
            value={displayStaff || 'all'}
            onValueChange={(value) => setDisplayStaff(value === 'all' ? null : value)}
          >
            <SelectTrigger id="productivity-staff" className="w-[200px] h-9 text-xs">
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
          size="sm"
          className="bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] transition-all duration-150 h-9 px-4 font-semibold"
        >
          Update
        </Button>
        {onDownloadPDF && (
          <Button
            onClick={onDownloadPDF}
            size="sm"
            disabled={isGeneratingPDF}
            style={buttonRightOffset !== null ? { marginRight: `${buttonRightOffset}px` } : undefined}
            className="bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-300 active:scale-[0.98] transition-all duration-150 h-9 px-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF'}
          </Button>
        )}
      </div>
    </div>
  )
}

