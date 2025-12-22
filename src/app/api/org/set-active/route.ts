import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, loadUserOrganizations } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { orgId } = await request.json()

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Verify user belongs to this org
    const organizations = await loadUserOrganizations()
    const org = organizations.find((o) => o.id === orgId)

    if (!org) {
      return NextResponse.json(
        { error: 'You are not a member of this organization' },
        { status: 403 }
      )
    }

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set('active_org_id', orgId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: false,
      sameSite: 'lax',
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

