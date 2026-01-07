-- Debug query to find why only Mark Lane's July-September 2024 data is wrong
-- This checks for common issues that would affect only specific data

-- Issue 1: Check for duplicate records (same date, staff, time)
-- If there are duplicates, they would be counted multiple times
SELECT 
  date,
  staff,
  time,
  COUNT(*) as duplicate_count,
  COUNT(*) * time as total_if_summed_directly
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff ILIKE '%Mark Lane%'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY date, staff, time
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, date;

-- Issue 2: Check for staff name variations that might cause double counting
-- If there are "Mark Lane" and "Mark Lane " (with space), both would show up
-- but the API might only filter one, causing confusion
SELECT DISTINCT 
  staff,
  LENGTH(staff) as name_length,
  COUNT(*) as total_records,
  SUM(time) as sum_raw_time,
  -- Show what API conversion would produce
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as api_total_hours
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff ILIKE '%Mark Lane%'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY staff
ORDER BY total_records DESC;

-- Issue 3: Compare Mark Lane's data format with other staff for same period
-- Check if Mark Lane's time values are in a different format
SELECT 
  'Mark Lane' as staff_type,
  COUNT(*) as record_count,
  MIN(time) as min_time,
  MAX(time) as max_time,
  AVG(time) as avg_time,
  -- Check distribution: how many are < 100, how many >= 100
  COUNT(*) FILTER (WHERE ROUND(time) < 100) as values_under_100,
  COUNT(*) FILTER (WHERE ROUND(time) >= 100) as values_100_or_more,
  COUNT(*) FILTER (WHERE time < 24 AND time != ROUND(time)) as decimal_hours_format
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff ILIKE '%Mark Lane%'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true

UNION ALL

SELECT 
  'Other Staff (Sample)' as staff_type,
  COUNT(*) as record_count,
  MIN(time) as min_time,
  MAX(time) as max_time,
  AVG(time) as avg_time,
  COUNT(*) FILTER (WHERE ROUND(time) < 100) as values_under_100,
  COUNT(*) FILTER (WHERE ROUND(time) >= 100) as values_100_or_more,
  COUNT(*) FILTER (WHERE time < 24 AND time != ROUND(time)) as decimal_hours_format
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff NOT ILIKE '%Mark Lane%'
  AND staff NOT ILIKE '%disbursement%'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true;

-- Issue 4: Compare Mark Lane's July-September with other months
-- Check if the issue is specific to these months
SELECT 
  DATE_TRUNC('month', date)::date as month,
  COUNT(*) as record_count,
  SUM(time) as sum_raw_time,
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as api_total_hours,
  -- Check for unusual time values
  COUNT(*) FILTER (WHERE time > 1000) as values_over_1000,
  COUNT(*) FILTER (WHERE time < 1) as values_under_1
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff ILIKE '%Mark Lane%'
  AND date >= '2024-01-01'
  AND date <= '2024-12-31'
  AND billable = true
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;

-- Issue 5: Check if data was uploaded multiple times (check uploaded_at timestamps)
-- Multiple uploads in same date range could cause duplicates
SELECT 
  DATE_TRUNC('day', uploaded_at)::date as upload_date,
  COUNT(DISTINCT DATE_TRUNC('hour', uploaded_at)) as upload_sessions,
  COUNT(*) as total_records,
  COUNT(DISTINCT date) as distinct_dates_covered
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff ILIKE '%Mark Lane%'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY DATE_TRUNC('day', uploaded_at)
ORDER BY upload_date DESC;

-- Issue 6: Check for records that might be counted in both current and last year
-- This shouldn't happen for July-September 2024, but worth checking
SELECT 
  date,
  staff,
  time,
  -- Check which financial year this belongs to
  CASE 
    WHEN EXTRACT(MONTH FROM date) >= 7 THEN EXTRACT(YEAR FROM date)
    ELSE EXTRACT(YEAR FROM date) - 1
  END as financial_year_start
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff ILIKE '%Mark Lane%'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
ORDER BY date
LIMIT 100;

-- Issue 7: Most important - Check if there are records with unusual time values
-- that would cause incorrect conversion
SELECT 
  time as raw_time,
  COUNT(*) as frequency,
  -- Show conversion result
  CASE 
    WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
    ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
  END as converted_hours,
  -- Show if this looks like decimal hours
  CASE 
    WHEN time < 24 AND time != ROUND(time) THEN 'Likely decimal hours'
    WHEN ROUND(time) < 100 THEN 'Minutes format'
    WHEN ROUND(time) >= 100 THEN 'HHMM format'
    ELSE 'Unknown format'
  END as format_guess
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff ILIKE '%Mark Lane%'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY time
ORDER BY frequency DESC
LIMIT 50;
