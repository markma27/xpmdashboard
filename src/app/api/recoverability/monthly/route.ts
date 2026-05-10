import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { recoverabilityFiltersToRpcParams, type RecoverabilityFilter } from '@/lib/recoverability-rpc-params'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const filtersParam = searchParams.get('filters')

    const supabase = await createClient()

    let filters: RecoverabilityFilter[] = []
    if (filtersParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(filtersParam))
        if (Array.isArray(parsed)) {
          filters = parsed
            .filter((f: { type?: string; value?: unknown }) => f.type && f.value)
            .map((f: { type: string; value: string; operator?: string }) => ({
              type: f.type,
              value: f.value,
              operator: f.operator,
            }))
        }
      } catch {
        /* ignore */
      }
    }

    const p = recoverabilityFiltersToRpcParams(filters)

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

    const { data: raw, error } = await supabase.rpc('get_recoverability_monthly_write_on_summary', {
      p_organization_id: organizationId,
      p_current_year_start: currentYearStart,
      p_current_year_end: currentYearEnd,
      p_last_year_start: lastYearStart,
      p_last_year_end: lastYearEnd,
      p_staff: p.staff,
      p_client_group: p.clientGroup,
      p_account_manager: p.accountManager,
      p_job_manager: p.jobManager,
    })

    if (error) {
      throw new Error(`Failed to fetch recoverability monthly: ${error.message}`)
    }

    let formattedData: unknown = raw
    if (typeof raw === 'string') {
      try {
        formattedData = JSON.parse(raw)
      } catch {
        formattedData = []
      }
    }
    if (!Array.isArray(formattedData)) {
      formattedData = []
    }

    return NextResponse.json(formattedData, {
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
