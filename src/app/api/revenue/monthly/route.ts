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

    // Calculate financial year dates
    const now = new Date()
    const currentMonth = now.getMonth()
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
    
    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = `${currentFYEndYear}-06-30`
    const lastYearStart = `${lastFYStartYear}-07-01`
    const lastYearEnd = `${lastFYEndYear}-06-30`

    // Try to use RPC function first for better performance
    const { data: currentYearRpcData, error: currentRpcError } = await supabase.rpc(
      'get_monthly_revenue',
      {
        p_organization_id: organizationId,
        p_start_date: currentYearStart,
        p_end_date: currentYearEnd,
        p_partner: partnerFilter || null,
        p_client_manager: clientManagerFilter || null,
      }
    )

    const { data: lastYearRpcData, error: lastRpcError } = await supabase.rpc(
      'get_monthly_revenue',
      {
        p_organization_id: organizationId,
        p_start_date: lastYearStart,
        p_end_date: lastYearEnd,
        p_partner: partnerFilter || null,
        p_client_manager: clientManagerFilter || null,
      }
    )

    // Initialize months array (July to June)
    const months = [
      'July', 'August', 'September', 'October', 'November', 'December',
      'January', 'February', 'March', 'April', 'May', 'June'
    ]

    // Initialize data structure
    const monthlyData = months.map((month) => ({
      month,
      currentYear: 0,
      lastYear: 0,
    }))

    // Helper to get month index from YYYY-MM
    const getMonthIndex = (monthYear: string, fyStartYear: number) => {
      const [year, monthStr] = monthYear.split('-')
      const month = parseInt(monthStr) - 1 // 0-11
      return month >= 6 ? month - 6 : month + 6
    }

    // Check if RPC succeeded, otherwise fall back to regular queries
    if (!currentRpcError && currentYearRpcData && !lastRpcError && lastYearRpcData) {
      // Use RPC data
      currentYearRpcData.forEach((row: { month_year: string; total_amount: number }) => {
        const monthIndex = getMonthIndex(row.month_year, currentFYStartYear)
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyData[monthIndex].currentYear = Number(row.total_amount) || 0
        }
      })

      lastYearRpcData.forEach((row: { month_year: string; total_amount: number }) => {
        const monthIndex = getMonthIndex(row.month_year, lastFYStartYear)
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyData[monthIndex].lastYear = Number(row.total_amount) || 0
        }
      })
    } else {
      // Fallback: Use optimized query with grouping
      const buildQuery = (startDate: string, endDate: string) => {
        let query = supabase
          .from('invoice_uploads')
          .select('date, amount')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate)

        if (partnerFilter) {
          query = query.eq('account_manager', partnerFilter)
        }
        if (clientManagerFilter) {
          query = query.eq('job_manager', clientManagerFilter)
        }

        return query
      }

      const [currentYearResult, lastYearResult] = await Promise.all([
        buildQuery(currentYearStart, currentYearEnd),
        buildQuery(lastYearStart, lastYearEnd),
      ])

      // Aggregate current year data
      if (currentYearResult.data) {
        currentYearResult.data.forEach((invoice) => {
          const date = new Date(invoice.date + 'T00:00:00')
          const month = date.getMonth()
          const year = date.getFullYear()

          if (!((year === currentFYStartYear && month >= 6) || (year === currentFYEndYear && month < 6))) {
            return
          }

          const monthIndex = month >= 6 ? month - 6 : month + 6
          const amount = typeof invoice.amount === 'number' 
            ? invoice.amount 
            : parseFloat(invoice.amount || '0') || 0
          monthlyData[monthIndex].currentYear += amount
        })
      }

      // Aggregate last year data
      if (lastYearResult.data) {
        lastYearResult.data.forEach((invoice) => {
          const date = new Date(invoice.date + 'T00:00:00')
          const month = date.getMonth()
          const year = date.getFullYear()

          if (!((year === lastFYStartYear && month >= 6) || (year === lastFYEndYear && month < 6))) {
            return
          }

          const monthIndex = month >= 6 ? month - 6 : month + 6
          const amount = typeof invoice.amount === 'number' 
            ? invoice.amount 
            : parseFloat(invoice.amount || '0') || 0
          monthlyData[monthIndex].lastYear += amount
        })
      }
    }

    const formattedData = monthlyData.map((item) => ({
      month: item.month,
      'Current Year': item.currentYear,
      'Last Year': item.lastYear,
    }))

    return NextResponse.json(formattedData, {
      headers: {
        // Cache for 60 seconds, allow stale data for up to 5 minutes while revalidating
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}
