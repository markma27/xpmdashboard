import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    // Get the latest uploaded_at from invoice_uploads
    const { data, error } = await supabase
      .from('invoice_uploads')
      .select('uploaded_at')
      .eq('organization_id', organizationId)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" - that's okay
      return NextResponse.json(
        { error: 'Failed to fetch last upload date', details: error.message },
        { status: 500 }
      )
    }

    const lastUploadDate = data?.uploaded_at || null

    return NextResponse.json(
      { lastUploadDate },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

