import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireOrg } from '@/lib/auth'
import { isAdmin } from '@/lib/rbac'
import { createClient } from '@/lib/supabase/server'
import Papa from 'papaparse'

interface TimesheetRow {
  [key: string]: string | undefined
}

// Helper function to get column value, handling both with and without brackets
function getColumnValue(row: TimesheetRow, possibleNames: string[]): string | undefined {
  for (const name of possibleNames) {
    if (row[name] !== undefined) {
      return row[name]
    }
  }
  return undefined
}

// Helper function to parse date string and normalize to date-only (midnight UTC)
function parseDate(dateString: string): Date | null {
  if (!dateString || !dateString.trim()) {
    return null
  }

  const trimmed = dateString.trim()
  
  // First, try to parse DD-MMM-YYYY or DD-MMM-YY format (e.g., "01-Jul-2024" or "1-Jul-25") manually to avoid timezone issues
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\w{3})[-/](\d{2,4})$/i)
  if (ddmmyyyyMatch) {
    const [, dayStr, monthStr, yearStr] = ddmmyyyyMatch
    const monthMap: { [key: string]: number } = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3,
      'may': 4, 'jun': 5, 'jul': 6, 'aug': 7,
      'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    }
    const monthIndex = monthMap[monthStr.toLowerCase()]
    if (monthIndex !== undefined) {
      let year = parseInt(yearStr, 10)
      // Handle 2-digit years: assume 20xx for years 00-99
      // You can adjust the century threshold if needed (e.g., < 50 = 20xx, >= 50 = 19xx)
      if (yearStr.length === 2) {
        year = 2000 + year
      }
      const day = parseInt(dayStr, 10)
      // Create date directly in UTC to avoid timezone conversion issues
      return new Date(Date.UTC(year, monthIndex, day))
    }
  }

  // Try parsing standard formats (YYYY-MM-DD, etc.)
  let date = new Date(trimmed)
  
  if (isNaN(date.getTime())) {
    return null
  }

  // Normalize to date-only (set to midnight UTC to avoid timezone issues)
  // Use the date components from the parsed date, but create a new UTC date
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  return new Date(Date.UTC(year, month, day))
}

