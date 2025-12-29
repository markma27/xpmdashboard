import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    // Helper function to fetch all data with pagination
    const fetchAllData = async (selectFields: string[]): Promise<any[]> => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('recoverability_timesheet_uploads')
          .select(selectFields.join(','))
          .eq('organization_id', organizationId)
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch data: ${pageError.message}`)
        }
        
        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData)
          page++
          hasMore = pageData.length === pageSize
        } else {
          hasMore = false
        }
      }
      
      return allData
    }

    // Fetch all data
    const allData = await fetchAllData(['client_group', 'account_manager', 'job_manager'])

    // Extract unique values
    const clientGroups = new Set<string>()
    const accountManagers = new Set<string>()
    const jobManagers = new Set<string>()

    allData.forEach((record) => {
      if (record.client_group && typeof record.client_group === 'string') {
        const clientGroupStr = record.client_group.trim()
        if (clientGroupStr.length > 0) {
          clientGroups.add(clientGroupStr)
        }
      }
      if (record.account_manager && typeof record.account_manager === 'string') {
        const accountManagerStr = record.account_manager.trim()
        if (accountManagerStr.length > 0) {
          accountManagers.add(accountManagerStr)
        }
      }
      if (record.job_manager && typeof record.job_manager === 'string') {
        const jobManagerStr = record.job_manager.trim()
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
