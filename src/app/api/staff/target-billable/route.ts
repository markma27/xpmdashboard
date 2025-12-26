import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const supabase = await createClient()

    // Get unique staff names from timesheet_uploads table
    // Use pagination to ensure we get all records
    let allTimesheetData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('timesheet_uploads')
        .select('staff')
        .eq('organization_id', org.id)
        .not('staff', 'is', null)
        .neq('staff', '')
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (pageError) {
        throw new Error(`Failed to fetch staff from timesheets: ${pageError.message}`)
      }
      
      if (pageData && pageData.length > 0) {
        allTimesheetData = allTimesheetData.concat(pageData)
        page++
        hasMore = pageData.length === pageSize
      } else {
        hasMore = false
      }
    }

    // Extract unique staff names
    const uniqueStaffNames = new Set<string>()
    if (allTimesheetData) {
      allTimesheetData.forEach((record) => {
        if (record.staff && record.staff.trim()) {
          const trimmedName = record.staff.trim()
          // Exclude 'disbursement' (case-insensitive)
          if (trimmedName.toLowerCase() !== 'disbursement') {
            uniqueStaffNames.add(trimmedName)
          }
        }
      })
    }

    // Convert to sorted array
    const staffNames = Array.from(uniqueStaffNames).sort()

    // Get staff settings from staff_settings table
    const { data: settingsData, error: settingsError } = await supabase
      .from('staff_settings')
      .select('staff_name, target_billable_percentage, fte, default_daily_hours, is_hidden, job_title, team, email, report, start_date, end_date')
      .eq('organization_id', org.id)

    if (settingsError) {
      throw new Error(`Failed to fetch staff settings: ${settingsError.message}`)
    }

    // Create a map of staff_name -> staff settings
    const settingsMap = new Map<string, {
      target_billable_percentage: number | null
      fte: number | null
      default_daily_hours: number | null
      is_hidden: boolean
      job_title: string | null
      team: string | null
      email: string | null
      report: boolean
      start_date: string | null
      end_date: string | null
    }>()
    if (settingsData) {
      settingsData.forEach((item) => {
        if (item.staff_name) {
          settingsMap.set(item.staff_name, {
            target_billable_percentage: item.target_billable_percentage ? Number(item.target_billable_percentage) : null,
            fte: item.fte ? Number(item.fte) : null,
            default_daily_hours: item.default_daily_hours ? Number(item.default_daily_hours) : null,
            is_hidden: item.is_hidden || false,
            job_title: item.job_title || null,
            team: item.team || null,
            email: item.email || null,
            report: item.report !== undefined ? Boolean(item.report) : true,
            start_date: item.start_date || null,
            end_date: item.end_date || null,
          })
        }
      })
    }

    // Combine staff names with settings
    const staffList = staffNames.map((staffName) => {
      const settings = settingsMap.get(staffName) || {
        target_billable_percentage: null,
        fte: null,
        default_daily_hours: null,
        is_hidden: false,
        job_title: null,
        team: null,
        email: null,
        report: true,
        start_date: null,
        end_date: null,
      }

      return {
        id: staffName, // Use staff_name as id since we don't have xpm_id anymore
        staff_name: staffName,
        name: staffName,
        target_billable_percentage: settings.target_billable_percentage,
        fte: settings.fte,
        default_daily_hours: settings.default_daily_hours,
        is_hidden: settings.is_hidden,
        job_title: settings.job_title,
        team: settings.team,
        email: settings.email,
        report: settings.report,
        start_date: settings.start_date,
        end_date: settings.end_date,
      }
    })

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

