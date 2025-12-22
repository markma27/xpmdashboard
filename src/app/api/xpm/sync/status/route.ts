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

    // Get sync metadata for the organization
    const { data: metadata, error } = await supabase
      .from('xpm_sync_metadata')
      .select('*')
      .eq('organization_id', organizationId)
      .order('last_sync_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch sync status' },
        { status: 500 }
      )
    }

    return NextResponse.json(metadata || [])
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

