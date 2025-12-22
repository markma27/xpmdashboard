import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    // Get connections for the organization
    const { data: connections, error } = await supabase
      .from('xero_connections')
      .select('id, tenant_id, tenant_name, expires_at, is_active, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch connections' },
        { status: 500 }
      )
    }

    // Check if tokens are expired
    const now = new Date()
    const connectionsWithStatus = (connections || []).map((conn) => ({
      ...conn,
      isExpired: new Date(conn.expires_at) < now,
    }))

    return NextResponse.json(connectionsWithStatus)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

