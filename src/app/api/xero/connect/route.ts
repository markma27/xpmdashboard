import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireOrg } from '@/lib/auth'
import { getAuthorizationUrl } from '@/lib/xero/client'
import { createClient } from '@/lib/supabase/server'
import { assertSafeXeroOAuthRedirect } from '@/lib/xero/oauth-url'

function settingsXeroRedirect(request: NextRequest, params: Record<string, string>) {
  const u = new URL('/settings/xero', request.url)
  for (const [key, value] of Object.entries(params)) {
    u.searchParams.set(key, value)
  }
  return NextResponse.redirect(u)
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const wantsRedirect = searchParams.get('redirect') === '1'

  try {
    const user = await requireAuth()
    const org = await requireOrg()
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
      if (wantsRedirect) {
        return settingsXeroRedirect(request, { error: 'Admin access required' })
      }
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Generate state parameter (include organizationId for callback)
    const state = Buffer.from(JSON.stringify({ organizationId, userId: user.id })).toString('base64')

    // Validate Xero configuration
    if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET || !process.env.XERO_REDIRECT_URI) {
      const msg =
        'Xero credentials not configured. Please set XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_REDIRECT_URI in your .env.local file.'
      if (wantsRedirect) {
        return settingsXeroRedirect(request, { error: msg })
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const rawAuthUrl = await getAuthorizationUrl(state)
    const authUrl = assertSafeXeroOAuthRedirect(rawAuthUrl)

    if (wantsRedirect) {
      return NextResponse.redirect(authUrl)
    }

    return NextResponse.json({ authUrl, state })
  } catch (error: unknown) {
    console.error('Xero connect error:', error)
    const message = error instanceof Error ? error.message : 'Failed to initiate Xero connection'
    if (wantsRedirect) {
      return settingsXeroRedirect(request, { error: message })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

