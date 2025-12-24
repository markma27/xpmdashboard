import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireOrg } from '@/lib/auth'
import { isAdmin } from '@/lib/rbac'
import { createClient } from '@/lib/supabase/server'
import Papa from 'papaparse'

interface WIPTimesheetRow {
  [key: string]: string | undefined
}

// Helper function to get column value, handling both with and without brackets
function getColumnValue(row: WIPTimesheetRow, possibleNames: string[]): string | undefined {
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

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Delete ALL existing WIP timesheet data for this organization
    // This ensures a clean slate for each upload
    const { error: deleteError } = await supabase
      .from('wip_timesheet_uploads')
      .delete()
      .eq('organization_id', org.id)

    if (deleteError) {
      console.error('Error deleting existing WIP timesheets:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete existing WIP timesheets', details: deleteError.message },
        { status: 500 }
      )
    }

    // Read and parse CSV file
    const fileText = await file.text()
    
    return new Promise((resolve) => {
      Papa.parse<WIPTimesheetRow>(fileText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const rows = results.data
            const errors: string[] = []
            const autoFilled: string[] = [] // Track auto-filled records separately

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
                  const jobNo = getColumnValue(row, ['Job No.', '[Job] Job No.'])
                  const jobName = getColumnValue(row, ['Name', '[Job] Name'])
                  const timeValue = getColumnValue(row, ['Time', '[Ledger] Time'])
                  const billableRateValue = getColumnValue(row, ['Billable Rate', '[Ledger] Billable Rate'])
                  const billableAmountValue = getColumnValue(row, ['Billable Amount', '[Ledger] Billable Amount'])
                  const billedValue = getColumnValue(row, ['Billed?', '[Ledger] Billed?'])
                  const noteValue = getColumnValue(row, ['Note', '[Ledger] Note'])

                  // If staff name is missing, auto-fill with "Disbursement"
                  const staffName = staff || 'Disbursement'
                  if (!staff) {
                    // Track auto-filled records separately (not as errors)
                    autoFilled.push(`Row ${index + 2}: Staff name auto-filled as "Disbursement"`)
                  }

                  // Parse numeric fields
                  const parsedTime = timeValue ? parseFloat(timeValue.replace(/[^0-9.-]/g, '')) : null
                  const parsedBillableRate = billableRateValue ? parseFloat(billableRateValue.replace(/[^0-9.-]/g, '')) : null
                  const parsedBillableAmount = billableAmountValue ? parseFloat(billableAmountValue.replace(/[^0-9.-]/g, '')) : null

                  // Parse boolean fields
                  const parsedBilled = billedValue ? 
                    (billedValue.toLowerCase() === 'yes' || billedValue.toLowerCase() === 'true' || billedValue === '1') : false

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

                  // Normalize parsed date to string
                  const parsedDateStr = normalizeDateToString(parsedDate)

                  return {
                    organization_id: org.id,
                    client_group: clientGroup || null,
                    client: client || null,
                    account_manager: accountManager || null,
                    job_manager: jobManager || null,
                    job_no: jobNo || null,
                    job_name: jobName || null,
                    staff: staffName,
                    date: parsedDateStr, // Use normalized date string (YYYY-MM-DD)
                    time: parsedTime,
                    billable_rate: parsedBillableRate,
                    billable_amount: parsedBillableAmount,
                    billed: parsedBilled,
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
                .from('wip_timesheet_uploads')
                .insert(batch)

              if (insertError) {
                console.error('Error inserting batch:', insertError)
                return resolve(NextResponse.json(
                  { 
                    error: 'Failed to insert WIP timesheet data',
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
              message: `Successfully uploaded ${insertedCount} WIP timesheet records`,
              insertedCount,
              deletedCount: 'all existing records deleted before upload',
              warnings: errors.length > 0 ? errors : undefined,
              autoFilled: autoFilled.length > 0 ? autoFilled : undefined
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

