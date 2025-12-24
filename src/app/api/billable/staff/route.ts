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
    // Financial year runs from July 1 to June 30
    const now = new Date()
    const currentMonth = now.getMonth() // 0-11 (0=January, 11=December)
    const currentYear = now.getFullYear()
    
    // Determine current financial year
    // If current month >= 6 (July-December), FY starts in current year
    // If current month < 6 (January-June), FY starts in previous year
    let currentFYStartYear: number
    if (currentMonth >= 6) {
      // July-December: FY starts this year
      currentFYStartYear = currentYear
    } else {
      // January-June: FY started last year
      currentFYStartYear = currentYear - 1
    }
    
    const currentFYEndYear = currentFYStartYear + 1
    const lastFYStartYear = currentFYStartYear - 1
    const lastFYEndYear = currentFYStartYear
    
    // Format dates as YYYY-MM-DD
    const currentYearStart = `${currentFYStartYear}-07-01`
    const currentYearEnd = `${currentFYEndYear}-06-30`
    const lastYearStart = `${lastFYStartYear}-07-01`
    const lastYearEnd = `${lastFYEndYear}-06-30`

    // Fetch current year timesheet data - get all records using pagination
    let currentYearData: any[] = []
    let currentYearPage = 0
    const pageSize = 1000
    let hasMoreCurrentYear = true
    
    while (hasMoreCurrentYear) {
      const { data: pageData, error: pageError } = await supabase
        .from('timesheet_uploads')
        .select('staff, billable_amount')
        .eq('organization_id', organizationId)
        .gte('date', currentYearStart)
        .lte('date', currentYearEnd)
        .range(currentYearPage * pageSize, (currentYearPage + 1) * pageSize - 1)
      
      if (pageError) {
        return NextResponse.json(
          { error: 'Failed to fetch current year data', details: pageError.message },
          { status: 500 }
        )
      }
      
      if (pageData && pageData.length > 0) {
        currentYearData = currentYearData.concat(pageData)
        currentYearPage++
        hasMoreCurrentYear = pageData.length === pageSize
      } else {
        hasMoreCurrentYear = false
      }
    }

    // Fetch last year timesheet data - get all records using pagination
    let lastYearData: any[] = []
    let lastYearPage = 0
    let hasMoreLastYear = true
    
    while (hasMoreLastYear) {
      const { data: pageData, error: pageError } = await supabase
        .from('timesheet_uploads')
        .select('staff, billable_amount')
        .eq('organization_id', organizationId)
        .gte('date', lastYearStart)
        .lte('date', lastYearEnd)
        .range(lastYearPage * pageSize, (lastYearPage + 1) * pageSize - 1)
      
      if (pageError) {
        return NextResponse.json(
          { error: 'Failed to fetch last year data', details: pageError.message },
          { status: 500 }
        )
      }
      
      if (pageData && pageData.length > 0) {
        lastYearData = lastYearData.concat(pageData)
        lastYearPage++
        hasMoreLastYear = pageData.length === pageSize
      } else {
        hasMoreLastYear = false
      }
    }

    // Aggregate billable amounts by staff for both years
    const staffAmounts = new Map<string, { currentYear: number; lastYear: number }>()

    // Process current year data
    if (currentYearData) {
      currentYearData.forEach((record) => {
        if (record.staff) {
          const staffName = record.staff.trim()
          // Exclude 'disbursement' (case-insensitive)
          if (staffName && staffName.toLowerCase() !== 'disbursement') {
            if (!staffAmounts.has(staffName)) {
              staffAmounts.set(staffName, { currentYear: 0, lastYear: 0 })
            }
            const staff = staffAmounts.get(staffName)!
            // Handle both string and number types for billable_amount
            let amount = 0
            if (typeof record.billable_amount === 'number') {
              amount = record.billable_amount
            } else if (typeof record.billable_amount === 'string') {
              amount = parseFloat(record.billable_amount) || 0
            }
            staff.currentYear += amount
          }
        }
      })
    }

    // Process last year data
    if (lastYearData) {
      lastYearData.forEach((record) => {
        if (record.staff) {
          const staffName = record.staff.trim()
          // Exclude 'disbursement' (case-insensitive)
          if (staffName && staffName.toLowerCase() !== 'disbursement') {
            if (!staffAmounts.has(staffName)) {
              staffAmounts.set(staffName, { currentYear: 0, lastYear: 0 })
            }
            const staff = staffAmounts.get(staffName)!
            // Handle both string and number types for billable_amount
            let amount = 0
            if (typeof record.billable_amount === 'number') {
              amount = record.billable_amount
            } else if (typeof record.billable_amount === 'string') {
              amount = parseFloat(record.billable_amount) || 0
            }
            staff.lastYear += amount
          }
        }
      })
    }

    // Filter staff: only include those with at least one non-zero year
    // Round amounts to integers first (matching frontend display) and check if > 0
    const staffList = Array.from(staffAmounts.entries())
      .filter(([_, amounts]) => {
        const roundedCurrentYear = Math.round(amounts.currentYear)
        const roundedLastYear = Math.round(amounts.lastYear)
        return roundedCurrentYear > 0 || roundedLastYear > 0
      })
      .map(([staffName, _]) => staffName)
      .sort()

    return NextResponse.json(staffList, {
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