export async function POST(request: NextRequest) {
  try {
    const org = await requireOrg()
    const supabase = await createClient()
    const body = await request.json()

    // Check if this is a batch update request
    if (Array.isArray(body.staff)) {
      // Batch update multiple staff members
      const staffUpdates = body.staff as any[]
      
      if (staffUpdates.length === 0) {
        return NextResponse.json({ success: true, updated: 0 })
      }

      // Get all existing staff settings in one query
      const staffNames = staffUpdates.map(s => s.staff_name).filter(Boolean)
      const { data: existingSettings, error: fetchError } = await supabase
        .from('staff_settings')
        .select('id, staff_name, target_billable_percentage, fte, default_daily_hours, job_title, team, email, report, start_date, end_date')
        .eq('organization_id', org.id)
        .in('staff_name', staffNames)

      if (fetchError) {
        throw new Error(`Failed to fetch existing settings: ${fetchError.message}`)
      }

      // Create a map of existing settings
      const existingMap = new Map<string, any>()
      if (existingSettings) {
        existingSettings.forEach((setting) => {
          existingMap.set(setting.staff_name, setting)
        })
      }

      // Prepare updates and inserts
      const updates: any[] = []
      const inserts: any[] = []

      for (const staffUpdate of staffUpdates) {
        const {
          staff_name,
          target_billable_percentage,
          fte,
          default_daily_hours,
          is_hidden,
          job_title,
          team,
          email,
          report,
          start_date,
          end_date
        } = staffUpdate

        if (!staff_name) continue

        const existing = existingMap.get(staff_name)
        const updateData: any = {
          updated_at: new Date().toISOString(),
        }

        // Validate and add fields
        if (target_billable_percentage !== undefined && target_billable_percentage !== null && target_billable_percentage !== '') {
          const percentage = Number(target_billable_percentage)
          if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
            updateData.target_billable_percentage = percentage
          }
        }
        if (fte !== undefined && fte !== null && fte !== '') {
          const fteValue = Number(fte)
          if (!isNaN(fteValue) && fteValue >= 0 && fteValue <= 1) {
            updateData.fte = fteValue
          }
        }
        if (default_daily_hours !== undefined && default_daily_hours !== null && default_daily_hours !== '') {
          const dailyHours = Number(default_daily_hours)
          if (!isNaN(dailyHours) && dailyHours > 0 && dailyHours <= 24) {
            updateData.default_daily_hours = dailyHours
          }
        }
        if (job_title !== undefined && job_title !== null && job_title !== '') {
          updateData.job_title = String(job_title).trim()
        }
        if (team !== undefined && team !== null && team !== '') {
          updateData.team = String(team).trim()
        }
        if (email !== undefined && email !== null && email !== '') {
          updateData.email = String(email).trim()
        }
        if (report !== undefined && report !== null) {
          updateData.report = Boolean(report)
        }
        if (is_hidden !== undefined) {
          updateData.is_hidden = Boolean(is_hidden)
        }
        if (start_date !== undefined && start_date !== null && start_date !== '') {
          const date = new Date(start_date)
          if (!isNaN(date.getTime())) {
            updateData.start_date = start_date
          }
        }
        if (end_date !== undefined && end_date !== null && end_date !== '') {
          const date = new Date(end_date)
          if (!isNaN(date.getTime())) {
            updateData.end_date = end_date
          }
        }

        // Validate date range
        if (updateData.start_date && updateData.end_date) {
          const start = new Date(updateData.start_date)
          const end = new Date(updateData.end_date)
          if (end < start) {
            continue // Skip invalid date range
          }
        }

        if (existing) {
          // Update existing record
          updates.push({
            id: existing.id,
            ...updateData
          })
        } else {
          // Insert new record
          inserts.push({
            organization_id: org.id,
            staff_name: staff_name,
            is_hidden: is_hidden !== undefined ? Boolean(is_hidden) : false,
            report: report !== undefined ? Boolean(report) : true,
            ...updateData
          })
        }
      }

      // Perform batch updates and inserts
      let updatedCount = 0
      let insertedCount = 0

      if (updates.length > 0) {
        // Batch update using Promise.all for parallel execution
        // Limit concurrency to avoid overwhelming the database
        const batchSize = 10
        for (let i = 0; i < updates.length; i += batchSize) {
          const batch = updates.slice(i, i + batchSize)
          const updatePromises = batch.map(update => {
            const { id, ...data } = update
            return supabase
              .from('staff_settings')
              .update(data)
              .eq('id', id)
          })
          const updateResults = await Promise.all(updatePromises)
          updatedCount += updateResults.filter(r => !r.error).length
        }
      }

      if (inserts.length > 0) {
        // Use upsert for inserts (handles duplicates gracefully)
        const { error: insertError } = await supabase
          .from('staff_settings')
          .upsert(inserts, {
            onConflict: 'organization_id,staff_name',
            ignoreDuplicates: false
          })
        if (!insertError) {
          insertedCount = inserts.length
        } else {
          throw new Error(`Failed to insert staff settings: ${insertError.message}`)
        }
      }

      return NextResponse.json({
        success: true,
        updated: updatedCount,
        inserted: insertedCount
      })
    }

    // Fall back to single update for backward compatibility
    return NextResponse.json(
      { error: 'Invalid request format. Use PUT for single updates or POST with staff array for batch updates.' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const org = await requireOrg()
    const supabase = await createClient()
    const body = await request.json()

    const { staff_name, target_billable_percentage, fte, default_daily_hours, is_hidden, job_title, team, email, report, start_date, end_date } = body

    if (!staff_name) {
      return NextResponse.json(
        { error: 'staff_name is required' },
        { status: 400 }
      )
    }

    // Check if staff settings already exists
    const { data: existingData } = await supabase
      .from('staff_settings')
      .select('id, target_billable_percentage, fte, default_daily_hours, job_title, start_date, end_date')
      .eq('organization_id', org.id)
      .eq('staff_name', staff_name)
      .single()

    // If only updating is_hidden, allow it without other fields
    const onlyUpdatingHidden = is_hidden !== undefined && 
      target_billable_percentage === undefined && 
      fte === undefined && 
      default_daily_hours === undefined && 
      job_title === undefined && 
      team === undefined &&
      email === undefined &&
      report === undefined &&
      start_date === undefined &&
      end_date === undefined

    if (onlyUpdatingHidden) {
      if (existingData) {
        // Just update is_hidden for existing record
        const { error: updateError } = await supabase
          .from('staff_settings')
          .update({ is_hidden: Boolean(is_hidden), updated_at: new Date().toISOString() })
          .eq('id', existingData.id)

        if (updateError) {
          throw new Error(`Failed to update hidden status: ${updateError.message}`)
        }
        return NextResponse.json({ success: true })
      } else {
        // Create new record with only is_hidden set
        const { error: insertError } = await supabase
          .from('staff_settings')
          .insert({
            organization_id: org.id,
            staff_name: staff_name,
            is_hidden: Boolean(is_hidden),
          })

        if (insertError) {
          throw new Error(`Failed to update hidden status: ${insertError.message}`)
        }
        return NextResponse.json({ success: true })
      }
    }

    // Validate target_billable_percentage if provided
    let percentage: number | null = null
    if (target_billable_percentage !== undefined && target_billable_percentage !== null) {
      percentage = Number(target_billable_percentage)
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        return NextResponse.json(
          { error: 'target_billable_percentage must be between 0 and 100' },
          { status: 400 }
        )
      }
    } else if (existingData) {
      // Use existing value for updates
      percentage = existingData.target_billable_percentage
        ? Number(existingData.target_billable_percentage)
        : null
    }

    // Validate FTE if provided
    let fteValue: number | null = null
    if (fte !== undefined && fte !== null && fte !== '') {
      fteValue = Number(fte)
      if (isNaN(fteValue) || fteValue < 0 || fteValue > 1) {
        return NextResponse.json(
          { error: 'fte must be between 0 and 1' },
          { status: 400 }
        )
      }
    } else if (existingData && existingData.fte !== null) {
      fteValue = Number(existingData.fte)
    }

    // Validate default_daily_hours if provided
    let dailyHours: number | null = null
    if (default_daily_hours !== undefined && default_daily_hours !== null && default_daily_hours !== '') {
      dailyHours = Number(default_daily_hours)
      if (isNaN(dailyHours) || dailyHours <= 0 || dailyHours > 24) {
        return NextResponse.json(
          { error: 'default_daily_hours must be between 0 and 24' },
          { status: 400 }
        )
      }
    } else if (existingData && existingData.default_daily_hours !== null) {
      dailyHours = Number(existingData.default_daily_hours)
    }

    // Validate job_title if provided
    let jobTitle: string | null = null
    if (job_title !== undefined && job_title !== null && job_title !== '') {
      jobTitle = String(job_title).trim()
    } else if (existingData && existingData.job_title) {
      jobTitle = existingData.job_title
    }

    // Validate team if provided
    let teamValue: string | null = null
    if (team !== undefined && team !== null && team !== '') {
      teamValue = String(team).trim()
    } else if (existingData) {
      const { data: existingWithTeam } = await supabase
        .from('staff_settings')
        .select('team')
        .eq('id', existingData.id)
        .single()
      teamValue = existingWithTeam?.team || null
    }

    // Validate email if provided
    let emailValue: string | null = null
    if (email !== undefined && email !== null && email !== '') {
      emailValue = String(email).trim()
    } else if (existingData) {
      const { data: existingWithEmail } = await supabase
        .from('staff_settings')
        .select('email')
        .eq('id', existingData.id)
        .single()
      emailValue = existingWithEmail?.email || null
    }

    // Validate report if provided
    let reportValue: boolean | null = null
    if (report !== undefined && report !== null) {
      reportValue = Boolean(report)
    } else if (existingData) {
      const { data: existingWithReport } = await supabase
        .from('staff_settings')
        .select('report')
        .eq('id', existingData.id)
        .single()
      reportValue = existingWithReport?.report !== undefined ? Boolean(existingWithReport.report) : true
    }

    // Validate start_date if provided
    let startDateValue: string | null = null
    if (start_date !== undefined && start_date !== null && start_date !== '') {
      startDateValue = String(start_date).trim()
      // Validate date format
      const date = new Date(startDateValue)
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: 'start_date must be a valid date' },
          { status: 400 }
        )
      }
    } else if (existingData && existingData.start_date) {
      startDateValue = existingData.start_date
    }

    // Validate end_date if provided
    let endDateValue: string | null = null
    if (end_date !== undefined && end_date !== null && end_date !== '') {
      endDateValue = String(end_date).trim()
      // Validate date format
      const date = new Date(endDateValue)
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: 'end_date must be a valid date' },
          { status: 400 }
        )
      }
    } else if (existingData && existingData.end_date) {
      endDateValue = existingData.end_date
    }

    // Validate that end_date is after start_date if both are provided
    if (startDateValue && endDateValue) {
      const start = new Date(startDateValue)
      const end = new Date(endDateValue)
      if (end < start) {
        return NextResponse.json(
          { error: 'end_date must be after start_date' },
          { status: 400 }
        )
      }
    }


    // Prepare update/insert data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (percentage !== null) {
      updateData.target_billable_percentage = percentage
    }
    if (fteValue !== null) {
      updateData.fte = fteValue
    }
    if (dailyHours !== null) {
      updateData.default_daily_hours = dailyHours
    }
    if (jobTitle !== null) {
      updateData.job_title = jobTitle
    }
    if (teamValue !== null) {
      updateData.team = teamValue
    }
    if (emailValue !== null) {
      updateData.email = emailValue
    }
    if (reportValue !== null) {
      updateData.report = reportValue
    }
    if (is_hidden !== undefined) {
      updateData.is_hidden = Boolean(is_hidden)
    }
    if (startDateValue !== null) {
      updateData.start_date = startDateValue
    }
    if (endDateValue !== null) {
      updateData.end_date = endDateValue
    }

    if (existingData) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('staff_settings')
        .update(updateData)
        .eq('id', existingData.id)

      if (updateError) {
        throw new Error(`Failed to update staff settings: ${updateError.message}`)
      }
    } else {
      // Insert new record - all fields optional
      const insertData: any = {
        organization_id: org.id,
        staff_name: staff_name,
        is_hidden: is_hidden !== undefined ? Boolean(is_hidden) : false,
      }

      if (percentage !== null) {
        insertData.target_billable_percentage = percentage
      }
      if (fteValue !== null) {
        insertData.fte = fteValue
      }
      if (dailyHours !== null) {
        insertData.default_daily_hours = dailyHours
      }
      if (jobTitle !== null) {
        insertData.job_title = jobTitle
      }
      if (teamValue !== null) {
        insertData.team = teamValue
      }
      if (emailValue !== null) {
        insertData.email = emailValue
      }
      if (reportValue !== null) {
        insertData.report = reportValue
      } else {
        insertData.report = true // Default to true for new records
      }
      if (startDateValue !== null) {
        insertData.start_date = startDateValue
      }
      if (endDateValue !== null) {
        insertData.end_date = endDateValue
      }

      const { error: insertError } = await supabase
        .from('staff_settings')
        .insert(insertData)

      if (insertError) {
        throw new Error(`Failed to insert staff settings: ${insertError.message}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

