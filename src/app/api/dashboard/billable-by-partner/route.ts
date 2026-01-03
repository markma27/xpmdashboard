import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateLocal } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const asOfDateParam = searchParams.get('asOfDate')

    const supabase = await createClient()

    // Use provided date or default to today
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date()
    const currentMonth = asOfDate.getMonth() // 0-11
    const currentYear = asOfDate.getFullYear()
    
    let currentFYStartYear: number
    if (currentMonth >= 6) {
      currentFYStartYear = currentYear
    } else {
      currentFYStartYear = currentYear - 1
    }
    
    const currentFYEndYear = currentFYStartYear + 1
    const lastFYStartYear = currentFYStartYear - 1
    const lastFYEndYear = currentFYStartYear
    
    // Format dates as YYYY-MM-DD (using local timezone)
    // For "same time" comparison, use selected date for current year
    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = formatDateLocal(asOfDate) // Selected date
    
    // For last year "same time", calculate the same day last year
    // But ensure it doesn't exceed last year's financial year end (June 30)
    const lastYearSameDate = new Date(asOfDate)
    lastYearSameDate.setFullYear(lastYearSameDate.getFullYear() - 1)
    const lastYearEndDate = formatDateLocal(lastYearSameDate)
    const lastYearFYEnd = `${lastFYEndYear}-06-30`
    // Use the earlier of last year same date or last year FY end
    const lastYearEnd = lastYearEndDate <= lastYearFYEnd ? lastYearEndDate : lastYearFYEnd
    const lastYearStart = `${lastFYStartYear}-07-01`

    // Helper function to fetch all billable amount data for a date range
    const fetchBillableAmountData = async (startDate: string, endDate: string): Promise<any[]> => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('timesheet_uploads')
          .select('billable_amount, account_manager')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate)
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch billable data: ${pageError.message}`)
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
      fetchBillableAmountData(currentYearStart, currentYearEnd),
      fetchBillableAmountData(lastYearStart, lastYearEnd),
    ])

    // Aggregate by partner (account_manager)
    const partnerMap = new Map<string, { currentYear: number; lastYear: number }>()

    // Process current year data
    currentYearData.forEach((record) => {
      const partner = record.account_manager || 'Uncategorized'
      const amount = typeof record.billable_amount === 'number' 
        ? record.billable_amount 
        : parseFloat(record.billable_amount || '0') || 0
      
      if (!partnerMap.has(partner)) {
        partnerMap.set(partner, { currentYear: 0, lastYear: 0 })
      }
      
      const existing = partnerMap.get(partner)!
      existing.currentYear += amount
    })

    // Process last year data
    lastYearData.forEach((record) => {
      const partner = record.account_manager || 'Uncategorized'
      const amount = typeof record.billable_amount === 'number' 
        ? record.billable_amount 
        : parseFloat(record.billable_amount || '0') || 0
      
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
