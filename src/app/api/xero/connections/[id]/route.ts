import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const org = await requireOrg()
    const connectionId = params.id

    const supabase = await createClient()

    // Verify user is admin and connection belongs to their organization
    const { data: connection, error: fetchError } = await supabase
      .from('xero_connections')
      .select('organization_id')
      .eq('id', connectionId)
      .single()

    if (fetchError || !connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    // Check if user is admin of the organization
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

    // Delete connection
    const { error: deleteError } = await supabase
      .from('xero_connections')
      .delete()
      .eq('id', connectionId)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

