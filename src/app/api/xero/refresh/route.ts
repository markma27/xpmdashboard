import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireOrg } from '@/lib/auth'
import { refreshAccessToken, encryptTokenSetForStorage } from '@/lib/xero/client'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const org = await requireOrg()
    const { connectionId } = await request.json()

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get connection
    const { data: connection, error: fetchError } = await supabase
      .from('xero_connections')
      .select('id, organization_id, token_set_enc')
      .eq('id', connectionId)
      .single()

    if (fetchError || !connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    // Verify user is admin
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', connection.organization_id)
      .eq('user_id', user.id)
      .single()

    if (!member || member.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Refresh token
    // This gets a new access token (expires in 30 min) using the refresh token
    const newTokenSet = await refreshAccessToken(connection.token_set_enc)
    const encryptedTokenSet = encryptTokenSetForStorage(newTokenSet)
    
    // Calculate new expiration time
    // Access tokens expire in 30 minutes, refresh tokens last ~60 days
    const expiresAt = newTokenSet.expires_at 
      ? new Date(newTokenSet.expires_at * 1000)
      : new Date(Date.now() + 30 * 60 * 1000) // Default to 30 minutes

    // Update connection with new tokens
    const { error: updateError } = await supabase
      .from('xero_connections')
      .update({
        token_set_enc: encryptedTokenSet,
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', connectionId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to refresh token' },
      { status: 500 }
    )
  }
}

