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
    async function fetchRevenueData(startDate: string, endDate: string): Promise<number> {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('invoice_uploads')
          .select('amount')
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
      
      let totalAmount = 0
      allData.forEach((record) => {
        const amount = typeof record.amount === 'number' 
          ? record.amount 
          : parseFloat(record.amount || '0') || 0
        totalAmount += amount
      })
      
      return totalAmount
    }

    // Helper function to fetch all billable amount data for a date range
    async function fetchBillableAmountData(startDate: string, endDate: string): Promise<number> {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('timesheet_uploads')
          .select('billable_amount')
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
      
      let totalAmount = 0
      allData.forEach((record) => {
        const amount = typeof record.billable_amount === 'number' 
          ? record.billable_amount 
          : parseFloat(record.billable_amount || '0') || 0
        totalAmount += amount
      })
      
      return totalAmount
    }

    // Helper function to fetch total WIP amount
    async function fetchTotalWIPAmount(): Promise<number> {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from('wip_timesheet_uploads')
          .select('billable_amount')
          .eq('organization_id', organizationId)
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch WIP data: ${pageError.message}`)
        }
        
        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData)
          page++
          hasMore = pageData.length === pageSize
        } else {
          hasMore = false
        }
      }
      
      let totalAmount = 0
      allData.forEach((record) => {
        const amount = typeof record.billable_amount === 'number' 
          ? record.billable_amount 
          : parseFloat(record.billable_amount || '0') || 0
        totalAmount += amount
      })
      
      return totalAmount
    }

    // Fetch all data in parallel
    const [
      currentYearRevenue,
      lastYearRevenue,
      currentYearBillableAmount,
      lastYearBillableAmount,
      totalWIPAmount,
    ] = await Promise.all([
      fetchRevenueData(currentYearStart, currentYearEnd),
      fetchRevenueData(lastYearStart, lastYearEnd),
      fetchBillableAmountData(currentYearStart, currentYearEnd),
      fetchBillableAmountData(lastYearStart, lastYearEnd),
      fetchTotalWIPAmount(),
    ])

    // Calculate percentage changes
    const revenuePercentageChange = Math.abs(lastYearRevenue) > 0.01
      ? ((currentYearRevenue - lastYearRevenue) / Math.abs(lastYearRevenue)) * 100
      : (Math.abs(currentYearRevenue) > 0.01 ? (currentYearRevenue > 0 ? 100 : -100) : null)
    
    const billableAmountPercentageChange = Math.abs(lastYearBillableAmount) > 0.01
      ? ((currentYearBillableAmount - lastYearBillableAmount) / Math.abs(lastYearBillableAmount)) * 100
      : (Math.abs(currentYearBillableAmount) > 0.01 ? (currentYearBillableAmount > 0 ? 100 : -100) : null)

    return NextResponse.json({
      revenue: {
        currentYear: Math.round(currentYearRevenue * 100) / 100,
        lastYear: Math.round(lastYearRevenue * 100) / 100,
        percentageChange: revenuePercentageChange !== null ? Math.round(revenuePercentageChange * 10) / 10 : null,
      },
      billableAmount: {
        currentYear: Math.round(currentYearBillableAmount * 100) / 100,
        lastYear: Math.round(lastYearBillableAmount * 100) / 100,
        percentageChange: billableAmountPercentageChange !== null ? Math.round(billableAmountPercentageChange * 10) / 10 : null,
      },
      wipAmount: Math.round(totalWIPAmount * 100) / 100,
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
