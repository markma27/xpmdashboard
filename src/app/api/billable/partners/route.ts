import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logApiPerf } from '@/lib/api-perf'

type FilterOptsRow = {
  accountManagers?: unknown
}

function asSortedStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now()
  const routeName = 'GET /api/billable/partners'
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    const { data: raw, error } = await supabase.rpc('get_billable_filter_options', {
      p_organization_id: organizationId,
    })

    if (error) {
      throw new Error(`Failed to fetch partners: ${error.message}`)
    }

    const row = raw as FilterOptsRow | null
    const partnerList = asSortedStringArray(row?.accountManagers)

    logApiPerf(routeName, startedAt)
    return NextResponse.json(partnerList, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error: unknown) {
    logApiPerf(routeName, startedAt)
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
