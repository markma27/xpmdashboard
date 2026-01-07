-- Final comparison: API vs SQL for Last Year (2024 July-September)

-- What API should return for "Last Year" (July-September only, as these are the months user is looking at)
SELECT 
  'July' as month,
  COUNT(*) as record_count,
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as total_hours,
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
  AND staff ILIKE 'Mark Lane'
  AND billable = true
  AND date >= '2024-07-01'
  AND date <= '2024-07-31'

UNION ALL

SELECT 
  'August' as month,
  COUNT(*) as record_count,
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as total_hours,
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
  AND staff ILIKE 'Mark Lane'
  AND billable = true
  AND date >= '2024-08-01'
  AND date <= '2024-08-31'

UNION ALL

SELECT 
  'September' as month,
  COUNT(*) as record_count,
  SUM(
    CASE 
      WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
      ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
    END
  ) as total_hours,
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
  AND staff ILIKE 'Mark Lane'
  AND billable = true
  AND date >= '2024-09-01'
  AND date <= '2024-09-30';
