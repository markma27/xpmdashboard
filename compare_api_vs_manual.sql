-- Compare API calculation vs manual calculation for Mark Lane July-September 2024
-- This replicates exactly what the Productivity API does

-- API calculation (exactly as in /api/productivity/monthly)
SELECT 
  DATE_TRUNC('month', date)::date as month,
  COUNT(*) as record_count,
  SUM(time) as sum_raw_time,
  -- API conversion logic
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as api_total_hours,
  -- Round to 2 decimal places (as API does)
  ROUND(
    SUM(
      CASE 
        WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
        ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
      END
    ) * 100
  ) / 100 as api_total_hours_rounded
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff = 'Mark Lane'  -- Exact match as API uses
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;

-- Also check if using ILIKE would make a difference (in case of hidden spaces)
SELECT 
  DATE_TRUNC('month', date)::date as month,
  COUNT(*) as record_count,
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as api_total_hours_with_ilike
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff ILIKE 'Mark Lane'  -- Case-insensitive match
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;
