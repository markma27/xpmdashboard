import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string')
}

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    let currentFYStartYear: number
    if (currentMonth >= 6) {
      currentFYStartYear = currentYear
    } else {
      currentFYStartYear = currentYear - 1
    }

    const currentFYEndYear = currentFYStartYear + 1
    const lastFYStartYear = currentFYStartYear - 1
    const lastFYEndYear = currentFYStartYear

    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = `${currentFYEndYear}-06-30`
    const lastYearStart = `${lastFYStartYear}-07-01`
    const lastYearEnd = `${lastFYEndYear}-06-30`

    const { data: raw, error } = await supabase.rpc('get_productivity_eligible_staff', {
      p_organization_id: organizationId,
      p_current_year_start: currentYearStart,
      p_current_year_end: currentYearEnd,
      p_last_year_start: lastYearStart,
      p_last_year_end: lastYearEnd,
    })

    if (error) {
      throw new Error(`Failed to fetch productivity staff: ${error.message}`)
    }

    let list: unknown = raw
    if (typeof raw === 'string') {
      try {
        list = JSON.parse(raw)
      } catch {
        list = []
      }
    }

    const staffList = asStringArray(list)

    return NextResponse.json(staffList, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
