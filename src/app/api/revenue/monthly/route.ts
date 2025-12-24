import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || org.id

    const supabase = await createClient()

    // Get current year and last year data
    // Current year: July 2025 to June 2026
    // Last year: July 2024 to June 2025
    // Use date strings directly to avoid timezone issues
    const currentYearStart = '2025-07-01'
    const currentYearEnd = '2026-06-30'
    const lastYearStart = '2024-07-01'
    const lastYearEnd = '2025-06-30'

    // Fetch current year invoices - get all records using pagination
    let currentYearData: any[] = []
    let currentYearPage = 0
    const pageSize = 1000
    let hasMoreCurrentYear = true
    
    while (hasMoreCurrentYear) {
      const { data: pageData, error: pageError } = await supabase
        .from('invoice_uploads')
        .select('date, amount')
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

    // Fetch last year invoices - get all records using pagination
    let lastYearData: any[] = []
    let lastYearPage = 0
    let hasMoreLastYear = true
    
    while (hasMoreLastYear) {
      const { data: pageData, error: pageError } = await supabase
        .from('invoice_uploads')
        .select('date, amount')
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

    // Initialize months array (July to June)
    const months = [
      'July', 'August', 'September', 'October', 'November', 'December',
      'January', 'February', 'March', 'April', 'May', 'June'
    ]

    // Initialize data structure
    const monthlyData = months.map((month, index) => {
      // Calculate year based on month index
      // July (0) to November (4) = 2025
      // December (5) to June (11) = 2026 for current year
      const currentYear = index < 5 ? 2025 : 2026
      const lastYear = index < 5 ? 2024 : 2025

      return {
        month,
        currentYear: 0,
        lastYear: 0,
      }
    })

    // Aggregate current year data
    // Since we've already filtered by date range, all data belongs to current year period
    if (currentYearData) {
      currentYearData.forEach((invoice) => {
        const date = new Date(invoice.date)
        const month = date.getMonth()

        // Map month to our array index
        // July (6) = 0, August (7) = 1, ..., December (11) = 5
        // January (0) = 6, February (1) = 7, ..., June (5) = 11
        const monthIndex = month >= 6 ? month - 6 : month + 6

        // Handle both string and number types for amount
        let amount = 0
        if (typeof invoice.amount === 'number') {
          amount = invoice.amount
        } else if (typeof invoice.amount === 'string') {
          amount = parseFloat(invoice.amount) || 0
        }
        monthlyData[monthIndex].currentYear += amount
      })
    }

    // Aggregate last year data
    // Since we've already filtered by date range, all data belongs to last year period
    if (lastYearData) {
      lastYearData.forEach((invoice) => {
        const date = new Date(invoice.date)
        const month = date.getMonth()

        // Map month to our array index
        const monthIndex = month >= 6 ? month - 6 : month + 6

        // Handle both string and number types for amount
        let amount = 0
        if (typeof invoice.amount === 'number') {
          amount = invoice.amount
        } else if (typeof invoice.amount === 'string') {
          amount = parseFloat(invoice.amount) || 0
        }
        monthlyData[monthIndex].lastYear += amount
      })
    }

    // Return full amounts (not divided by 1000, no rounding)
    const formattedData = monthlyData.map((item) => ({
      month: item.month,
      'Current Year': item.currentYear,
      'Last Year': item.lastYear,
    }))

    return NextResponse.json(formattedData)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

