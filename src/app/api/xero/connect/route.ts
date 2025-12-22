import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireOrg } from '@/lib/auth'
import { getAuthorizationUrl } from '@/lib/xero/client'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    // Verify user is admin of the organization
    const supabase = await createClient()
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (!member || member.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Generate state parameter (include organizationId for callback)
    const state = Buffer.from(JSON.stringify({ organizationId, userId: user.id })).toString('base64')

    // Validate Xero configuration
    if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET || !process.env.XERO_REDIRECT_URI) {
      return NextResponse.json(
        { 
          error: 'Xero credentials not configured. Please set XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_REDIRECT_URI in your .env.local file.' 
        },
        { status: 500 }
      )
    }

    // Get authorization URL
    const authUrl = await getAuthorizationUrl(state)

    return NextResponse.json({ authUrl, state })
  } catch (error: any) {
    console.error('Xero connect error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to initiate Xero connection' },
      { status: 500 }
    )
  }
}

