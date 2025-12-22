import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { exchangeCodeForTokens, encryptTokenSetForStorage } from '@/lib/xero/client'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Log all parameters for debugging
    console.log('Xero callback received:', {
      code: code ? 'present' : 'missing',
      state: state ? 'present' : 'missing',
      error,
      allParams: Object.fromEntries(searchParams.entries()),
    })

    if (error) {
      return NextResponse.redirect(
        new URL(`/settings/xero?error=${encodeURIComponent(error)}`, request.url)
      )
    }

    if (!code || !state) {
      console.error('Missing parameters:', { code: !!code, state: !!state, url: request.url })
      return NextResponse.redirect(
        new URL(`/settings/xero?error=missing_parameters&details=${encodeURIComponent(`code: ${code ? 'present' : 'missing'}, state: ${state ? 'present' : 'missing'}`)}`, request.url)
      )
    }

    // Decode state to get organizationId
    let stateData: { organizationId: string; userId: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'))
    } catch {
      return NextResponse.redirect(
        new URL('/settings/xero?error=invalid_state', request.url)
      )
    }

    // Verify user is admin (using service role to bypass RLS for verification)
    const serviceClient = createServiceRoleClient()
    const { data: member } = await serviceClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', stateData.organizationId)
      .eq('user_id', stateData.userId)
      .single()

    if (!member || member.role !== 'admin') {
      return NextResponse.redirect(
        new URL('/settings/xero?error=unauthorized', request.url)
      )
    }

    // Exchange code for tokens
    // apiCallback expects the full callback URL with all query parameters
    const callbackUrl = request.url
    const xeroClient = await exchangeCodeForTokens(callbackUrl, state)
    
    // Get tenant information
    // In xero-node v5, we need to call updateTenants() to get tenant list
    await xeroClient.updateTenants()
    const tenants = xeroClient.tenants || []
    
    if (tenants.length === 0) {
      return NextResponse.redirect(
        new URL('/settings/xero?error=no_tenants', request.url)
      )
    }

    // Get the token set (includes access token, refresh token, etc.)
    const tokenSet = xeroClient.readTokenSet()
    
    // Save connection for each tenant
    const supabase = await createClient()
    const encryptedTokenSet = encryptTokenSetForStorage(tokenSet)

    // Calculate expiration time (access tokens expire in 30 minutes, but refresh tokens last longer)
    // Xero access tokens expire in 30 minutes, refresh tokens can be used to get new access tokens
    const expiresAt = tokenSet.expires_at 
      ? new Date(tokenSet.expires_at * 1000)
      : new Date(Date.now() + 30 * 60 * 1000) // Default to 30 minutes if not specified

    for (const tenant of tenants) {

      // Upsert connection
      const { error: upsertError } = await supabase
        .from('xero_connections')
        .upsert(
          {
            organization_id: stateData.organizationId,
            tenant_id: tenant.tenantId,
            tenant_name: tenant.tenantName,
            token_set_enc: encryptedTokenSet,
            expires_at: expiresAt.toISOString(),
            is_active: true,
          },
          {
            onConflict: 'organization_id,tenant_id',
          }
        )

      if (upsertError) {
        console.error('Error saving connection:', upsertError)
      }
    }

    return NextResponse.redirect(
      new URL('/settings/xero?success=connected', request.url)
    )
  } catch (error: any) {
    console.error('Xero callback error:', error)
    return NextResponse.redirect(
      new URL(`/settings/xero?error=${encodeURIComponent(error.message)}`, request.url)
    )
  }
}

