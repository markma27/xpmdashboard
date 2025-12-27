import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    // Fetch all unique job_manager values
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('timesheet_uploads')
        .select('job_manager')
        .eq('organization_id', organizationId)
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (pageError) {
        throw new Error(`Failed to fetch client managers: ${pageError.message}`)
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
    const clientManagers = new Set<string>()
    allData.forEach((record) => {
      const jobManagerValue = record.job_manager
      if (jobManagerValue !== null && jobManagerValue !== undefined) {
        const jobManagerStr = String(jobManagerValue).trim()
        if (jobManagerStr.length > 0) {
          clientManagers.add(jobManagerStr)
        }
      }
    })

    const clientManagerList = Array.from(clientManagers).sort()

    return NextResponse.json(clientManagerList, {
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
