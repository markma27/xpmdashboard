'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

  useEffect(() => {
    loadStatus()
  }, [organizationId])

  const loadStatus = async () => {
    try {
      const response = await fetch(`/api/xpm/sync/status?organizationId=${organizationId}`)
      if (response.ok) {
        const data = await response.json()
        setStatuses(data)
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
        
        // Reload status after sync
        setTimeout(() => {
          loadStatus()
          setSyncingTable(null)
        }, 1500)
      } else {
        const data = await response.json()
        alert(`Sync failed for ${cleanTableName}: ${data.error || 'Unknown error'}`)
        setSyncingTable(null)
      }
    } catch (error) {
      console.error(`Sync error for ${statusTableName}:`, error)
      alert(`Sync failed for ${statusTableName}`)
      setSyncingTable(null)
    }
  }

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
    return <div className="text-center py-4 text-muted-foreground">Loading sync status...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Sync Status</h3>
          <p className="text-sm text-muted-foreground">
            Last sync status for all XPM tables
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
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
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No sync history. Click &quot;Sync Now&quot; to start syncing data.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {statuses.map((status) => (
            <Card key={status.table_name}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status.last_sync_status)}
                    <CardTitle className="text-base">
                      {formatTableName(status.table_name)}
                    </CardTitle>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {status.last_sync_count} records
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="text-sm space-y-1 flex-1">
                    <div>
                      <span className="text-muted-foreground">Last sync: </span>
                      {status.last_sync_at
                        ? new Date(status.last_sync_at).toLocaleString()
                        : 'Never'}
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
                    className="ml-4"
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

