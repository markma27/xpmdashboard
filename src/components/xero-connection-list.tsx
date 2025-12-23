'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, RefreshCw, Trash2, ExternalLink } from 'lucide-react'

interface XeroConnection {
  id: string
  tenant_id: string
  tenant_name: string | null
  expires_at: string
  is_active: boolean
  isExpired: boolean
  created_at: string
}

interface XeroConnectionListProps {
  organizationId: string
}

export function XeroConnectionList({ organizationId }: XeroConnectionListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connections, setConnections] = useState<XeroConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const success = searchParams.get('success')
  const error = searchParams.get('error')

  useEffect(() => {
    loadConnections()
  }, [organizationId])

  const loadConnections = async () => {
    try {
      const response = await fetch(`/api/xero/connections?organizationId=${organizationId}`)
      if (response.ok) {
        const data = await response.json()
        setConnections(data)
      }
    } catch (error) {
      console.error('Failed to load connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const response = await fetch(`/api/xero/connect?organizationId=${organizationId}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate connection')
      }
      
      if (data.authUrl) {
        // Redirect to Xero authorization
        window.location.href = data.authUrl
      } else {
        throw new Error('No authorization URL received')
      }
    } catch (error: any) {
      console.error('Connection error:', error)
      alert(error.message || 'Failed to connect to Xero. Please check your Xero configuration in .env.local')
      setConnecting(false)
    }
  }

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this Xero connection?')) {
      return
    }

    try {
      const response = await fetch(`/api/xero/connections/${connectionId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadConnections()
      } else {
        alert('Failed to disconnect')
      }
    } catch (error) {
      console.error('Disconnect error:', error)
      alert('Failed to disconnect')
    }
  }

  const handleRefresh = async (connectionId: string) => {
    try {
      const response = await fetch('/api/xero/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })

      if (response.ok) {
        loadConnections()
      } else {
        alert('Failed to refresh token')
      }
    } catch (error) {
      console.error('Refresh error:', error)
      alert('Failed to refresh token')
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading connections...</div>
  }

  return (
    <div className="space-y-4">
      {success === 'connected' && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4 text-green-800">
          Successfully connected to Xero!
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-800">
          Error: {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Active Connections</h3>
          <p className="text-sm text-muted-foreground">
            {connections.length} connection{connections.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Button onClick={handleConnect} disabled={connecting}>
          {connecting ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <ExternalLink className="mr-2 h-4 w-4" />
              Connect Xero
            </>
          )}
        </Button>
      </div>

      {connections.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            No Xero connections configured. Click &quot;Connect Xero&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((connection) => (
            <Card key={connection.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {connection.tenant_name || 'Xero Organization'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Tenant ID: {connection.tenant_id}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {connection.isExpired ? (
                      <span className="flex items-center gap-1 text-sm text-orange-600">
                        <XCircle className="h-4 w-4" />
                        Expired
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Expires: {new Date(connection.expires_at).toLocaleDateString()}
                    <br />
                    Connected: {new Date(connection.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    {connection.isExpired && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefresh(connection.id)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(connection.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

