'use client'

import { Button } from '@/components/ui/button'

interface RevenueReportHeaderProps {
  selectedPartner: string | null
  selectedClientManager: string | null
  partners: string[]
  clientManagers: string[]
  onPartnerChange: (partner: string | null) => void
  onClientManagerChange: (manager: string | null) => void
}

export function RevenueReportHeader({
  selectedPartner,
  selectedClientManager,
  partners,
  clientManagers,
  onPartnerChange,
  onClientManagerChange,
}: RevenueReportHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <h1 className="text-3xl font-bold">Revenue Report</h1>
        <p className="text-muted-foreground">
          View revenue data by month, client groups, and partners/managers
        </p>
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

