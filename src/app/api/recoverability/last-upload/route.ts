import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    // Get the most recent upload date for this organization
    const { data, error } = await supabase
      .from('recoverability_timesheet_uploads')
      .select('uploaded_at')
      .eq('organization_id', organizationId)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned", which is fine
      throw new Error(`Failed to fetch last upload date: ${error.message}`)
    }

    return NextResponse.json({
      lastUploadDate: data?.uploaded_at || null,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

