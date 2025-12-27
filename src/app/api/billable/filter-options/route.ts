import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    // Fetch all unique values for filter options
    // Use pagination to ensure we get all records
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('timesheet_uploads')
        .select('client_group, account_manager, job_manager')
        .eq('organization_id', organizationId)
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (pageError) {
        throw new Error(`Failed to fetch filter options: ${pageError.message}`)
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
    const clientGroups = new Set<string>()
    const accountManagers = new Set<string>()
    const jobManagers = new Set<string>()

    allData.forEach((record) => {
      // Handle client_group
      if (record.client_group && typeof record.client_group === 'string' && record.client_group.trim()) {
        clientGroups.add(record.client_group.trim())
      }
      
      // Handle account_manager (Partner)
      // Check both account_manager field and ensure it's not null/empty
      const accountManagerValue = record.account_manager
      if (accountManagerValue !== null && accountManagerValue !== undefined) {
        const accountManagerStr = String(accountManagerValue).trim()
        if (accountManagerStr.length > 0) {
          accountManagers.add(accountManagerStr)
        }
      }
      
      // Handle job_manager (Client Manager)
      // Check both job_manager field and ensure it's not null/empty
      const jobManagerValue = record.job_manager
      if (jobManagerValue !== null && jobManagerValue !== undefined) {
        const jobManagerStr = String(jobManagerValue).trim()
        if (jobManagerStr.length > 0) {
          jobManagers.add(jobManagerStr)
        }
      }
    })

    return NextResponse.json({
      clientGroups: Array.from(clientGroups).sort(),
      accountManagers: Array.from(accountManagers).sort(),
      jobManagers: Array.from(jobManagers).sort(),
    }, {
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