// Helper function to normalize date to date-only string (YYYY-MM-DD)
function normalizeDateToString(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const org = await requireOrg()

    if (!isAdmin(org)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const startDate = formData.get('startDate') as string
    const endDate = formData.get('endDate') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    // Validate date range - normalize to date-only (midnight UTC)
    const startDateObj = parseDate(startDate)
    const endDateObj = parseDate(endDate)
    
    if (!startDateObj || !endDateObj) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }

    // Normalize to date strings for comparison
    const startDateNormalized = normalizeDateToString(startDateObj)
    const endDateNormalized = normalizeDateToString(endDateObj)

    if (startDateNormalized > endDateNormalized) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Delete existing timesheet data in the date range for this organization
    // Use normalized date strings to ensure consistent comparison
    const { error: deleteError } = await supabase
      .from('timesheet_uploads')
      .delete()
      .eq('organization_id', org.id)
      .gte('date', startDateNormalized)
      .lte('date', endDateNormalized)

    if (deleteError) {
      console.error('Error deleting existing timesheets:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete existing timesheets', details: deleteError.message },
        { status: 500 }
      )
    }

    // Read and parse CSV file
    const fileText = await file.text()
    
    return new Promise((resolve) => {
      Papa.parse<TimesheetRow>(fileText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const rows = results.data
            const errors: string[] = []

            if (rows.length === 0) {
              return resolve(NextResponse.json(
                { error: 'CSV file is empty or has no valid data' },
                { status: 400 }
              ))
            }

            // Transform CSV rows to database records
            const records = rows
              .map((row, index) => {
                try {

                  // Get column values, handling both formats (with/without brackets)
                  const clientGroup = getColumnValue(row, ['Client Group(s)', '[Client] Group(s)'])
                  const client = getColumnValue(row, ['Client', '[Client] Client'])
                  const accountManager = getColumnValue(row, ['Account Manager', '[Client] Account Manager'])
                  const jobManager = getColumnValue(row, ['Job Manager', '[Client] Job Manager'])
                  const staff = getColumnValue(row, ['Staff', '[Ledger] Staff'])
                  const dateValue = getColumnValue(row, ['Date', '[Ledger] Date'])
                  const jobName = getColumnValue(row, ['Name', '[Job] Name'])
                  const timeValue = getColumnValue(row, ['Time', '[Ledger] Time'])
                  const billableRateValue = getColumnValue(row, ['Billable Rate', '[Ledger] Billable Rate'])
                  const billableAmountValue = getColumnValue(row, ['Billable Amount', '[Ledger] Billable Amount'])
                  const billedValue = getColumnValue(row, ['Billed?', '[Ledger] Billed?'])
                  const billableValue = getColumnValue(row, ['Billable', '[Ledger] Billable'])
                  const capacityReducingValue = getColumnValue(row, ['Capacity Reducing?', '[Job] Capacity Reducing?'])
                  const noteValue = getColumnValue(row, ['Note', '[Ledger] Note'])

                  if (!staff) {
                    errors.push(`Row ${index + 2}: Missing staff name`)
                    return null
                  }

                  // Re-parse values with the correct column names
                  const parsedTime = timeValue ? parseFloat(timeValue.replace(/[^0-9.-]/g, '')) : null
                  const parsedBillableRate = billableRateValue ? parseFloat(billableRateValue.replace(/[^0-9.-]/g, '')) : null
                  const parsedBillableAmount = billableAmountValue ? parseFloat(billableAmountValue.replace(/[^0-9.-]/g, '')) : null

                  const parsedBilled = billedValue ? 
                    (billedValue.toLowerCase() === 'yes' || billedValue.toLowerCase() === 'true' || billedValue === '1') : false
                  const parsedBillable = billableValue !== undefined ?
                    (billableValue.toLowerCase() === 'yes' || billableValue.toLowerCase() === 'true' || billableValue === '1') : true
                  const parsedCapacityReducing = capacityReducingValue ?
                    (capacityReducingValue.toLowerCase() === 'yes' || capacityReducingValue.toLowerCase() === 'true' || capacityReducingValue === '1') : false

                  // Parse date with improved date parsing
                  let parsedDate: Date | null = null
                  if (dateValue) {
                    parsedDate = parseDate(dateValue)
                    if (!parsedDate) {
                      errors.push(`Row ${index + 2}: Invalid date format: ${dateValue}`)
                      return null
                    }
                  } else {
                    errors.push(`Row ${index + 2}: Missing date`)
                    return null
                  }

                  // Normalize parsed date to string for comparison
                  const parsedDateStr = normalizeDateToString(parsedDate)

                  // Validate date is within range (compare date strings)
                  if (parsedDateStr < startDateNormalized || parsedDateStr > endDateNormalized) {
                    errors.push(`Row ${index + 2}: Date ${dateValue} (parsed as ${parsedDateStr}) is outside the specified range (${startDateNormalized} to ${endDateNormalized})`)
                    return null
                  }

                  return {
                    organization_id: org.id,
                    client_group: clientGroup || null,
                    client: client || null,
                    account_manager: accountManager || null,
                    job_manager: jobManager || null,
                    staff: staff,
                    date: parsedDateStr, // Use normalized date string (YYYY-MM-DD)
                    job_name: jobName || null,
                    time: parsedTime,
                    billable_rate: parsedBillableRate,
                    billable_amount: parsedBillableAmount,
                    billed: parsedBilled,
                    billable: parsedBillable,
                    capacity_reducing: parsedCapacityReducing,
                    note: noteValue || null,
                  }
                } catch (error: any) {
                  errors.push(`Row ${index + 2}: ${error.message}`)
                  return null
                }
              })
              .filter((record): record is NonNullable<typeof record> => record !== null)

            if (records.length === 0) {
              return resolve(NextResponse.json(
                { 
                  error: 'No valid records found in CSV',
                  details: errors
                },
                { status: 400 }
              ))
            }

            // Insert records in batches (Supabase has a limit of 1000 rows per insert)
            const batchSize = 1000
            let insertedCount = 0

            for (let i = 0; i < records.length; i += batchSize) {
              const batch = records.slice(i, i + batchSize)
              const { error: insertError } = await supabase
                .from('timesheet_uploads')
                .insert(batch)

              if (insertError) {
                console.error('Error inserting batch:', insertError)
                return resolve(NextResponse.json(
                  { 
                    error: 'Failed to insert timesheet data',
                    details: insertError.message,
                    insertedCount,
                    errors: errors.length > 0 ? errors : undefined
                  },
                  { status: 500 }
                ))
              }

              insertedCount += batch.length
            }

            resolve(NextResponse.json({
              success: true,
              message: `Successfully uploaded ${insertedCount} timesheet records`,
              insertedCount,
              deletedCount: 'existing records in date range deleted',
              warnings: errors.length > 0 ? errors : undefined
            }))
          } catch (error: any) {
            console.error('Error processing CSV:', error)
            resolve(NextResponse.json(
              { error: 'Failed to process CSV file', details: error.message },
              { status: 500 }
            ))
          }
        },
        error: (error) => {
          console.error('CSV parsing error:', error)
          resolve(NextResponse.json(
            { error: 'Failed to parse CSV file', details: error.message },
            { status: 400 }
          ))
        }
      })
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    )
  }
}

