import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const filtersParam = searchParams.get('filters') // JSON string of filters array
    const asOfDateParam = searchParams.get('asOfDate')

    const supabase = await createClient()

    // Parse filters
    let filters: any[] = []
    if (filtersParam) {
      try {
        filters = JSON.parse(decodeURIComponent(filtersParam))
      } catch (e) {
        // Invalid JSON, ignore filters
      }
    }

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
    
    // Format dates as YYYY-MM-DD
    // For "same time" comparison, use selected date for current year
    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = asOfDate.toISOString().split('T')[0] // Selected date
    
    // For last year "same time", calculate the same day last year
    // But ensure it doesn't exceed last year's financial year end (June 30)
    const lastYearSameDate = new Date(asOfDate)
    lastYearSameDate.setFullYear(lastYearSameDate.getFullYear() - 1)
    const lastYearEndDate = lastYearSameDate.toISOString().split('T')[0]
    const lastYearFYEnd = `${lastFYEndYear}-06-30`
    // Use the earlier of last year same date or last year FY end
    const lastYearEnd = lastYearEndDate <= lastYearFYEnd ? lastYearEndDate : lastYearFYEnd
    const lastYearStart = `${lastFYStartYear}-07-01`

    // Helper function to fetch all recoverability data for a date range
    const fetchRecoverabilityData = async (startDate: string, endDate: string): Promise<{ amount: number, writeOnAmount: number, invoicedAmount: number }> => {
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        let query = supabase
          .from('recoverability_timesheet_uploads')
          .select('write_on_amount, invoiced_amount, account_manager, job_manager, client_group, staff')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate)
        
        // Apply filters (note: job_name filter is not supported for recoverability)
        filters.forEach((filter) => {
          if (filter.type === 'account_manager' && filter.value && filter.value !== 'all') {
            query = query.eq('account_manager', filter.value)
          } else if (filter.type === 'job_manager' && filter.value && filter.value !== 'all') {
            query = query.eq('job_manager', filter.value)
          } else if (filter.type === 'client_group' && filter.value) {
            query = query.eq('client_group', filter.value)
          } else if (filter.type === 'staff' && filter.value && filter.value !== 'all') {
            query = query.eq('staff', filter.value)
          }
          // job_name filter is ignored for recoverability (not available in this table)
        })
        
        const { data: pageData, error: pageError } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          throw new Error(`Failed to fetch recoverability data: ${pageError.message}`)
        }
        
        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData)
          page++
          hasMore = pageData.length === pageSize
        } else {
          hasMore = false
        }
      }
      
      let totalWriteOnAmount = 0
      let totalInvoicedAmount = 0
      
      allData.forEach((record) => {
        totalWriteOnAmount += Number(record.write_on_amount || 0)
        totalInvoicedAmount += Number(record.invoiced_amount || 0)
      })
      
      return {
        amount: totalWriteOnAmount,
        writeOnAmount: totalWriteOnAmount,
        invoicedAmount: totalInvoicedAmount,
      }
    };

    // Fetch current year and last year data in parallel
    const [currentYearData, lastYearData] = await Promise.all([
      fetchRecoverabilityData(currentYearStart, currentYearEnd),
      fetchRecoverabilityData(lastYearStart, lastYearEnd),
    ])

    // Calculate percentage change for Recoverability $
    // Handle both positive and negative values using absolute value for denominator
    let percentageChange: number | null = null
    if (Math.abs(lastYearData.amount) > 0.01) { // Use small threshold to avoid division by zero
      percentageChange = ((currentYearData.amount - lastYearData.amount) / Math.abs(lastYearData.amount)) * 100
    } else if (Math.abs(currentYearData.amount) > 0.01) {
      // If last year is effectively 0 but current year has value, show significant change
      percentageChange = currentYearData.amount > 0 ? 100 : -100
    }

    // Calculate Recoverability % = (1 + write_on_amount / (invoiced_amount - write_on_amount)) * 100
    const currentYearDenominator = currentYearData.invoicedAmount - currentYearData.writeOnAmount
    const currentYearPercentage = currentYearDenominator > 0
      ? (1 + (currentYearData.writeOnAmount / currentYearDenominator)) * 100
      : 0
    
    const lastYearDenominator = lastYearData.invoicedAmount - lastYearData.writeOnAmount
    const lastYearPercentage = lastYearDenominator > 0
      ? (1 + (lastYearData.writeOnAmount / lastYearDenominator)) * 100
      : 0

    return NextResponse.json({
      currentYearAmount: Math.round(currentYearData.amount * 100) / 100,
      lastYearAmount: Math.round(lastYearData.amount * 100) / 100,
      percentageChange: percentageChange !== null ? Math.round(percentageChange * 10) / 10 : null,
      currentYearPercentage: Math.round(currentYearPercentage * 10) / 10,
      lastYearPercentage: Math.round(lastYearPercentage * 10) / 10,
      targetPercentage: 95.0,
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
