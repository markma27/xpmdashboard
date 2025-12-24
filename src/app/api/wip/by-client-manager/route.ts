import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const partnerFilter = searchParams.get('partner')
    const clientManagerFilter = searchParams.get('clientManager')

    const supabase = await createClient()

    // Fetch all WIP data - get all records using pagination
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    while (hasMore) {
      let query = supabase
        .from('wip_timesheet_uploads')
        .select('job_manager, billable_amount')
        .eq('organization_id', organizationId)
      
      // Apply filters if provided
      if (partnerFilter) {
        query = query.eq('account_manager', partnerFilter)
      }
      if (clientManagerFilter) {
        query = query.eq('job_manager', clientManagerFilter)
      }
      
      const { data: pageData, error: pageError } = await query
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (pageError) {
        return NextResponse.json(
          { error: 'Failed to fetch WIP data', details: pageError.message },
          { status: 500 }
        )
      }
      
      if (pageData && pageData.length > 0) {
        allData = allData.concat(pageData)
        page++
        hasMore = pageData.length === pageSize
      } else {
        hasMore = false
      }
    }

    // Aggregate by client manager (job_manager)
    const managerMap = new Map<string, number>()

    allData.forEach((record) => {
      const manager = record.job_manager || 'Uncategorized'
      let amount = 0
      if (typeof record.billable_amount === 'number') {
        amount = record.billable_amount
      } else if (typeof record.billable_amount === 'string') {
        amount = parseFloat(record.billable_amount) || 0
      }
      
      const currentAmount = managerMap.get(manager) || 0
      managerMap.set(manager, currentAmount + amount)
    })

    // Convert to array and sort by amount (descending)
    const result = Array.from(managerMap.entries())
      .map(([clientManager, amount]) => ({
        clientManager,
        amount: Math.round(amount),
      }))
      .sort((a, b) => b.amount - a.amount)

    return NextResponse.json(result, {
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

