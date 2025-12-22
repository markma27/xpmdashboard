import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const organizationId = params.id
    const supabase = await createClient()

    // Verify user belongs to the organization
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json(
        { error: 'Not a member of this organization' },
        { status: 403 }
      )
    }

    // Get all members
    const { data: members, error } = await supabase
      .from('organization_members')
      .select(
        `
        id,
        role,
        created_at,
        users (
          id,
          email
        )
      `
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      )
    }

    return NextResponse.json(members || [])
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const organizationId = params.id
    const { email, role = 'viewer' } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify user is admin
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

    // Find user by email
    const serviceClient = createServiceRoleClient()
    const { data: targetUser, error: userError } = await serviceClient.auth.admin.listUsers()

    if (userError) {
      return NextResponse.json(
        { error: 'Failed to find user' },
        { status: 500 }
      )
    }

    const userToInvite = targetUser.users.find((u: any) => u.email === email)

    if (!userToInvite) {
      // User doesn't exist - in a real app, you'd send an invitation email
      // For now, return an error
      return NextResponse.json(
        { error: 'User not found. They need to sign up first.' },
        { status: 404 }
      )
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userToInvite.id)
      .single()

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member' },
        { status: 400 }
      )
    }

    // Add member
    const { data: newMember, error: insertError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: userToInvite.id,
        role: role,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to add member' },
        { status: 500 }
      )
    }

    return NextResponse.json(newMember)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

