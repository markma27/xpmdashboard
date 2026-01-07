-- Check what data the frontend API would return
-- This simulates the exact API call

-- Check 1: What if staff filter is NOT applied (all staff)
SELECT 
  DATE_TRUNC('month', date)::date as month,
  COUNT(*) as record_count,
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as total_hours_all_staff
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;

-- Check 2: What if staff filter IS applied (Mark Lane only)
SELECT 
  DATE_TRUNC('month', date)::date as month,
  COUNT(*) as record_count,
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as total_hours_mark_lane_only
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff = 'Mark Lane'  -- Exact match as API uses
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;

-- Check 3: Verify staff name in database (check for hidden characters)
SELECT 
  staff,
  LENGTH(staff) as name_length,
  ASCII(SUBSTRING(staff FROM LENGTH(staff))) as last_char_ascii,
  COUNT(*) as count
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff ILIKE '%Mark Lane%'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY staff
ORDER BY count DESC;
