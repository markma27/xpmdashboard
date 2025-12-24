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

    // Filter out removed tables: costs, categories, tasks, timeentries, jobs
    // Check both short names (e.g., "costs") and full table names (e.g., "xpm_costs")
    const excludedTables = [
      'costs', 'categories', 'tasks', 'timeentries', 'jobs',
      'xpm_costs', 'xpm_categories', 'xpm_tasks', 'xpm_time_entries', 'xpm_jobs'
    ]
    const filteredMetadata = (metadata || []).filter(
      (item: any) => !excludedTables.includes(item.table_name)
    )

    return NextResponse.json(filteredMetadata)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

