import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getTodayLocal, formatDateLocal } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id
    const asOfDateParam = searchParams.get('asOfDate')
    
    // Parse filters from query params (same format as Billable page)
    const filtersParam = searchParams.get('filters')
    const filters: Array<{ type: string; value: string; operator?: string }> = []
    if (filtersParam) {
      try {
        const parsedFilters = JSON.parse(filtersParam)
        if (Array.isArray(parsedFilters)) {
          parsedFilters.forEach((filter: any) => {
            if (filter.type && filter.value) {
              filters.push({
                type: filter.type,
                value: typeof filter.value === 'string' ? decodeURIComponent(filter.value) : filter.value,
                operator: filter.operator,
              })
            }
          })
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    const supabase = await createClient()

    // Use provided date or default to today (using local timezone)
    // If asOfDateParam is already in YYYY-MM-DD format, use it directly to avoid timezone issues
    const today = getTodayLocal()
    const currentYearEnd = asOfDateParam && /^\d{4}-\d{2}-\d{2}$/.test(asOfDateParam) 
      ? asOfDateParam 
      : today
    
    // Parse the date to determine financial year (for month/year calculation)
    // Use local date parsing to avoid timezone issues
    const asOfDate = asOfDateParam ? new Date(asOfDateParam + 'T00:00:00') : new Date()
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
    const currentYearStart = `${currentFYStartYear}-07-01`
    
    // For last year "same time", calculate the same day last year
    // Directly manipulate the date string to avoid timezone issues
    const [year, month, day] = currentYearEnd.split('-').map(Number)
    const lastYearEndDate = `${year - 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const lastYearFYEnd = `${lastFYEndYear}-06-30`
    const lastYearEnd = lastYearEndDate <= lastYearFYEnd ? lastYearEndDate : lastYearFYEnd
    const lastYearStart = `${lastFYStartYear}-07-01`

    // Check if we have filters that need special handling
    const hasFilters = filters.length > 0

    let currentYearRevenue: number = 0
    let lastYearRevenue: number = 0
    let currentYearBillableAmount: number = 0
    let lastYearBillableAmount: number = 0
    let totalWIPAmount: number = 0

    // Try to use RPC function first (if database migration has been applied)
    if (!hasFilters) {
      const { data: kpiData, error: kpiError } = await supabase.rpc('get_dashboard_kpis', {
        p_organization_id: organizationId,
        p_current_year_start: currentYearStart,
        p_current_year_end: currentYearEnd,
        p_last_year_start: lastYearStart,
        p_last_year_end: lastYearEnd,
      })

      if (!kpiError && kpiData && kpiData.length > 0) {
        // Use the aggregated results from RPC
        currentYearRevenue = Number(kpiData[0].current_year_revenue) || 0
        lastYearRevenue = Number(kpiData[0].last_year_revenue) || 0
        currentYearBillableAmount = Number(kpiData[0].current_year_billable) || 0
        lastYearBillableAmount = Number(kpiData[0].last_year_billable) || 0
        totalWIPAmount = Number(kpiData[0].total_wip) || 0
      } else {
        // Fallback: Fetch data and aggregate in JS (works without migration)
        // Use pagination to fetch all data (same as billable page)
        const fetchAllData = async (table: string, selectFields: string, dateField: string, startDate: string, endDate: string | null = null, requireBillable: boolean = false) => {
          let allData: any[] = []
          let page = 0
          const pageSize = 1000
          let hasMore = true
          
          while (hasMore) {
            let query = supabase
              .from(table)
              .select(selectFields)
              .eq('organization_id', organizationId)
            
            // For timesheet_uploads, only include billable = true records
            if (requireBillable && table === 'timesheet_uploads') {
              query = query.eq('billable', true)
            }
            
            if (startDate && endDate) {
              query = query.gte(dateField, startDate).lte(dateField, endDate)
            }
            
            const { data: pageData, error: pageError } = await query
              .range(page * pageSize, (page + 1) * pageSize - 1)
            
            if (pageError) {
              throw new Error(`Failed to fetch ${table} data: ${pageError.message}`)
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

        const [
          currentRevenueData,
          lastRevenueData,
          currentBillableData,
          lastBillableData,
          wipData,
        ] = await Promise.all([
          fetchAllData('invoice_uploads', 'amount', 'date', currentYearStart, currentYearEnd, false),
          fetchAllData('invoice_uploads', 'amount', 'date', lastYearStart, lastYearEnd, false),
          fetchAllData('timesheet_uploads', 'billable_amount', 'date', currentYearStart, currentYearEnd, true),
          fetchAllData('timesheet_uploads', 'billable_amount', 'date', lastYearStart, lastYearEnd, true),
          fetchAllData('wip_timesheet_uploads', 'billable_amount', 'date', '', null, false),
        ])

        // Aggregate results in JS
        currentYearRevenue = (currentRevenueData || []).reduce((sum, row) => {
          const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0
          return sum + amount
        }, 0)

        lastYearRevenue = (lastRevenueData || []).reduce((sum, row) => {
          const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0
          return sum + amount
        }, 0)

        currentYearBillableAmount = (currentBillableData || []).reduce((sum, row) => {
          const amount = typeof row.billable_amount === 'number' ? row.billable_amount : parseFloat(row.billable_amount || '0') || 0
          return sum + amount
        }, 0)

        lastYearBillableAmount = (lastBillableData || []).reduce((sum, row) => {
          const amount = typeof row.billable_amount === 'number' ? row.billable_amount : parseFloat(row.billable_amount || '0') || 0
          return sum + amount
        }, 0)

        totalWIPAmount = (wipData || []).reduce((sum, row) => {
          const amount = typeof row.billable_amount === 'number' ? row.billable_amount : parseFloat(row.billable_amount || '0') || 0
          return sum + amount
        }, 0)
      }
    } else {
      // With filters, fetch filtered data and aggregate in JS
      // Use pagination to fetch all data (same as billable page)
      const fetchAllBillableData = async (startDate: string, endDate: string) => {
        let allData: any[] = []
        let page = 0
        const pageSize = 1000
        let hasMore = true
        
        while (hasMore) {
          let query = supabase
            .from('timesheet_uploads')
            .select('billable_amount')
            .eq('organization_id', organizationId)
            .eq('billable', true)
            .gte('date', startDate)
            .lte('date', endDate)
          
          filters.forEach((filter) => {
            if (filter.value && filter.value !== 'all') {
              switch (filter.type) {
                case 'staff':
                  query = query.eq('staff', filter.value)
                  break
                case 'client_group':
                  query = query.eq('client_group', filter.value)
                  break
                case 'account_manager':
                  query = query.eq('account_manager', filter.value)
                  break
                case 'job_manager':
                  query = query.eq('job_manager', filter.value)
                  break
                case 'job_name':
                  if (filter.operator === 'not_contains') {
                    query = query.or(`job_name.not.ilike.%${filter.value}%,job_name.is.null`)
                  } else {
                    query = query.ilike('job_name', `%${filter.value}%`)
                  }
                  break
              }
            }
          })
          
          const { data: pageData, error: pageError } = await query
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

      const fetchAllInvoiceData = async (startDate: string, endDate: string) => {
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
            throw new Error(`Failed to fetch invoice data: ${pageError.message}`)
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

      const fetchAllWipData = async () => {
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
        
        return allData
      }

      const [
        currentRevenueData,
        lastRevenueData,
        currentBillableData,
        lastBillableData,
        wipData,
      ] = await Promise.all([
        fetchAllInvoiceData(currentYearStart, currentYearEnd),
        fetchAllInvoiceData(lastYearStart, lastYearEnd),
        fetchAllBillableData(currentYearStart, currentYearEnd),
        fetchAllBillableData(lastYearStart, lastYearEnd),
        fetchAllWipData(),
      ])

      // Aggregate results in JS
      currentYearRevenue = (currentRevenueData || []).reduce((sum, row) => {
        const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0
        return sum + amount
      }, 0)

      lastYearRevenue = (lastRevenueData || []).reduce((sum, row) => {
        const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0
        return sum + amount
      }, 0)

      currentYearBillableAmount = (currentBillableData || []).reduce((sum, row) => {
        const amount = typeof row.billable_amount === 'number' ? row.billable_amount : parseFloat(row.billable_amount || '0') || 0
        return sum + amount
      }, 0)

      lastYearBillableAmount = (lastBillableData || []).reduce((sum, row) => {
        const amount = typeof row.billable_amount === 'number' ? row.billable_amount : parseFloat(row.billable_amount || '0') || 0
        return sum + amount
      }, 0)

      totalWIPAmount = (wipData || []).reduce((sum, row) => {
        const amount = typeof row.billable_amount === 'number' ? row.billable_amount : parseFloat(row.billable_amount || '0') || 0
        return sum + amount
      }, 0)
    }

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
        // Allow caching for 60 seconds, revalidate in background for up to 5 minutes
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
