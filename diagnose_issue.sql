-- Final diagnosis: Compare all possible scenarios

-- Scenario 1: All staff (no filter) - This might match frontend numbers
SELECT 
  DATE_TRUNC('month', date)::date as month,
  COUNT(*) as record_count,
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as total_hours_all_staff,
  ROUND(
    SUM(
      CASE 
        WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
        ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
      END
    ) * 100
  ) / 100 as total_hours_rounded
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;

-- Scenario 2: Mark Lane only (with exact match)
SELECT 
  DATE_TRUNC('month', date)::date as month,
  COUNT(*) as record_count,
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as total_hours_mark_lane,
  ROUND(
    SUM(
      CASE 
        WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
        ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
      END
    ) * 100
  ) / 100 as total_hours_rounded
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND staff = 'Mark Lane'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;

-- Scenario 3: Check if frontend numbers (155, 161, 130) match any calculation
-- Frontend shows: July=155, August=161, September=130
-- SQL shows (Mark Lane only): July=90.75, August=100.83, September=82.33
-- Difference: ~64 hours per month, which is roughly 70% more

-- Let's see what other staff have in these months
SELECT 
  DATE_TRUNC('month', date)::date as month,
  COUNT(DISTINCT staff) as staff_count,
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as total_hours_all_staff,
  -- Mark Lane's hours
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) FILTER (WHERE staff = 'Mark Lane') as mark_lane_hours,
  -- Other staff hours
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) FILTER (WHERE staff != 'Mark Lane') as other_staff_hours
FROM timesheet_uploads
WHERE organization_id = '0f0fbad9-48df-4633-b5db-07f21839a8a3'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;
