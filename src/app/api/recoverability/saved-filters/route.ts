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

    // Get saved filters for this user and organization
    const { data, error } = await supabase
      .from('saved_filters')
      .select('filters')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .eq('page_type', 'recoverability')
      .single()

    if (error) {
      // If no saved filters found, return empty array
      if (error.code === 'PGRST116') {
        return NextResponse.json({ filters: [] })
      }
      throw new Error(`Failed to fetch saved filters: ${error.message}`)
    }

    return NextResponse.json({ filters: data?.filters || [] }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const body = await request.json()
    const { filters } = body

    if (!Array.isArray(filters)) {
      return NextResponse.json(
        { error: 'Filters must be an array' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Upsert saved filters (insert or update if exists)
    const { data, error } = await supabase
      .from('saved_filters')
      .upsert({
        organization_id: organizationId,
        user_id: user.id,
        page_type: 'recoverability',
        filters: filters,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id,user_id,page_type',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save filters: ${error.message}`)
    }

    return NextResponse.json({ success: true, filters: data.filters }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}
