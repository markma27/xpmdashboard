import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const org = await requireOrg()
    const supabase = await createClient()

    // Get all staff from xpm_staff table for this organization
    const { data: staffData, error: staffError } = await supabase
      .from('xpm_staff')
      .select('id, xpm_id, raw_data')
      .eq('organization_id', org.id)
      .order('raw_data')

    if (staffError) {
      throw new Error(`Failed to fetch staff: ${staffError.message}`)
    }

    // Get target billable percentages, FTE, default daily hours, is_hidden, job_title, team, email, and report
    const { data: targetData, error: targetError } = await supabase
      .from('staff_target_billable')
      .select('xpm_id, target_billable_percentage, fte, default_daily_hours, is_hidden, job_title, team, email, report')
      .eq('organization_id', org.id)

    if (targetError) {
      throw new Error(`Failed to fetch target billable: ${targetError.message}`)
    }

    // Create a map of xpm_id -> staff settings
    const settingsMap = new Map<string, {
      target_billable_percentage: number | null
      fte: number | null
      default_daily_hours: number | null
      is_hidden: boolean
      job_title: string | null
      team: string | null
      email: string | null
      report: boolean
    }>()
    if (targetData) {
      targetData.forEach((item) => {
        settingsMap.set(item.xpm_id, {
          target_billable_percentage: item.target_billable_percentage ? Number(item.target_billable_percentage) : null,
          fte: item.fte ? Number(item.fte) : null,
          default_daily_hours: item.default_daily_hours ? Number(item.default_daily_hours) : null,
          is_hidden: item.is_hidden || false,
          job_title: item.job_title || null,
          team: item.team || null,
          email: item.email || null,
          report: item.report !== undefined ? Boolean(item.report) : true,
        })
      })
    }

    // Helper function to extract value from XML parsed structure
    // xml2js converts XML to JSON where values can be arrays
    const extractValue = (obj: any, key: string): string | null => {
      if (!obj || !obj[key]) return null
      const value = obj[key]
      // Handle xml2js array format: ['value'] -> 'value'
      if (Array.isArray(value) && value.length > 0) {
        return String(value[0])
      }
      return String(value)
    }

    // Combine staff data with target billable percentages
    const staffList = (staffData || []).map((staff) => {
      // Extract staff name from raw_data
      // XPM API returns staff data in XML format, parsed to JSON by xml2js
      // Structure: <Staff><FirstName>John</FirstName><LastName>Doe</LastName></Staff>
      // xml2js converts to: { FirstName: ['John'], LastName: ['Doe'] }
      const rawData = staff.raw_data
      let staffName = 'Unknown'
      
      if (rawData) {
        const firstName = extractValue(rawData, 'FirstName')
        const lastName = extractValue(rawData, 'LastName')
        const name = extractValue(rawData, 'Name')
        
        if (firstName && lastName) {
          staffName = `${firstName} ${lastName}`.trim()
        } else if (firstName) {
          staffName = firstName
        } else if (lastName) {
          staffName = lastName
        } else if (name) {
          staffName = name
        } else if (typeof rawData === 'string') {
          staffName = rawData
        }
      }

      const settings = settingsMap.get(staff.xpm_id) || {
        target_billable_percentage: null,
        fte: null,
        default_daily_hours: null,
        is_hidden: false,
        job_title: null,
        team: null,
        email: null,
        report: true,
      }

      return {
        id: staff.id,
        xpm_id: staff.xpm_id,
        name: staffName,
        target_billable_percentage: settings.target_billable_percentage,
        fte: settings.fte,
        default_daily_hours: settings.default_daily_hours,
        is_hidden: settings.is_hidden,
        job_title: settings.job_title,
        team: settings.team,
        email: settings.email,
        report: settings.report,
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

export async function PUT(request: NextRequest) {
  try {
    const org = await requireOrg()
    const supabase = await createClient()
    const body = await request.json()

    const { xpm_id, target_billable_percentage, fte, default_daily_hours, is_hidden, job_title, team, email, report } = body

    if (!xpm_id) {
      return NextResponse.json(
        { error: 'xpm_id is required' },
        { status: 400 }
      )
    }

    // Get the xpm_staff record to get the xpm_staff_id (needed for both updates and inserts)
    const { data: staffData, error: staffError } = await supabase
      .from('xpm_staff')
      .select('id')
      .eq('organization_id', org.id)
      .eq('xpm_id', xpm_id)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json(
        { error: 'Staff not found' },
        { status: 404 }
      )
    }

    // Check if target billable already exists
    const { data: existingData } = await supabase
      .from('staff_target_billable')
      .select('id, target_billable_percentage, fte, default_daily_hours, job_title')
      .eq('organization_id', org.id)
      .eq('xpm_id', xpm_id)
      .single()

    // If only updating is_hidden, allow it without other fields
    const onlyUpdatingHidden = is_hidden !== undefined && 
      target_billable_percentage === undefined && 
      fte === undefined && 
      default_daily_hours === undefined && 
      job_title === undefined && 
      team === undefined &&
      email === undefined &&
      report === undefined

    if (onlyUpdatingHidden) {
      if (existingData) {
        // Just update is_hidden for existing record
        const { error: updateError } = await supabase
          .from('staff_target_billable')
          .update({ is_hidden: Boolean(is_hidden), updated_at: new Date().toISOString() })
          .eq('id', existingData.id)

        if (updateError) {
          throw new Error(`Failed to update hidden status: ${updateError.message}`)
        }
        return NextResponse.json({ success: true })
      } else {
        // Create new record with only is_hidden set
        const { error: insertError } = await supabase
          .from('staff_target_billable')
          .insert({
            organization_id: org.id,
            xpm_staff_id: staffData.id,
            xpm_id: xpm_id,
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
        .from('staff_target_billable')
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
        .from('staff_target_billable')
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
        .from('staff_target_billable')
        .select('report')
        .eq('id', existingData.id)
        .single()
      reportValue = existingWithReport?.report !== undefined ? Boolean(existingWithReport.report) : true
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

    if (existingData) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('staff_target_billable')
        .update(updateData)
        .eq('id', existingData.id)

      if (updateError) {
        throw new Error(`Failed to update staff settings: ${updateError.message}`)
      }
    } else {
      // Insert new record - all fields optional
      const insertData: any = {
        organization_id: org.id,
        xpm_staff_id: staffData.id,
        xpm_id: xpm_id,
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

      const { error: insertError } = await supabase
        .from('staff_target_billable')
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

