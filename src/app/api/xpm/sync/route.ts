import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireOrg } from '@/lib/auth'
import { isAdmin } from '@/lib/rbac'
import { createClient } from '@/lib/supabase/server'
import { syncXPMData } from '@/lib/xpm/sync'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const org = await requireOrg()

    if (!isAdmin(org)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const table = searchParams.get('table') // Optional: sync specific table

    const supabase = await createClient()

    // Get active Xero connections for the organization
    const { data: connections, error: connError } = await supabase
      .from('xero_connections')
      .select('id, tenant_id, token_set_enc')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    if (connError || !connections || connections.length === 0) {
      return NextResponse.json(
        { error: 'No active Xero connections found' },
        { status: 400 }
      )
    }

    // Sync data for each connection
    const allResults = []

    for (const connection of connections) {
      try {
        const results = await syncXPMData(
          organizationId,
          connection.tenant_id,
          connection.token_set_enc,
          table || undefined,
          connection.id // Pass connection ID to save refreshed token
        )
        allResults.push(...results)
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error'
        
        // If refresh token expired, mark connection as inactive
        if (errorMessage.includes('REFRESH_TOKEN_EXPIRED') || errorMessage.includes('invalid_grant')) {
          console.warn(`Connection ${connection.id} refresh token expired. Marking as inactive.`)
          await supabase
            .from('xero_connections')
            .update({ is_active: false })
            .eq('id', connection.id)
          
          allResults.push({
            tenantId: connection.tenant_id,
            error: 'Xero connection expired. Please reconnect to Xero.',
            requiresReconnect: true,
          })
        } else {
          allResults.push({
            tenantId: connection.tenant_id,
            error: errorMessage,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      results: allResults,
    })
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    )
  }
}

