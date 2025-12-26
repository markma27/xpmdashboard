'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Save } from 'lucide-react'

interface StaffTarget {
  id: string
  xpm_id: string
  name: string
  target_billable_percentage: number | null
  fte: number | null
  default_daily_hours: number | null
  is_hidden: boolean
  job_title: string | null
  team: string | null
  email: string | null
  report: boolean
}

interface StaffTargetListProps {
  organizationId: string
}

interface EditingValues {
  target_billable_percentage: string
  fte: string
  default_daily_hours: string
  is_hidden: boolean
  job_title: string
  team: string
  email: string
  report: boolean
}

type SortColumn = 'name' | 'job_title' | 'team' | 'email' | 'target_billable_percentage' | 'fte' | 'default_daily_hours' | 'report'
type SortDirection = 'asc' | 'desc'

export function StaffTargetList({ organizationId }: StaffTargetListProps) {
  const [staffList, setStaffList] = useState<StaffTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [showHidden, setShowHidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  // Track editing values for each staff member by xpm_id
  const [editingValues, setEditingValues] = useState<Map<string, EditingValues>>(new Map())

  useEffect(() => {
    loadStaff()
  }, [organizationId])

  const loadStaff = async () => {
    try {
      const response = await fetch('/api/staff/target-billable')
      if (response.ok) {
        const data = await response.json()
        setStaffList(data)
        // Initialize editing values with current values
        const initialValues = new Map<string, EditingValues>()
        data.forEach((staff: StaffTarget) => {
          initialValues.set(staff.xpm_id, {
            target_billable_percentage: staff.target_billable_percentage?.toString() || '',
            fte: staff.fte?.toString() || '',
            default_daily_hours: staff.default_daily_hours?.toString() || '',
            is_hidden: staff.is_hidden,
            job_title: staff.job_title || '',
            team: staff.team || '',
            email: staff.email || '',
            report: staff.report !== undefined ? staff.report : true,
          })
        })
        setEditingValues(initialValues)
      } else {
        console.error('Failed to load staff')
      }
    } catch (error) {
      console.error('Failed to load staff:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateEditingValue = (xpmId: string, field: keyof EditingValues, value: string | boolean) => {
    setEditingValues((prev) => {
      const newMap = new Map(prev)
      const current = newMap.get(xpmId) || {
        target_billable_percentage: '',
        fte: '',
        default_daily_hours: '',
        is_hidden: false,
        job_title: '',
        team: '',
        email: '',
        report: true,
      }
      newMap.set(xpmId, { ...current, [field]: value })
      return newMap
    })
  }

  const getEditingValue = (xpmId: string, field: keyof EditingValues): string | boolean => {
    const values = editingValues.get(xpmId)
    if (!values) {
      const staff = staffList.find((s) => s.xpm_id === xpmId)
      if (!staff) return field === 'is_hidden' ? false : ''
      return field === 'is_hidden'
        ? staff.is_hidden
        : field === 'target_billable_percentage'
        ? staff.target_billable_percentage?.toString() || ''
        : field === 'fte'
        ? staff.fte?.toString() || ''
        : field === 'default_daily_hours'
        ? staff.default_daily_hours?.toString() || ''
        : field === 'job_title'
        ? staff.job_title || ''
        : field === 'team'
        ? staff.team || ''
        : field === 'email'
        ? staff.email || ''
        : field === 'report'
        ? (staff.report !== undefined ? staff.report : true)
        : ''
    }
    return values[field]
  }

  const handleToggleHidden = async (xpmId: string, newHiddenValue: boolean) => {
    setSaving(true)
    try {
      const response = await fetch('/api/staff/target-billable', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xpm_id: xpmId,
          is_hidden: newHiddenValue,
        }),
      })

      if (response.ok) {
        // Update local state immediately
        updateEditingValue(xpmId, 'is_hidden', newHiddenValue)
        loadStaff()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update hidden status')
        // Revert the change
        updateEditingValue(xpmId, 'is_hidden', !newHiddenValue)
      }
    } catch (error) {
      console.error('Toggle hidden error:', error)
      alert('Failed to update hidden status')
      // Revert the change
      updateEditingValue(xpmId, 'is_hidden', !newHiddenValue)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAll = async () => {
    // Filter staff based on showHidden setting
    const visibleStaff = staffList.filter((staff) => !staff.is_hidden || showHidden)

    setSaving(true)
    try {
      // Save all visible staff - allow all fields to be empty
      const savePromises = visibleStaff.map(async (staff) => {
        const values = editingValues.get(staff.xpm_id)
        if (!values) return

        const payload: any = {
          xpm_id: staff.xpm_id,
          is_hidden: values.is_hidden,
        }

        // Include all fields, even if empty (let API handle null values)
        if (values.target_billable_percentage && values.target_billable_percentage.trim() !== '') {
          const percentage = parseFloat(values.target_billable_percentage)
          if (!isNaN(percentage)) {
            payload.target_billable_percentage = percentage
          }
        }
        if (values.fte && values.fte.trim() !== '') {
          const fte = parseFloat(values.fte)
          if (!isNaN(fte)) {
            payload.fte = fte
          }
        }
        if (values.default_daily_hours && values.default_daily_hours.trim() !== '') {
          const dailyHours = parseFloat(values.default_daily_hours)
          if (!isNaN(dailyHours)) {
            payload.default_daily_hours = dailyHours
          }
        }
        if (values.job_title && values.job_title.trim() !== '') {
          payload.job_title = values.job_title.trim()
        }
        if (values.team && values.team.trim() !== '') {
          payload.team = values.team.trim()
        }
        if (values.email && values.email.trim() !== '') {
          payload.email = values.email.trim()
        }
        if (values.report !== undefined) {
          payload.report = values.report
        }

        const response = await fetch('/api/staff/target-billable', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(`${staff.name}: ${data.error || 'Failed to save'}`)
        }
      })

      await Promise.all(savePromises)
      loadStaff()
    } catch (error: any) {
      alert(error.message || 'Failed to save staff settings')
    } finally {
      setSaving(false)
    }
  }

  // Filter staff based on showHidden setting
  const filteredStaff = staffList.filter((staff) => !staff.is_hidden || showHidden)

  // Sort staff
  const visibleStaff = [...filteredStaff].sort((a, b) => {
    let aValue: string | number | null
    let bValue: string | number | null

    switch (sortColumn) {
      case 'name':
        aValue = a.name || ''
        bValue = b.name || ''
        break
      case 'job_title': {
        const aJobTitle = getEditingValue(a.xpm_id, 'job_title') as string
        const bJobTitle = getEditingValue(b.xpm_id, 'job_title') as string
        aValue = aJobTitle || ''
        bValue = bJobTitle || ''
        break
      }
      case 'team': {
        const aTeam = getEditingValue(a.xpm_id, 'team') as string
        const bTeam = getEditingValue(b.xpm_id, 'team') as string
        aValue = aTeam || ''
        bValue = bTeam || ''
        break
      }
      case 'target_billable_percentage': {
        const aPercent = getEditingValue(a.xpm_id, 'target_billable_percentage') as string
        const bPercent = getEditingValue(b.xpm_id, 'target_billable_percentage') as string
        aValue = aPercent ? parseFloat(aPercent) : null
        bValue = bPercent ? parseFloat(bPercent) : null
        break
      }
      case 'fte': {
        const aFte = getEditingValue(a.xpm_id, 'fte') as string
        const bFte = getEditingValue(b.xpm_id, 'fte') as string
        aValue = aFte ? parseFloat(aFte) : null
        bValue = bFte ? parseFloat(bFte) : null
        break
      }
      case 'default_daily_hours': {
        const aHours = getEditingValue(a.xpm_id, 'default_daily_hours') as string
        const bHours = getEditingValue(b.xpm_id, 'default_daily_hours') as string
        aValue = aHours ? parseFloat(aHours) : null
        bValue = bHours ? parseFloat(bHours) : null
        break
      }
      case 'email': {
        const aEmail = getEditingValue(a.xpm_id, 'email') as string
        const bEmail = getEditingValue(b.xpm_id, 'email') as string
        aValue = aEmail || ''
        bValue = bEmail || ''
        break
      }
      case 'report': {
        aValue = getEditingValue(a.xpm_id, 'report') ? 1 : 0
        bValue = getEditingValue(b.xpm_id, 'report') ? 1 : 0
        break
      }
      default:
        return 0
    }

    // Handle null/empty values - null/empty values go to the end
    if ((aValue === null || aValue === '') && (bValue === null || bValue === '')) return 0
    if (aValue === null || aValue === '') return 1
    if (bValue === null || bValue === '') return -1

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue)
      return sortDirection === 'asc' ? comparison : -comparison
    } else {
      const comparison = (aValue as number) - (bValue as number)
      return sortDirection === 'asc' ? comparison : -comparison
    }
  })

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column and default to ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Loading staff...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pt-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {visibleStaff.length} of {staffList.length} staff member{staffList.length !== 1 ? 's' : ''} shown
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-hidden"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="show-hidden" className="text-sm cursor-pointer">
              Show hidden staff
            </Label>
          </div>
          <Button onClick={handleSaveAll} disabled={saving} size="default">
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>
      </div>

      {staffList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            No staff members found. Please sync staff data from XPM first.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th
                    className="text-left p-3 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('name')}
                  >
                    Name<SortIcon column="name" />
                  </th>
                  <th
                    className="text-left p-3 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('job_title')}
                  >
                    Job Title<SortIcon column="job_title" />
                  </th>
                  <th
                    className="text-left p-3 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('team')}
                  >
                    Team<SortIcon column="team" />
                  </th>
                  <th
                    className="text-left p-3 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('email')}
                  >
                    Email<SortIcon column="email" />
                  </th>
                  <th
                    className="text-left p-3 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('target_billable_percentage')}
                  >
                    Target Billable (%)<SortIcon column="target_billable_percentage" />
                  </th>
                  <th
                    className="text-left p-3 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('fte')}
                  >
                    FTE<SortIcon column="fte" />
                  </th>
                  <th
                    className="text-left p-3 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('default_daily_hours')}
                  >
                    Daily Hours<SortIcon column="default_daily_hours" />
                  </th>
                  <th
                    className="text-center p-3 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('report')}
                  >
                    Report<SortIcon column="report" />
                  </th>
                  <th className="text-center p-3 font-semibold text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleStaff.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No staff members to display
                    </td>
                  </tr>
                ) : (
                  visibleStaff.map((staff) => (
                    <tr key={staff.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-medium text-sm">{staff.name}</div>
                      </td>
                      <td className="p-3">
                        <Input
                          type="text"
                          value={getEditingValue(staff.xpm_id, 'job_title') as string}
                          onChange={(e) =>
                            updateEditingValue(staff.xpm_id, 'job_title', e.target.value)
                          }
                          className="w-48 text-sm"
                          placeholder="Job Title"
                          disabled={saving}
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="text"
                          value={getEditingValue(staff.xpm_id, 'team') as string}
                          onChange={(e) => updateEditingValue(staff.xpm_id, 'team', e.target.value)}
                          className="w-48 text-sm"
                          placeholder="Team"
                          disabled={saving}
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="email"
                          value={getEditingValue(staff.xpm_id, 'email') as string}
                          onChange={(e) => updateEditingValue(staff.xpm_id, 'email', e.target.value)}
                          className="w-64 text-sm"
                          placeholder="Email"
                          disabled={saving}
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={getEditingValue(staff.xpm_id, 'target_billable_percentage') as string}
                          onChange={(e) =>
                            updateEditingValue(staff.xpm_id, 'target_billable_percentage', e.target.value)
                          }
                          className="w-24 text-sm"
                          placeholder="%"
                          disabled={saving}
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={getEditingValue(staff.xpm_id, 'fte') as string}
                          onChange={(e) => updateEditingValue(staff.xpm_id, 'fte', e.target.value)}
                          className="w-24 text-sm"
                          placeholder="0.0-1.0"
                          disabled={saving}
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min="0"
                          max="24"
                          step="0.1"
                          value={getEditingValue(staff.xpm_id, 'default_daily_hours') as string}
                          onChange={(e) =>
                            updateEditingValue(staff.xpm_id, 'default_daily_hours', e.target.value)
                          }
                          className="w-24 text-sm"
                          placeholder="hours"
                          disabled={saving}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center">
                          <Button
                            size="sm"
                            variant={(getEditingValue(staff.xpm_id, 'report') as boolean) ? 'default' : 'outline'}
                            onClick={() => {
                              const currentReport = getEditingValue(staff.xpm_id, 'report') as boolean
                              updateEditingValue(staff.xpm_id, 'report', !currentReport)
                            }}
                            disabled={saving}
                            className="text-sm min-w-[60px]"
                          >
                            {(getEditingValue(staff.xpm_id, 'report') as boolean) ? 'Yes' : 'No'}
                          </Button>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          size="sm"
                          variant={getEditingValue(staff.xpm_id, 'is_hidden') ? 'outline' : 'secondary'}
                          onClick={() => {
                            const currentHidden = getEditingValue(staff.xpm_id, 'is_hidden') as boolean
                            handleToggleHidden(staff.xpm_id, !currentHidden)
                          }}
                          disabled={saving}
                          className="text-sm"
                        >
                          {getEditingValue(staff.xpm_id, 'is_hidden') ? 'Unhide' : 'Hide'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
