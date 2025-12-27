import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    // Fetch all unique account_manager values
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('timesheet_uploads')
        .select('account_manager')
        .eq('organization_id', organizationId)
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (pageError) {
        throw new Error(`Failed to fetch partners: ${pageError.message}`)
      }
      
      if (pageData && pageData.length > 0) {
        allData = allData.concat(pageData)
        page++
        hasMore = pageData.length === pageSize
      } else {
        hasMore = false
      }
    }

    // Extract unique values
    const partners = new Set<string>()
    allData.forEach((record) => {
      const accountManagerValue = record.account_manager
      if (accountManagerValue !== null && accountManagerValue !== undefined) {
        const accountManagerStr = String(accountManagerValue).trim()
        if (accountManagerStr.length > 0) {
          partners.add(accountManagerStr)
        }
      }
    })

    const partnerList = Array.from(partners).sort()

    return NextResponse.json(partnerList, {
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
