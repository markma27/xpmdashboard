'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Plus, Filter, Check, Save } from 'lucide-react'

export type FilterType = 'client_group' | 'account_manager' | 'job_manager' | 'job_name' | 'staff'

export interface BillableFilter {
  id: string
  type: FilterType
  value: string
  operator?: 'contains' | 'not_contains' // For job_name only
}

interface BillableFiltersProps {
  organizationId: string
  filters: BillableFilter[]
  onFiltersChange: (filters: BillableFilter[]) => void
  onApplyFilters?: () => void
  onSaveFilters?: () => void
  saving?: boolean
  staffList?: string[]
  partnerList?: string[]
  clientManagerList?: string[]
  filterOptionsApi?: string // Optional API endpoint for filter options (defaults to 'billable')
}

interface FilterOptions {
  clientGroups: string[]
  accountManagers: string[]
  jobManagers: string[]
}

export function BillableFilters({
  organizationId,
  filters,
  onFiltersChange,
  onApplyFilters,
  onSaveFilters,
  saving = false,
  staffList = [],
  partnerList = [],
  clientManagerList = [],
  filterOptionsApi = 'billable',
}: BillableFiltersProps) {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    clientGroups: [],
    accountManagers: [],
    jobManagers: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFilterOptions() {
      try {
        const response = await fetch(
          `/api/${filterOptionsApi}/filter-options?organizationId=${organizationId}&t=${Date.now()}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }
        )
        
        if (response.ok) {
          const data = await response.json()
          setFilterOptions(data)
        }
      } catch (err) {
        console.error('Failed to fetch filter options:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchFilterOptions()
  }, [organizationId, filterOptionsApi])

  // Debug: Log when partnerList or clientManagerList changes
  useEffect(() => {
    if (partnerList.length > 0) {
      console.log('BillableFilters: partnerList updated:', partnerList)
    }
  }, [partnerList])

  useEffect(() => {
    if (clientManagerList.length > 0) {
      console.log('BillableFilters: clientManagerList updated:', clientManagerList)
    }
  }, [clientManagerList])

  const addFilter = () => {
    const newFilter: BillableFilter = {
      id: Date.now().toString(),
      type: 'client_group',
      value: '',
    }
    onFiltersChange([...filters, newFilter])
  }

  const removeFilter = (id: string) => {
    onFiltersChange(filters.filter((f) => f.id !== id))
  }

  const updateFilter = (id: string, updates: Partial<BillableFilter>) => {
    onFiltersChange(
      filters.map((f) => (f.id === id ? { ...f, ...updates } : f))
    )
  }

  const getFilterLabel = (type: FilterType): string => {
    switch (type) {
      case 'client_group':
        return 'Client Group'
      case 'account_manager':
        return 'Partner'
      case 'job_manager':
        return 'Manager'
      case 'job_name':
        return 'Job Name'
      case 'staff':
        return 'Staff'
      default:
        return type
    }
  }

  const renderFilterInput = (filter: BillableFilter) => {
    switch (filter.type) {
      case 'client_group':
        return (
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(filter.id, { value })}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select client group" />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.clientGroups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      
      case 'account_manager':
        const partnersToShow = (partnerList && partnerList.length > 0) ? partnerList : (filterOptions.accountManagers || [])
        const partnerValue = filter.value === 'all' || !filter.value ? 'all' : filter.value
        // Debug log
        if (partnersToShow.length > 0 && partnersToShow.length <= 10) {
          console.log('Rendering Partner filter:', { partnerValue, partnersToShow, partnerList })
        }
        return (
          <Select
            value={partnerValue}
            onValueChange={(value) => {
              console.log('Partner filter changed:', value)
              updateFilter(filter.id, { value: value === 'all' ? 'all' : value })
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Partners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Partners</SelectItem>
              {partnersToShow.length === 0 ? (
                <SelectItem value="" disabled>No partners available</SelectItem>
              ) : (
                partnersToShow.map((manager) => (
                  <SelectItem key={manager} value={manager}>
                    {manager}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )
      
      case 'job_manager':
        const clientManagersToShow = (clientManagerList && clientManagerList.length > 0) ? clientManagerList : (filterOptions.jobManagers || [])
        const clientManagerValue = filter.value === 'all' || !filter.value ? 'all' : filter.value
        // Debug log
        if (clientManagersToShow.length > 0 && clientManagersToShow.length <= 10) {
          console.log('Rendering Manager filter:', { clientManagerValue, clientManagersToShow, clientManagerList })
        }
        return (
          <Select
            value={clientManagerValue}
            onValueChange={(value) => {
              console.log('Manager filter changed:', value)
              updateFilter(filter.id, { value: value === 'all' ? 'all' : value })
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Managers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Managers</SelectItem>
              {clientManagersToShow.length === 0 ? (
                <SelectItem value="" disabled>No managers available</SelectItem>
              ) : (
                clientManagersToShow.map((manager) => (
                  <SelectItem key={manager} value={manager}>
                    {manager}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )
      
      case 'job_name':
        return (
          <div className="flex items-center gap-2">
            <Select
              value={filter.operator || 'contains'}
              onValueChange={(value: 'contains' | 'not_contains') =>
                updateFilter(filter.id, { operator: value })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="not_contains">Does not contain</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Enter text (e.g., PG)"
              value={filter.value}
              onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
              className="w-[200px]"
            />
          </div>
        )
      
      case 'staff':
        // Handle both 'all' string and empty string as 'all'
        const staffValue = filter.value === 'all' || !filter.value ? 'all' : filter.value
        return (
          <Select
            value={staffValue}
            onValueChange={(value) => updateFilter(filter.id, { value: value === 'all' ? 'all' : value })}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Staff" />
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
        )
      
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Loading filters...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex items-center gap-2 flex-wrap justify-end w-full">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4" />
          <span>Filters:</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addFilter}
            className="w-fit"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Filter
          </Button>
          {onApplyFilters && (
            <Button
              variant="default"
              size="sm"
              onClick={onApplyFilters}
              className="w-fit"
            >
              <Check className="h-4 w-4 mr-2" />
              Apply Filter
            </Button>
          )}
          {onSaveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveFilters}
              disabled={saving}
              className="w-fit"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Filter'}
            </Button>
          )}
        </div>
        {filters.length === 0 && (
          <span className="text-sm text-muted-foreground">
            No filters applied
          </span>
        )}
      </div>
      
      {filters.length > 0 && (
        <div className="flex flex-col gap-2 items-end">
          {filters.map((filter) => (
            <div key={filter.id} className="flex items-center gap-2 flex-wrap justify-end">
              <Select
                value={filter.type}
                onValueChange={(value: FilterType) => {
                  let defaultValue = ''
                  if (value === 'staff' || value === 'account_manager' || value === 'job_manager') {
                    defaultValue = 'all' // Set default to 'all' for staff, partner, and client manager filters
                  }
                  updateFilter(filter.id, {
                    type: value,
                    value: defaultValue,
                    operator: value === 'job_name' ? 'contains' : undefined,
                  })
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client_group">Client Group</SelectItem>
                  <SelectItem value="account_manager">Partner</SelectItem>
                  <SelectItem value="job_manager">Manager</SelectItem>
                  <SelectItem value="job_name">Job Name</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
              
              {renderFilterInput(filter)}
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeFilter(filter.id)}
                className="h-9 w-9"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
