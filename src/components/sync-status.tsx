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
        alert('Sync failed')
        setSyncing(false)
      }
    } catch (error) {
      console.error('Sync error:', error)
      alert('Sync failed')
      setSyncing(false)
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
            No sync history. Click "Sync Now" to start syncing data.
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
                    <CardTitle className="text-base capitalize">
                      {status.table_name.replace('xpm_', '').replace(/_/g, ' ')}
                    </CardTitle>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {status.last_sync_count} records
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

