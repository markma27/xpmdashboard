-- Debug query to reconcile Mark Lane's billable hours for July-September 2024
-- This query replicates the exact logic used in the Productivity API

-- Step 1: Check raw data format
-- Replace '<org_id>' with your actual organization_id
-- Replace 'Mark Lane' with the exact staff name as stored in database (check for trailing spaces)

SELECT 
  date,
  time as raw_time,
  -- Show what the API conversion function would produce
  CASE 
    WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
    ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
  END as api_converted_hours,
  -- Show if time is already in decimal hours format
  time as direct_hours,
  billable,
  staff
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff = 'Mark Lane'  -- REPLACE THIS - check exact spelling/spacing
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
ORDER BY date;

-- Step 2: Monthly totals using API conversion logic
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
  -- Compare with direct sum (if time is already in hours)
  SUM(time) as direct_total_hours
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff = 'Mark Lane'  -- REPLACE THIS
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;

-- Step 3: Check for data quality issues
SELECT 
  'Total records' as metric,
  COUNT(*)::text as value
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff = 'Mark Lane'  -- REPLACE THIS
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true

UNION ALL

SELECT 
  'Records with NULL time' as metric,
  COUNT(*)::text as value
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff = 'Mark Lane'  -- REPLACE THIS
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
  AND time IS NULL

UNION ALL

SELECT 
  'Records with time = 0' as metric,
  COUNT(*)::text as value
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff = 'Mark Lane'  -- REPLACE THIS
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
  AND (time = 0 OR time IS NULL)

UNION ALL

SELECT 
  'Min time value' as metric,
  MIN(time)::text as value
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff = 'Mark Lane'  -- REPLACE THIS
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true

UNION ALL

SELECT 
  'Max time value' as metric,
  MAX(time)::text as value
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff = 'Mark Lane'  -- REPLACE THIS
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true

UNION ALL

SELECT 
  'Sample time values' as metric,
  STRING_AGG(DISTINCT time::text, ', ' ORDER BY time::text) as value
FROM (
  SELECT DISTINCT time
  FROM timesheet_uploads
  WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
    AND staff = 'Mark Lane'  -- REPLACE THIS
    AND date >= '2024-07-01'
    AND date <= '2024-09-30'
    AND billable = true
  LIMIT 20
) sub;

-- Step 4: Check staff name variations (in case of spacing issues)
SELECT DISTINCT 
  staff,
  LENGTH(staff) as name_length,
  COUNT(*) as record_count
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff ILIKE '%Mark Lane%'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY staff
ORDER BY record_count DESC;
