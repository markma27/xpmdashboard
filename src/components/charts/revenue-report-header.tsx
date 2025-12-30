'use client'

import { Button } from '@/components/ui/button'
import { useRevenueReport } from './revenue-report-context'
import { cn } from '@/lib/utils'

export function RevenueReportHeader() {
  const {
    selectedPartner,
    setSelectedPartner,
    selectedClientManager,
    setSelectedClientManager,
    partners,
    clientManagers,
    lastUpdated,
  } = useRevenueReport()
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
        <h1 className="text-2xl font-bold tracking-tight">Invoice Report</h1>
        {formattedDate && (
          <p className="text-xs text-red-800 mt-1">
            Last updated: {formattedDate}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        {/* Partner Filter Slicers */}
        <div className="flex flex-wrap gap-1.5 justify-end">
          <Button
            variant={selectedPartner === null ? 'default' : 'outline'}
            size="sm"
            className={cn(
              "h-7 px-2.5 text-[11px] font-semibold transition-all duration-200",
              selectedPartner === null && "bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.98]"
            )}
            onClick={() => setSelectedPartner(null)}
          >
            All Partners
          </Button>
          {partners.map((partner) => (
            <Button
              key={partner}
              variant={selectedPartner === partner ? 'default' : 'outline'}
              size="sm"
              className={cn(
                "h-7 px-2.5 text-[11px] font-semibold transition-all duration-200",
                selectedPartner === partner && "bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.98]"
              )}
              onClick={() => setSelectedPartner(partner)}
            >
              {partner}
            </Button>
          ))}
        </div>
        
        {/* Client Manager Filter Slicers */}
        <div className="flex flex-wrap gap-1.5 justify-end">
          <Button
            variant={selectedClientManager === null ? 'default' : 'outline'}
            size="sm"
            className={cn(
              "h-7 px-2.5 text-[11px] font-semibold transition-all duration-200",
              selectedClientManager === null && "bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.98]"
            )}
            onClick={() => setSelectedClientManager(null)}
          >
            All Managers
          </Button>
          {clientManagers.map((manager) => (
            <Button
              key={manager}
              variant={selectedClientManager === manager ? 'default' : 'outline'}
              size="sm"
              className={cn(
                "h-7 px-2.5 text-[11px] font-semibold transition-all duration-200",
                selectedClientManager === manager && "bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.98]"
              )}
              onClick={() => setSelectedClientManager(manager)}
            >
              {manager}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

