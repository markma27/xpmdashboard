import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    // Calculate financial year based on current date
    const now = new Date()
    const currentMonth = now.getMonth() // 0-11
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
    
    // Format dates as YYYY-MM-DD
    // For "same time" comparison, use today's date for current year
    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = now.toISOString().split('T')[0] // Today's date
    
    // For last year "same time", calculate the same day last year
    // But ensure it doesn't exceed last year's financial year end (June 30)
    const lastYearSameDate = new Date(now)
    lastYearSameDate.setFullYear(lastYearSameDate.getFullYear() - 1)
    const lastYearEndDate = lastYearSameDate.toISOString().split('T')[0]
    const lastYearFYEnd = `${lastFYEndYear}-06-30`
    // Use the earlier of last year same date or last year FY end
    const lastYearEnd = lastYearEndDate <= lastYearFYEnd ? lastYearEndDate : lastYearFYEnd
    const lastYearStart = `${lastFYStartYear}-07-01`

    // Helper function to fetch all revenue data for a date range
    async function fetchRevenueData(startDate: string, endDate: string): Promise<any[]> {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('invoice_uploads')
          .select('amount, account_manager')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate)
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch revenue data: ${pageError.message}`)
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

    // Fetch current year and last year data in parallel
    const [currentYearData, lastYearData] = await Promise.all([
      fetchRevenueData(currentYearStart, currentYearEnd),
      fetchRevenueData(lastYearStart, lastYearEnd),
    ])

    // Aggregate by partner (account_manager)
    const partnerMap = new Map<string, { currentYear: number; lastYear: number }>()

    // Process current year data
    currentYearData.forEach((record) => {
      const partner = record.account_manager || 'Uncategorized'
      const amount = typeof record.amount === 'number' 
        ? record.amount 
        : parseFloat(record.amount || '0') || 0
      
      if (!partnerMap.has(partner)) {
        partnerMap.set(partner, { currentYear: 0, lastYear: 0 })
      }
      
      const existing = partnerMap.get(partner)!
      existing.currentYear += amount
    })

    // Process last year data
    lastYearData.forEach((record) => {
      const partner = record.account_manager || 'Uncategorized'
      const amount = typeof record.amount === 'number' 
        ? record.amount 
        : parseFloat(record.amount || '0') || 0
      
      if (!partnerMap.has(partner)) {
        partnerMap.set(partner, { currentYear: 0, lastYear: 0 })
      }
      
      const existing = partnerMap.get(partner)!
      existing.lastYear += amount
    })

    // Convert to array and sort by current year amount (descending)
    const result = Array.from(partnerMap.entries())
      .map(([partner, data]) => ({
        partner,
        'Current Year': Math.round(data.currentYear * 100) / 100,
        'Last Year': Math.round(data.lastYear * 100) / 100,
      }))
      .sort((a, b) => b['Current Year'] - a['Current Year'])

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
