import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { name, slug } = await request.json()

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Organization name and slug are required' },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS for organization creation
    // This is necessary because the user doesn't have a member record yet
    const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
    const serviceClient = createServiceRoleClient()

    // Check if slug already exists
    const { data: existing } = await serviceClient
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'This organization slug is already taken' },
        { status: 400 }
      )
    }

    // Create organization using service role (bypasses RLS)
    const { data: org, error: orgError } = await serviceClient
      .from('organizations')
      .insert({ name, slug })
      .select()
      .single()

    if (orgError || !org) {
      console.error('Organization creation error:', orgError)
      return NextResponse.json(
        { error: `Failed to create organization: ${orgError?.message || 'Unknown error'}. Make sure database migrations are run.` },
        { status: 500 }
      )
    }

    // Add user as admin using service role
    const { error: memberError } = await serviceClient
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'admin',
      })

    if (memberError) {
      console.error('Member creation error:', memberError)
      // Rollback organization creation
      await serviceClient.from('organizations').delete().eq('id', org.id)
      return NextResponse.json(
        { error: `Failed to add member: ${memberError.message}. Make sure database migrations are run.` },
        { status: 500 }
      )
    }

    return NextResponse.json(org)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('organization_members')
      .select(
        `
        organization_id,
        role,
        organizations (
          id,
          name,
          slug
        )
      `
      )
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch organizations' },
        { status: 500 }
      )
    }

    const organizations = data?.map((member: any) => ({
      id: member.organizations.id,
      name: member.organizations.name,
      slug: member.organizations.slug,
      role: member.role,
    })) || []

    return NextResponse.json(organizations)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

