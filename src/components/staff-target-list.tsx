'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { TableSkeleton } from '@/components/charts/chart-skeleton'

interface StaffTarget {
  id: string
  staff_name: string
  name: string
  target_billable_percentage: number | null
  fte: number | null
  default_daily_hours: number | null
  is_hidden: boolean
  job_title: string | null
  team: string | null
  email: string | null
  report: boolean
  start_date: string | null
  end_date: string | null
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
  start_date: string
  end_date: string
}

type SortColumn = 'name' | 'job_title' | 'team' | 'email' | 'target_billable_percentage' | 'fte' | 'default_daily_hours' | 'report' | 'start_date' | 'end_date'
type SortDirection = 'asc' | 'desc'

export function StaffTargetList({ organizationId }: StaffTargetListProps) {
  const [staffList, setStaffList] = useState<StaffTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [showHidden, setShowHidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  // Track editing values for each staff member by staff_name
  const [editingValues, setEditingValues] = useState<Map<string, EditingValues>>(new Map())
  // Track original values (saved values) to detect unsaved changes
  const [originalValues, setOriginalValues] = useState<Map<string, EditingValues>>(new Map())
  // Dialog state for unsaved changes warning
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const navigationBlockedRef = useRef(false)

  useEffect(() => {
    loadStaff()
  }, [organizationId])

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (editingValues.size === 0) return false

    for (const [staffName, currentValues] of editingValues) {
      const original = originalValues.get(staffName)
      if (!original) {
        // New staff member with any non-default values
        if (
          currentValues.target_billable_percentage !== '' ||
          currentValues.fte !== '' ||
          currentValues.default_daily_hours !== '' ||
          currentValues.job_title !== '' ||
          currentValues.team !== '' ||
          currentValues.email !== '' ||
          currentValues.start_date !== '' ||
          currentValues.end_date !== '' ||
          currentValues.is_hidden !== false ||
          currentValues.report !== true
        ) {
          return true
        }
        continue
      }

      // Compare all fields
      if (
        currentValues.target_billable_percentage !== original.target_billable_percentage ||
        currentValues.fte !== original.fte ||
        currentValues.default_daily_hours !== original.default_daily_hours ||
        currentValues.job_title !== original.job_title ||
        currentValues.team !== original.team ||
        currentValues.email !== original.email ||
        currentValues.start_date !== original.start_date ||
        currentValues.end_date !== original.end_date ||
        currentValues.is_hidden !== original.is_hidden ||
        currentValues.report !== original.report
      ) {
        return true
      }
    }
    return false
  }, [editingValues, originalValues])

  // Intercept navigation attempts
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  // Intercept link clicks
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')
      if (!link || !hasUnsavedChanges()) return

      const href = link.getAttribute('href')
      if (href && href.startsWith('/') && href !== pathname) {
        e.preventDefault()
        setPendingNavigation(href)
        setShowUnsavedDialog(true)
        navigationBlockedRef.current = true
      }
    }

    document.addEventListener('click', handleLinkClick, true)

    return () => {
      document.removeEventListener('click', handleLinkClick, true)
    }
  }, [hasUnsavedChanges, pathname])

  // Handle dialog actions
  const handleSaveAndNavigate = async () => {
    await handleSaveAll()
    setShowUnsavedDialog(false)
    if (pendingNavigation) {
      navigationBlockedRef.current = false
      router.push(pendingNavigation)
      setPendingNavigation(null)
    }
  }

  const handleCancelNavigation = () => {
    setShowUnsavedDialog(false)
    setPendingNavigation(null)
    navigationBlockedRef.current = false
  }

  const loadStaff = async () => {
    try {
      const response = await fetch('/api/staff/target-billable')
      if (response.ok) {
        const data = await response.json()
        setStaffList(data)
        // Initialize editing values with current values
        const initialValues = new Map<string, EditingValues>()
        data.forEach((staff: StaffTarget) => {
          initialValues.set(staff.staff_name, {
            target_billable_percentage: staff.target_billable_percentage?.toString() || '',
            fte: staff.fte?.toString() || '',
            default_daily_hours: staff.default_daily_hours?.toString() || '',
            is_hidden: staff.is_hidden,
            job_title: staff.job_title || '',
            team: staff.team || '',
            email: staff.email || '',
            report: staff.report !== undefined ? staff.report : true,
            start_date: staff.start_date || '',
            end_date: staff.end_date || '',
          })
        })
        setEditingValues(initialValues)
        // Also store as original values for comparison
        setOriginalValues(new Map(initialValues))
      } else {
        console.error('Failed to load staff')
      }
    } catch (error) {
      console.error('Failed to load staff:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateEditingValue = (staffName: string, field: keyof EditingValues, value: string | boolean) => {
    setEditingValues((prev) => {
      const newMap = new Map(prev)
      const current = newMap.get(staffName) || {
        target_billable_percentage: '',
        fte: '',
        default_daily_hours: '',
        is_hidden: false,
        job_title: '',
        team: '',
        email: '',
        report: true,
        start_date: '',
        end_date: '',
      }
      newMap.set(staffName, { ...current, [field]: value })
      return newMap
    })
  }

  const getEditingValue = (staffName: string, field: keyof EditingValues): string | boolean => {
    const values = editingValues.get(staffName)
    if (!values) {
      const staff = staffList.find((s) => s.staff_name === staffName)
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
        : field === 'start_date'
        ? staff.start_date || ''
        : field === 'end_date'
        ? staff.end_date || ''
        : ''
    }
    return values[field]
  }

  const handleToggleHidden = async (staffName: string, newHiddenValue: boolean) => {
    setSaving(true)
    try {
      const response = await fetch('/api/staff/target-billable', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_name: staffName,
          is_hidden: newHiddenValue,
        }),
      })

      if (response.ok) {
        // Update local state immediately
        updateEditingValue(staffName, 'is_hidden', newHiddenValue)
        loadStaff()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update hidden status')
        // Revert the change
        updateEditingValue(staffName, 'is_hidden', !newHiddenValue)
      }
    } catch (error) {
      console.error('Toggle hidden error:', error)
      alert('Failed to update hidden status')
      // Revert the change
      updateEditingValue(staffName, 'is_hidden', !newHiddenValue)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAll = async () => {
    // Filter staff based on showHidden setting
    const visibleStaff = staffList.filter((staff) => !staff.is_hidden || showHidden)

    // Only include staff with changes
    const staffToSave: any[] = []
    visibleStaff.forEach((staff) => {
      const values = editingValues.get(staff.staff_name)
      if (!values) return

      const original = originalValues.get(staff.staff_name)
      
      // Check if there are any changes
      const hasChanges = !original || 
        values.target_billable_percentage !== original.target_billable_percentage ||
        values.fte !== original.fte ||
        values.default_daily_hours !== original.default_daily_hours ||
        values.job_title !== original.job_title ||
        values.team !== original.team ||
        values.email !== original.email ||
        values.start_date !== original.start_date ||
        values.end_date !== original.end_date ||
        values.is_hidden !== original.is_hidden ||
        values.report !== original.report

      if (!hasChanges) return

      const payload: any = {
        staff_name: staff.staff_name,
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
      if (values.start_date && values.start_date.trim() !== '') {
        payload.start_date = values.start_date.trim()
      }
      if (values.end_date && values.end_date.trim() !== '') {
        payload.end_date = values.end_date.trim()
      }

      staffToSave.push(payload)
    })

    if (staffToSave.length === 0) {
      // No changes to save
      alert('No changes to save')
      return
    }

    setSaving(true)
    setSaveProgress({ current: 0, total: staffToSave.length })
    try {
      // Use batch update API
      const response = await fetch('/api/staff/target-billable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff: staffToSave }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save staff settings')
      }

      const result = await response.json()
      setSaveProgress({ current: staffToSave.length, total: staffToSave.length })
      
      // Update local state without reloading all data
      // Update originalValues to match current editingValues for saved staff
      setOriginalValues((prev) => {
        const newMap = new Map(prev)
        staffToSave.forEach((savedStaff) => {
          const values = editingValues.get(savedStaff.staff_name)
          if (values) {
            newMap.set(savedStaff.staff_name, { ...values })
          }
        })
        return newMap
      })

      // Update staffList with saved values
      setStaffList((prev) => {
        return prev.map((staff) => {
          const savedData = staffToSave.find(s => s.staff_name === staff.staff_name)
          if (!savedData) return staff

          const values = editingValues.get(staff.staff_name)
          if (!values) return staff

          return {
            ...staff,
            target_billable_percentage: savedData.target_billable_percentage !== undefined 
              ? savedData.target_billable_percentage 
              : staff.target_billable_percentage,
            fte: savedData.fte !== undefined ? savedData.fte : staff.fte,
            default_daily_hours: savedData.default_daily_hours !== undefined 
              ? savedData.default_daily_hours 
              : staff.default_daily_hours,
            job_title: savedData.job_title !== undefined ? savedData.job_title : staff.job_title,
            team: savedData.team !== undefined ? savedData.team : staff.team,
            email: savedData.email !== undefined ? savedData.email : staff.email,
            start_date: savedData.start_date !== undefined ? savedData.start_date : staff.start_date,
            end_date: savedData.end_date !== undefined ? savedData.end_date : staff.end_date,
            is_hidden: values.is_hidden,
            report: values.report,
          }
        })
      })
    } catch (error: any) {
      alert(error.message || 'Failed to save staff settings')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveProgress(null), 1000) // Clear progress after 1 second
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
        const aJobTitle = getEditingValue(a.staff_name, 'job_title') as string
        const bJobTitle = getEditingValue(b.staff_name, 'job_title') as string
        aValue = aJobTitle || ''
        bValue = bJobTitle || ''
        break
      }
      case 'team': {
        const aTeam = getEditingValue(a.staff_name, 'team') as string
        const bTeam = getEditingValue(b.staff_name, 'team') as string
        aValue = aTeam || ''
        bValue = bTeam || ''
        break
      }
      case 'target_billable_percentage': {
        const aPercent = getEditingValue(a.staff_name, 'target_billable_percentage') as string
        const bPercent = getEditingValue(b.staff_name, 'target_billable_percentage') as string
        aValue = aPercent ? parseFloat(aPercent) : null
        bValue = bPercent ? parseFloat(bPercent) : null
        break
      }
      case 'fte': {
        const aFte = getEditingValue(a.staff_name, 'fte') as string
        const bFte = getEditingValue(b.staff_name, 'fte') as string
        aValue = aFte ? parseFloat(aFte) : null
        bValue = bFte ? parseFloat(bFte) : null
        break
      }
      case 'default_daily_hours': {
        const aHours = getEditingValue(a.staff_name, 'default_daily_hours') as string
        const bHours = getEditingValue(b.staff_name, 'default_daily_hours') as string
        aValue = aHours ? parseFloat(aHours) : null
        bValue = bHours ? parseFloat(bHours) : null
        break
      }
      case 'email': {
        const aEmail = getEditingValue(a.staff_name, 'email') as string
        const bEmail = getEditingValue(b.staff_name, 'email') as string
        aValue = aEmail || ''
        bValue = bEmail || ''
        break
      }
      case 'report': {
        aValue = getEditingValue(a.staff_name, 'report') ? 1 : 0
        bValue = getEditingValue(b.staff_name, 'report') ? 1 : 0
        break
      }
      case 'start_date': {
        const aStartDate = getEditingValue(a.staff_name, 'start_date') as string
        const bStartDate = getEditingValue(b.staff_name, 'start_date') as string
        aValue = aStartDate || ''
        bValue = bStartDate || ''
        break
      }
      case 'end_date': {
        const aEndDate = getEditingValue(a.staff_name, 'end_date') as string
        const bEndDate = getEditingValue(b.staff_name, 'end_date') as string
        aValue = aEndDate || ''
        bValue = bEndDate || ''
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
    return <TableSkeleton />
  }

  return (
    <>
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Do you want to save all changes before leaving?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelNavigation}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAndNavigate}
              disabled={saving}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="flex justify-between items-center pt-4 px-6">
          <div>
            <p className="text-xs text-slate-500">
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
              <Label htmlFor="show-hidden" className="text-xs cursor-pointer text-slate-600">
                Show hidden staff
              </Label>
            </div>
            <Button 
              onClick={handleSaveAll} 
              disabled={saving} 
              size="sm"
              className="bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] transition-all duration-150 h-9 px-4 font-semibold text-xs"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving 
                ? saveProgress 
                  ? `Saving... (${saveProgress.current}/${saveProgress.total})`
                  : 'Saving...'
                : 'Save All'}
            </Button>
          </div>
        </div>

      {staffList.length === 0 ? (
        <div className="flex items-center justify-center h-[200px]">
          <div className="text-center">
            <Users className="mx-auto h-12 w-12 text-slate-400 mb-4" />
            <p className="text-sm text-slate-500">
              No staff members found. Please upload timesheet data first.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-b bg-slate-50/50">
                  <th
                    className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r whitespace-nowrap"
                    onClick={() => handleSort('name')}
                  >
                    Name<SortIcon column="name" />
                  </th>
                  <th
                    className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r whitespace-nowrap"
                    onClick={() => handleSort('job_title')}
                  >
                    Job Title<SortIcon column="job_title" />
                  </th>
                  <th
                    className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r whitespace-nowrap"
                    onClick={() => handleSort('team')}
                  >
                    Team<SortIcon column="team" />
                  </th>
                  <th
                    className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r whitespace-nowrap"
                    onClick={() => handleSort('email')}
                  >
                    Email<SortIcon column="email" />
                  </th>
                  <th
                    className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30 whitespace-nowrap"
                    onClick={() => handleSort('target_billable_percentage')}
                  >
                    Target Billable (%)<SortIcon column="target_billable_percentage" />
                  </th>
                  <th
                    className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30 whitespace-nowrap"
                    onClick={() => handleSort('fte')}
                  >
                    FTE<SortIcon column="fte" />
                  </th>
                  <th
                    className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30 whitespace-nowrap"
                    onClick={() => handleSort('default_daily_hours')}
                  >
                    Daily Hours<SortIcon column="default_daily_hours" />
                  </th>
                  <th
                    className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30 whitespace-nowrap"
                    onClick={() => handleSort('start_date')}
                  >
                    Start Date<SortIcon column="start_date" />
                  </th>
                  <th
                    className="text-left p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r bg-slate-50/30 whitespace-nowrap"
                    onClick={() => handleSort('end_date')}
                  >
                    End Date<SortIcon column="end_date" />
                  </th>
                  <th
                    className="text-center p-2 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none border-r whitespace-nowrap"
                    onClick={() => handleSort('report')}
                  >
                    Report<SortIcon column="report" />
                  </th>
                  <th className="text-center p-2 font-bold text-slate-700 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleStaff.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-500">
                      No staff members to display
                    </td>
                  </tr>
                ) : (
                  visibleStaff.map((staff) => (
                    <tr 
                      key={staff.id} 
                      className={`hover:bg-slate-50 transition-colors group ${
                        staff.is_hidden && showHidden ? 'bg-pink-50' : ''
                      }`}
                    >
                      <td className="p-2 border-r">
                        <div className="font-semibold text-slate-700 whitespace-nowrap">{staff.name}</div>
                      </td>
                      <td className="p-2 border-r">
                        <Input
                          type="text"
                          value={getEditingValue(staff.staff_name, 'job_title') as string}
                          onChange={(e) =>
                            updateEditingValue(staff.staff_name, 'job_title', e.target.value)
                          }
                          className="w-32 text-[10px] h-8"
                          placeholder="Job Title"
                          disabled={saving}
                        />
                      </td>
                      <td className="p-2 border-r">
                        <Input
                          type="text"
                          value={getEditingValue(staff.staff_name, 'team') as string}
                          onChange={(e) => updateEditingValue(staff.staff_name, 'team', e.target.value)}
                          className="w-32 text-[10px] h-8"
                          placeholder="Team"
                          disabled={saving}
                        />
                      </td>
                      <td className="p-2 border-r">
                        <Input
                          type="email"
                          value={getEditingValue(staff.staff_name, 'email') as string}
                          onChange={(e) => updateEditingValue(staff.staff_name, 'email', e.target.value)}
                          className="w-40 text-[10px] h-8"
                          placeholder="Email"
                          disabled={saving}
                        />
                      </td>
                      <td className="p-2 border-r">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={getEditingValue(staff.staff_name, 'target_billable_percentage') as string}
                          onChange={(e) =>
                            updateEditingValue(staff.staff_name, 'target_billable_percentage', e.target.value)
                          }
                          className="w-16 text-[10px] h-8"
                          placeholder="%"
                          disabled={saving}
                        />
                      </td>
                      <td className="p-2 border-r">
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={getEditingValue(staff.staff_name, 'fte') as string}
                          onChange={(e) => updateEditingValue(staff.staff_name, 'fte', e.target.value)}
                          className="w-16 text-[10px] h-8"
                          placeholder="0.0-1.0"
                          disabled={saving}
                        />
                      </td>
                      <td className="p-2 border-r">
                        <Input
                          type="number"
                          min="0"
                          max="24"
                          step="0.1"
                          value={getEditingValue(staff.staff_name, 'default_daily_hours') as string}
                          onChange={(e) =>
                            updateEditingValue(staff.staff_name, 'default_daily_hours', e.target.value)
                          }
                          className="w-16 text-[10px] h-8"
                          placeholder="hours"
                          disabled={saving}
                        />
                      </td>
                      <td className="p-2 border-r">
                        {(() => {
                          const dateValue = getEditingValue(staff.staff_name, 'start_date') as string
                          return (
                            <Input
                              type="date"
                              value={dateValue || ''}
                              onChange={(e) =>
                                updateEditingValue(staff.staff_name, 'start_date', e.target.value || '')
                              }
                              className="w-28 text-[10px] h-8"
                              disabled={saving}
                            />
                          )
                        })()}
                      </td>
                      <td className="p-2 border-r">
                        {(() => {
                          const dateValue = getEditingValue(staff.staff_name, 'end_date') as string
                          return (
                            <Input
                              type="date"
                              value={dateValue || ''}
                              onChange={(e) =>
                                updateEditingValue(staff.staff_name, 'end_date', e.target.value || '')
                              }
                              className="w-28 text-[10px] h-8"
                              disabled={saving}
                            />
                          )
                        })()}
                      </td>
                      <td className="p-2 border-r">
                        <div className="flex justify-center">
                          <Button
                            size="sm"
                            variant={(getEditingValue(staff.staff_name, 'report') as boolean) ? 'default' : 'outline'}
                            onClick={() => {
                              const currentReport = getEditingValue(staff.staff_name, 'report') as boolean
                              updateEditingValue(staff.staff_name, 'report', !currentReport)
                            }}
                            disabled={saving}
                            className={cn(
                              "text-[10px] h-8 px-2 font-semibold transition-all duration-200",
                              (getEditingValue(staff.staff_name, 'report') as boolean) && "bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.98]"
                            )}
                          >
                            {(getEditingValue(staff.staff_name, 'report') as boolean) ? 'Yes' : 'No'}
                          </Button>
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          size="sm"
                          variant={getEditingValue(staff.staff_name, 'is_hidden') ? 'outline' : 'secondary'}
                          onClick={() => {
                            const currentHidden = getEditingValue(staff.staff_name, 'is_hidden') as boolean
                            handleToggleHidden(staff.staff_name, !currentHidden)
                          }}
                          disabled={saving}
                          className="text-[10px] h-8 px-2 font-semibold"
                        >
                          {getEditingValue(staff.staff_name, 'is_hidden') ? 'Unhide' : 'Hide'}
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
    </>
  )
}
