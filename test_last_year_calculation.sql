-- Test Last Year calculation as API does it
-- For asOfDate = 2026-01-07:
-- currentFYStartYear = 2025
-- lastFYStartYear = 2024
-- lastFYEndYear = 2025
-- lastYearStart = 2024-07-01
-- lastYearEnd = 2025-06-30

-- This should match API's "Last Year" calculation
SELECT 
  DATE_TRUNC('month', date)::date as month,
  COUNT(*) as record_count,
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as total_hours
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff ILIKE 'Mark Lane'
  AND billable = true
  AND date >= '2024-07-01'
  AND date <= '2025-06-30'
  -- API's logic: include if (year === 2024 && month >= 6) OR (year === 2025 && month < 6)
  AND (
    (EXTRACT(YEAR FROM date) = 2024 AND EXTRACT(MONTH FROM date) >= 7)
    OR
    (EXTRACT(YEAR FROM date) = 2025 AND EXTRACT(MONTH FROM date) <= 6)
  )
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;

-- Compare with what we expect (just 2024 July-September)
SELECT 
  DATE_TRUNC('month', date)::date as month,
  COUNT(*) as record_count,
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as total_hours
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff ILIKE 'Mark Lane'
  AND billable = true
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;
