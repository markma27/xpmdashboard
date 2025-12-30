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

    // Fetch all WIP data - get all records using pagination
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    while (hasMore) {
      let query = supabase
        .from('wip_timesheet_uploads')
        .select('billable_amount, date')
        .eq('organization_id', organizationId)
      
      // Apply filters if provided
      if (partnerFilter) {
        query = query.eq('account_manager', partnerFilter)
      }
      if (clientManagerFilter) {
        query = query.eq('job_manager', clientManagerFilter)
      }
      
      const { data: pageData, error: pageError } = await query
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (pageError) {
        return NextResponse.json(
          { error: 'Failed to fetch WIP data', details: pageError.message },
          { status: 500 }
        )
      }
      
      if (pageData && pageData.length > 0) {
        allData = allData.concat(pageData)
        page++
        hasMore = pageData.length === pageSize
      } else {
        hasMore = false
      }
    }

    // Initialize aging buckets
    const aging = {
      lessThan30: 0,
      days30to60: 0,
      days60to90: 0,
      days90to120: 0,
      days120Plus: 0,
    }

    // Get today's date for age calculation (use UTC to be consistent with stored dates)
    const now = new Date()
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

    // Process data and calculate aging
    allData.forEach((record) => {
      let amount = 0
      if (typeof record.billable_amount === 'number') {
        amount = record.billable_amount
      } else if (typeof record.billable_amount === 'string') {
        amount = parseFloat(record.billable_amount) || 0
      }

      if (record.date) {
        try {
          let recordDateUTC: number | null = null
          
          if (typeof record.date === 'string') {
            const dateParts = record.date.split('-')
            if (dateParts.length === 3) {
              const year = parseInt(dateParts[0], 10)
              const month = parseInt(dateParts[1], 10) - 1
              const day = parseInt(dateParts[2], 10)
              if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                recordDateUTC = Date.UTC(year, month, day)
              }
            } else {
              const d = new Date(record.date)
              if (!isNaN(d.getTime())) {
                recordDateUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
              }
            }
          } else if (record.date instanceof Date) {
            recordDateUTC = Date.UTC(record.date.getUTCFullYear(), record.date.getUTCMonth(), record.date.getUTCDate())
          }
          
          if (recordDateUTC !== null) {
            const daysDiff = Math.floor((todayUTC - recordDateUTC) / (1000 * 60 * 60 * 24))
            
            if (daysDiff < 0) {
              aging.lessThan30 += amount
            } else if (daysDiff < 30) {
              aging.lessThan30 += amount
            } else if (daysDiff < 60) {
              aging.days30to60 += amount
            } else if (daysDiff < 90) {
              aging.days60to90 += amount
            } else if (daysDiff < 120) {
              aging.days90to120 += amount
            } else {
              aging.days120Plus += amount
            }
          } else {
            aging.lessThan30 += amount
          }
        } catch (e) {
          aging.lessThan30 += amount
        }
      } else {
        aging.lessThan30 += amount
      }
    })

    // Calculate total and percentages
    const total = aging.lessThan30 + aging.days30to60 + aging.days60to90 + aging.days90to120 + aging.days120Plus

    const result = {
      lessThan30: Math.round(aging.lessThan30),
      days30to60: Math.round(aging.days30to60),
      days60to90: Math.round(aging.days60to90),
      days90to120: Math.round(aging.days90to120),
      days120Plus: Math.round(aging.days120Plus),
      total: Math.round(total),
      percentages: {
        lessThan30: total > 0 ? (aging.lessThan30 / total) * 100 : 0,
        days30to60: total > 0 ? (aging.days30to60 / total) * 100 : 0,
        days60to90: total > 0 ? (aging.days60to90 / total) * 100 : 0,
        days90to120: total > 0 ? (aging.days90to120 / total) * 100 : 0,
        days120Plus: total > 0 ? (aging.days120Plus / total) * 100 : 0,
      },
    }

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

