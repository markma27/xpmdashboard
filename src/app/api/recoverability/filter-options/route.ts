import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

type Opts = {
  clientGroups?: unknown
  accountManagers?: unknown
  jobManagers?: unknown
}

function asSortedStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    const { data: raw, error } = await supabase.rpc('get_recoverability_filter_options', {
      p_organization_id: organizationId,
    })

    if (error) {
      throw new Error(`Failed to fetch filter options: ${error.message}`)
    }

    let row: Opts | null = null
    if (typeof raw === 'string') {
      try {
        row = JSON.parse(raw) as Opts
      } catch {
        row = null
      }
    } else if (raw && typeof raw === 'object') {
      row = raw as Opts
    }
    return NextResponse.json(
      {
        clientGroups: asSortedStringArray(row?.clientGroups),
        accountManagers: asSortedStringArray(row?.accountManagers),
        jobManagers: asSortedStringArray(row?.jobManagers),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
