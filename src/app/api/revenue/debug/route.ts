import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const clientGroup = searchParams.get('clientGroup') || 'JBS&G Group'

    const supabase = await createClient()

    // Test queries
    const lastYearStart = '2024-07-01'
    const lastYearEnd = '2025-06-30'

    // Query 1: Get all records for this client group in date range
    const { data: allRecords, error: allError } = await supabase
      .from('invoice_uploads')
      .select('id, client_group, date, amount, organization_id')
      .eq('organization_id', organizationId)
      .ilike('client_group', `%${clientGroup}%`)
      .order('date', { ascending: true })

    // Query 2: Get records in last year date range
    const { data: dateRangeRecords, error: dateError } = await supabase
      .from('invoice_uploads')
      .select('id, client_group, date, amount, organization_id')
      .eq('organization_id', organizationId)
      .gte('date', lastYearStart)
      .lte('date', lastYearEnd)
      .order('date', { ascending: true })

    // Query 3: Get records matching both client group AND date range
    const { data: combinedRecords, error: combinedError } = await supabase
      .from('invoice_uploads')
      .select('id, client_group, date, amount, organization_id')
      .eq('organization_id', organizationId)
      .ilike('client_group', `%${clientGroup}%`)
      .gte('date', lastYearStart)
      .lte('date', lastYearEnd)
      .order('date', { ascending: true })

    // Query 4: Get exact client group match
    const { data: exactMatch, error: exactError } = await supabase
      .from('invoice_uploads')
      .select('id, client_group, date, amount, organization_id')
      .eq('organization_id', organizationId)
      .eq('client_group', clientGroup)
      .gte('date', lastYearStart)
      .lte('date', lastYearEnd)
      .order('date', { ascending: true })

    // Calculate totals
    const calculateTotal = (records: any[]) => {
      return records?.reduce((sum, inv) => {
        const amt = typeof inv.amount === 'number' ? inv.amount : parseFloat(inv.amount || '0')
        return sum + amt
      }, 0) || 0
    }

    return NextResponse.json({
      organizationId,
      clientGroup,
      dateRange: {
        start: lastYearStart,
        end: lastYearEnd,
      },
      queries: {
        allRecords: {
          count: allRecords?.length || 0,
          total: calculateTotal(allRecords || []),
          error: allError?.message,
          sample: allRecords?.slice(0, 5),
        },
        dateRangeRecords: {
          count: dateRangeRecords?.length || 0,
          total: calculateTotal(dateRangeRecords || []),
          error: dateError?.message,
          sample: dateRangeRecords?.slice(0, 5),
        },
        combinedRecords: {
          count: combinedRecords?.length || 0,
          total: calculateTotal(combinedRecords || []),
          error: combinedError?.message,
          sample: combinedRecords?.slice(0, 10),
        },
        exactMatch: {
          count: exactMatch?.length || 0,
          total: calculateTotal(exactMatch || []),
          error: exactError?.message,
          sample: exactMatch?.slice(0, 10),
        },
      },
      uniqueClientGroups: {
        all: [...new Set(allRecords?.map((r: any) => r.client_group).filter(Boolean) || [])],
        inDateRange: [...new Set(dateRangeRecords?.map((r: any) => r.client_group).filter(Boolean) || [])],
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error', stack: error.stack },
      { status: 500 }
    )
  }
}

