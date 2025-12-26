'use client'

import { Button } from '@/components/ui/button'

interface RecoverabilityReportHeaderProps {
  selectedPartner: string | null
  selectedClientManager: string | null
  partners: string[]
  clientManagers: string[]
  onPartnerChange: (partner: string | null) => void
  onClientManagerChange: (manager: string | null) => void
  lastUpdated?: string | null
}

export function RecoverabilityReportHeader({
  selectedPartner,
  selectedClientManager,
  partners,
  clientManagers,
  onPartnerChange,
  onClientManagerChange,
  lastUpdated,
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
      <div className="flex flex-col items-end gap-2 pt-2">
        {/* Partner Filter Slicers */}
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant={selectedPartner === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPartnerChange(null)}
          >
            All Partners
          </Button>
          {partners.map((partner) => (
            <Button
              key={partner}
              variant={selectedPartner === partner ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPartnerChange(partner)}
            >
              {partner}
            </Button>
          ))}
        </div>
        
        {/* Client Manager Filter Slicers */}
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant={selectedClientManager === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => onClientManagerChange(null)}
          >
            All Managers
          </Button>
          {clientManagers.map((manager) => (
            <Button
              key={manager}
              variant={selectedClientManager === manager ? 'default' : 'outline'}
              size="sm"
              onClick={() => onClientManagerChange(manager)}
            >
              {manager}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

