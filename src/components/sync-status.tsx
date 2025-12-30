'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react'

interface SyncStatus {
  table_name: string
  last_sync_at: string | null
  last_sync_status: string | null
  last_sync_count: number
  error_message: string | null
}

interface SyncStatusProps {
  organizationId: string
}

export function SyncStatus({ organizationId }: SyncStatusProps) {
  const [statuses, setStatuses] = useState<SyncStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncingTable, setSyncingTable] = useState<string | null>(null)
  const [progressMap, setProgressMap] = useState<Record<string, number>>({})
  const progressIntervalRef = useRef<Record<string, NodeJS.Timeout>>({})
  const startTimeRef = useRef<Record<string, number>>({})

  useEffect(() => {
    loadStatus()
  }, [organizationId])

  const loadStatus = async () => {
    try {
      const response = await fetch(`/api/xpm/sync/status?organizationId=${organizationId}`)
      if (response.ok) {
        const data = await response.json()
        // Filter out removed tables: costs, categories, tasks, timeentries, jobs
        // Check both short names (e.g., "costs") and full table names (e.g., "xpm_costs")
        // Also check formatted names (e.g., "Costs", "Categories", "Tasks", "Timeentries", "Jobs")
        const excludedTables = [
          'costs', 'categories', 'tasks', 'timeentries', 'jobs',
          'xpm_costs', 'xpm_categories', 'xpm_tasks', 'xpm_time_entries', 'xpm_jobs',
          'Costs', 'Categories', 'Tasks', 'Timeentries', 'Jobs',
          'Time Entries', 'Timeentries'
        ]
        const filteredData = data.filter((item: SyncStatus) => {
          const tableName = item.table_name.toLowerCase()
          const formattedName = formatTableName(item.table_name).toLowerCase()
          const isExcluded = excludedTables.some(excluded => 
            excluded.toLowerCase() === tableName || 
            excluded.toLowerCase() === formattedName ||
            tableName.includes(excluded.toLowerCase()) ||
            formattedName.includes(excluded.toLowerCase())
          )
          if (isExcluded) {
            console.log(`Filtering out table: ${item.table_name} (formatted: ${formatTableName(item.table_name)})`)
          }
          return !isExcluded
        })
        console.log(`Sync status: ${data.length} total, ${filteredData.length} after filtering`)
        setStatuses(filteredData)
      }
    } catch (error) {
      console.error('Failed to load sync status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch(`/api/xpm/sync?organizationId=${organizationId}`, {
        method: 'POST',
      })

      if (response.ok) {
        // Reload status after sync
        setTimeout(() => {
          loadStatus()
          setSyncing(false)
        }, 2000)
      } else {
        const data = await response.json()
        alert(`Sync failed: ${data.error || 'Unknown error'}`)
        setSyncing(false)
      }
    } catch (error) {
      console.error('Sync error:', error)
      alert('Sync failed')
      setSyncing(false)
    }
  }

  const handleSyncTable = async (statusTableName: string) => {
    setSyncingTable(statusTableName)
    
    // Initialize progress tracking
    setProgressMap(prev => ({ ...prev, [statusTableName]: 0 }))
    startTimeRef.current[statusTableName] = Date.now()
    
    // Get initial record count BEFORE sync starts (this is our starting point)
    let startRecordCount = 0
    try {
      const initialResponse = await fetch(`/api/xpm/sync/status?organizationId=${organizationId}`)
      if (initialResponse.ok) {
        const initialData = await initialResponse.json()
        const initialStatus = initialData.find((s: SyncStatus) => s.table_name === statusTableName)
        startRecordCount = initialStatus?.last_sync_count || 0
      }
    } catch (error) {
      console.error('Failed to get initial sync status:', error)
    }
    
    let lastRecordCount = startRecordCount
    let maxRecordCount = startRecordCount // Track the maximum we've seen
    
    // Start polling for progress based on actual record count
    // Poll the status API to get current record count and calculate progress
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/xpm/sync/status?organizationId=${organizationId}`)
        if (response.ok) {
          const data = await response.json()
          const currentStatus = data.find((s: SyncStatus) => s.table_name === statusTableName)
          
          if (currentStatus) {
            const currentRecords = currentStatus.last_sync_count || 0
            
            // Check if error_message contains progress info (temporary storage during sync)
            let totalRecords = 0
            let processedRecords = currentRecords
            
            if (currentStatus.error_message && currentStatus.error_message.startsWith('PROGRESS:')) {
              try {
                const progressData = JSON.parse(currentStatus.error_message.replace('PROGRESS:', ''))
                totalRecords = progressData.total || 0
                processedRecords = progressData.processed || currentRecords
              } catch (e) {
                // If parsing fails, use currentRecords as fallback
                console.warn('Failed to parse progress info:', e)
              }
            }
            
            // Calculate progress based on processed records vs total records
            // ALL tables should use: progress = (processedRecords / totalRecords) * 100
            if (totalRecords > 0) {
              // We know the total records, calculate accurate progress
              // Progress = (processedRecords / totalRecords) * 100
              // Cap at 95% until sync completes (will show 100% when sync finishes)
              const progress = Math.min(95, Math.round((processedRecords / totalRecords) * 100))
              setProgressMap(prev => ({ ...prev, [statusTableName]: progress }))
            } else if (currentStatus.last_sync_status === 'syncing') {
              // Sync is in progress but we don't know total yet
              // This should rarely happen if updateProgress is called correctly with totalRecords
              // Fallback: use processed records increase as indicator
              const recordIncrease = processedRecords - startRecordCount
              
              if (recordIncrease > 0) {
                // We have some increase, estimate progress
                // Estimate total based on current records (conservative estimate)
                maxRecordCount = Math.max(maxRecordCount, processedRecords)
                // Estimate total as at least 2x current, or use maxRecordCount if higher
                const estimatedTotal = Math.max(maxRecordCount, Math.max(processedRecords * 2, startRecordCount * 2))
                
                if (estimatedTotal > 0) {
                  const progress = Math.min(90, Math.round((processedRecords / estimatedTotal) * 100))
                  setProgressMap(prev => ({ ...prev, [statusTableName]: progress }))
                } else {
                  // Fallback: minimal progress
                  const elapsed = Date.now() - startTimeRef.current[statusTableName]
                  const progress = Math.min(10, Math.round((elapsed / 1000) * 2)) // 2% per second, max 10%
                  setProgressMap(prev => ({ ...prev, [statusTableName]: progress }))
                }
              } else {
                // No increase yet, show minimal progress
                const elapsed = Date.now() - startTimeRef.current[statusTableName]
                const progress = Math.min(10, Math.round((elapsed / 1000) * 2)) // 2% per second, max 10%
                setProgressMap(prev => ({ ...prev, [statusTableName]: progress }))
              }
            } else {
              // Sync not in progress or completed
              // Don't update progress here, let sync completion handle it
            }
            
            lastRecordCount = currentRecords
          }
        }
      } catch (error) {
        console.error('Failed to poll sync progress:', error)
      }
    }, 1000) // Poll every second
    
    progressIntervalRef.current[statusTableName] = pollInterval
    
    try {
      // Extract table name from status (e.g., "xpm_clients" -> "clients")
      const cleanTableName = statusTableName.replace('xpm_', '')
      
      console.log(`Syncing table: ${cleanTableName} (from ${statusTableName})`)
      
      const response = await fetch(
        `/api/xpm/sync?organizationId=${organizationId}&table=${cleanTableName}`,
        {
          method: 'POST',
        }
      )

      if (response.ok) {
        const data = await response.json()
        console.log(`Sync result for ${cleanTableName}:`, data)
        
        // Stop polling and set to 100%
        clearInterval(progressIntervalRef.current[statusTableName])
        setProgressMap(prev => ({ ...prev, [statusTableName]: 100 }))
        
        // Reload status after sync to get final count
        setTimeout(async () => {
          await loadStatus()
          setSyncingTable(null)
          // Clear progress after a delay
          setTimeout(() => {
            setProgressMap(prev => {
              const newMap = { ...prev }
              delete newMap[statusTableName]
              return newMap
            })
            delete progressIntervalRef.current[statusTableName]
            delete startTimeRef.current[statusTableName]
          }, 1000)
        }, 500)
      } else {
        const data = await response.json()
        clearInterval(progressIntervalRef.current[statusTableName])
        setProgressMap(prev => ({ ...prev, [statusTableName]: 0 }))
        alert(`Sync failed for ${cleanTableName}: ${data.error || 'Unknown error'}`)
        setSyncingTable(null)
        delete progressIntervalRef.current[statusTableName]
        delete startTimeRef.current[statusTableName]
      }
    } catch (error) {
      console.error(`Sync error for ${statusTableName}:`, error)
      clearInterval(progressIntervalRef.current[statusTableName])
      setProgressMap(prev => ({ ...prev, [statusTableName]: 0 }))
      alert(`Sync failed for ${statusTableName}`)
      setSyncingTable(null)
      delete progressIntervalRef.current[statusTableName]
      delete startTimeRef.current[statusTableName]
    }
  }
  
  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(progressIntervalRef.current).forEach(interval => {
        clearInterval(interval)
      })
    }
  }, [])

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const formatTableName = (tableName: string): string => {
    // Remove 'xpm_' prefix and replace underscores with spaces
    let formatted = tableName.replace('xpm_', '').replace(/_/g, ' ')
    
    // Special case: rename 'time entries' to 'Timesheets'
    if (formatted === 'time entries') {
      return 'Timesheets'
    }
    
    // Capitalize first letter of each word
    return formatted
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <p className="text-slate-500">Loading sync status...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pt-4 px-6">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-800">Sync Status</h3>
          <p className="text-xs text-slate-500 mt-1">
            Last sync status for all XPM tables
          </p>
        </div>
        <Button 
          onClick={handleSync} 
          disabled={syncing}
          size="sm"
          className="bg-black text-white hover:bg-black/80 active:bg-black/70 active:scale-[0.98] transition-all duration-150 h-9 px-4 font-semibold text-xs"
        >
          {syncing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Now
            </>
          )}
        </Button>
      </div>

      {statuses.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] mx-6">
          <p className="text-sm text-slate-500">
            No sync history. Click &quot;Sync Now&quot; to start syncing data.
          </p>
        </div>
      ) : (
        <div className="px-6 pb-4">
          <div className="grid gap-3">
            {statuses.map((status) => (
              <Card key={status.table_name} className="shadow-sm border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status.last_sync_status)}
                      <CardTitle className="text-sm font-bold text-slate-700">
                        {formatTableName(status.table_name)}
                      </CardTitle>
                    </div>
                    <div className="text-xs text-slate-500">
                      {status.last_sync_count} records
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="text-xs space-y-1 flex-1">
                        <div>
                          <span className="text-slate-500">Last sync: </span>
                          <span className="text-slate-700">
                            {status.last_sync_at
                              ? new Date(status.last_sync_at).toLocaleString()
                              : 'Never'}
                          </span>
                        </div>
                        {status.error_message && (
                          <div className="text-red-600 text-xs mt-2">
                            Error: {status.error_message}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncTable(status.table_name)}
                        disabled={syncingTable === status.table_name || syncing}
                        className="ml-4 h-8 px-3 text-xs font-semibold"
                      >
                        {syncingTable === status.table_name ? (
                          <>
                            <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-3 w-3" />
                            Sync
                          </>
                        )}
                      </Button>
                    </div>
                    {syncingTable === status.table_name && progressMap[status.table_name] !== undefined && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Progress</span>
                          <span className="font-medium text-slate-700">{progressMap[status.table_name]}%</span>
                        </div>
                        <Progress value={progressMap[status.table_name]} className="h-2" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


