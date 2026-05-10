-- More report/dashboard routes: SQL aggregation for recoverability, productivity, staff performance.

-- =====================================================
-- Recoverability distinct filter values
-- =====================================================

CREATE OR REPLACE FUNCTION get_recoverability_filter_options(p_organization_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'clientGroups',
      COALESCE(
        (SELECT jsonb_agg(x.v ORDER BY x.v)
         FROM (
           SELECT DISTINCT btrim(client_group) AS v
           FROM recoverability_timesheet_uploads
           WHERE organization_id = p_organization_id
             AND client_group IS NOT NULL AND btrim(client_group) <> ''
         ) x),
        '[]'::jsonb
      ),
    'accountManagers',
      COALESCE(
        (SELECT jsonb_agg(x.v ORDER BY x.v)
         FROM (
           SELECT DISTINCT btrim(account_manager::text) AS v
           FROM recoverability_timesheet_uploads
           WHERE organization_id = p_organization_id
             AND account_manager IS NOT NULL AND btrim(account_manager::text) <> ''
         ) x),
        '[]'::jsonb
      ),
    'jobManagers',
      COALESCE(
        (SELECT jsonb_agg(x.v ORDER BY x.v)
         FROM (
           SELECT DISTINCT btrim(job_manager::text) AS v
           FROM recoverability_timesheet_uploads
           WHERE organization_id = p_organization_id
             AND job_manager IS NOT NULL AND btrim(job_manager::text) <> ''
         ) x),
        '[]'::jsonb
      )
  );
$$;

-- =====================================================
-- Recoverability monthly write-on (July–June FY slots)
-- =====================================================

CREATE OR REPLACE FUNCTION get_recoverability_monthly_write_on_summary(
  p_organization_id uuid,
  p_current_year_start date,
  p_current_year_end date,
  p_last_year_start date,
  p_last_year_end date,
  p_staff text DEFAULT NULL,
  p_client_group text DEFAULT NULL,
  p_account_manager text DEFAULT NULL,
  p_job_manager text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH months AS (
    SELECT * FROM (VALUES
      (0, 'July'), (1, 'August'), (2, 'September'), (3, 'October'),
      (4, 'November'), (5, 'December'), (6, 'January'), (7, 'February'),
      (8, 'March'), (9, 'April'), (10, 'May'), (11, 'June')
    ) AS m(slot, label)
  ),
  cy AS (
    SELECT
      CASE
        WHEN EXTRACT(MONTH FROM date)::int >= 7 THEN EXTRACT(MONTH FROM date)::int - 7
        ELSE EXTRACT(MONTH FROM date)::int + 5
      END AS slot,
      COALESCE(SUM(write_on_amount), 0)::numeric AS amt
    FROM recoverability_timesheet_uploads
    WHERE organization_id = p_organization_id
      AND date BETWEEN p_current_year_start AND p_current_year_end
      AND (p_staff IS NULL OR staff = p_staff)
      AND (p_client_group IS NULL OR client_group = p_client_group)
      AND (p_account_manager IS NULL OR account_manager = p_account_manager)
      AND (p_job_manager IS NULL OR job_manager = p_job_manager)
    GROUP BY 1
  ),
  ly AS (
    SELECT
      CASE
        WHEN EXTRACT(MONTH FROM date)::int >= 7 THEN EXTRACT(MONTH FROM date)::int - 7
        ELSE EXTRACT(MONTH FROM date)::int + 5
      END AS slot,
      COALESCE(SUM(write_on_amount), 0)::numeric AS amt
    FROM recoverability_timesheet_uploads
    WHERE organization_id = p_organization_id
      AND date BETWEEN p_last_year_start AND p_last_year_end
      AND (p_staff IS NULL OR staff = p_staff)
      AND (p_client_group IS NULL OR client_group = p_client_group)
      AND (p_account_manager IS NULL OR account_manager = p_account_manager)
      AND (p_job_manager IS NULL OR job_manager = p_job_manager)
    GROUP BY 1
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'month', mo.label,
        'Current Year', COALESCE(c.amt, 0),
        'Last Year', COALESCE(l.amt, 0)
      )
      ORDER BY mo.slot
    ),
    '[]'::jsonb
  )
  FROM months mo
  LEFT JOIN cy c ON c.slot = mo.slot
  LEFT JOIN ly l ON l.slot = mo.slot;
$$;

-- =====================================================
-- Recoverability by client group (write_on_amount)
-- =====================================================

CREATE OR REPLACE FUNCTION get_recoverability_client_groups_summary(
  p_organization_id uuid,
  p_current_start date,
  p_current_end date,
  p_last_start date,
  p_last_end date,
  p_staff text DEFAULT NULL,
  p_client_group text DEFAULT NULL,
  p_account_manager text DEFAULT NULL,
  p_job_manager text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(btrim(client_group), ''), 'Uncategorized') AS cg,
      date::date AS d,
      COALESCE(write_on_amount, 0)::numeric AS amt,
      account_manager,
      job_manager
    FROM recoverability_timesheet_uploads
    WHERE organization_id = p_organization_id
      AND (
        (date BETWEEN p_current_start AND p_current_end)
        OR (date BETWEEN p_last_start AND p_last_end)
      )
      AND (p_staff IS NULL OR staff = p_staff)
      AND (p_client_group IS NULL OR client_group = p_client_group)
      AND (p_account_manager IS NULL OR account_manager = p_account_manager)
      AND (p_job_manager IS NULL OR job_manager = p_job_manager)
  ),
  amounts AS (
    SELECT
      cg,
      SUM(CASE WHEN d BETWEEN p_current_start AND p_current_end THEN amt ELSE 0 END) AS cy,
      SUM(CASE WHEN d BETWEEN p_last_start AND p_last_end THEN amt ELSE 0 END) AS ly
    FROM base
    GROUP BY cg
  ),
  am_counts AS (
    SELECT cg, account_manager AS mgr, COUNT(*)::bigint AS c
    FROM base
    WHERE account_manager IS NOT NULL AND btrim(account_manager) <> ''
    GROUP BY cg, account_manager
  ),
  am_top AS (
    SELECT DISTINCT ON (cg) cg, mgr AS partner
    FROM am_counts
    ORDER BY cg, c DESC, mgr ASC
  ),
  jm_counts AS (
    SELECT cg, job_manager AS mgr, COUNT(*)::bigint AS c
    FROM base
    WHERE job_manager IS NOT NULL AND btrim(job_manager) <> ''
    GROUP BY cg, job_manager
  ),
  jm_top AS (
    SELECT DISTINCT ON (cg) cg, mgr AS client_manager
    FROM jm_counts
    ORDER BY cg, c DESC, mgr ASC
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'clientGroup', a.cg,
        'currentYear', a.cy,
        'lastYear', a.ly,
        'partner', am.partner,
        'clientManager', jm.client_manager
      )
      ORDER BY a.cy DESC, a.cg ASC
    ),
    '[]'::jsonb
  )
  FROM amounts a
  LEFT JOIN am_top am ON am.cg = a.cg
  LEFT JOIN jm_top jm ON jm.cg = a.cg;
$$;

-- =====================================================
-- Productivity: monthly billable hours (partial CY + full LY)
-- =====================================================

CREATE OR REPLACE FUNCTION get_productivity_monthly_billable_hours(
  p_organization_id uuid,
  p_current_start date,
  p_current_end date,
  p_last_start date,
  p_last_end date,
  p_staff text DEFAULT NULL,
  p_client_group text DEFAULT NULL,
  p_account_manager text DEFAULT NULL,
  p_job_manager text DEFAULT NULL,
  p_job_name text DEFAULT NULL,
  p_job_name_operator text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH months AS (
    SELECT * FROM (VALUES
      (0, 'July'), (1, 'August'), (2, 'September'), (3, 'October'),
      (4, 'November'), (5, 'December'), (6, 'January'), (7, 'February'),
      (8, 'March'), (9, 'April'), (10, 'May'), (11, 'June')
    ) AS m(slot, label)
  ),
  cy AS (
    SELECT
      CASE
        WHEN EXTRACT(MONTH FROM date)::int >= 7 THEN EXTRACT(MONTH FROM date)::int - 7
        ELSE EXTRACT(MONTH FROM date)::int + 5
      END AS slot,
      COALESCE(SUM(convert_timesheet_time_to_hours(t."time")), 0)::numeric AS hrs
    FROM timesheet_uploads t
    WHERE t.organization_id = p_organization_id
      AND t.billable = true
      AND t.date BETWEEN p_current_start AND p_current_end
      AND (p_staff IS NULL OR t.staff ILIKE p_staff)
      AND (p_client_group IS NULL OR t.client_group = p_client_group)
      AND (p_account_manager IS NULL OR t.account_manager = p_account_manager)
      AND (p_job_manager IS NULL OR t.job_manager = p_job_manager)
      AND (
        p_job_name IS NULL
        OR btrim(p_job_name) = ''
        OR (
          p_job_name_operator IS NOT DISTINCT FROM 'not_contains'
          AND (t.job_name IS NULL OR t.job_name NOT ILIKE ('%' || p_job_name || '%'))
        )
        OR (
          COALESCE(p_job_name_operator, '') IS DISTINCT FROM 'not_contains'
          AND t.job_name ILIKE ('%' || p_job_name || '%')
        )
      )
    GROUP BY 1
  ),
  ly AS (
    SELECT
      CASE
        WHEN EXTRACT(MONTH FROM date)::int >= 7 THEN EXTRACT(MONTH FROM date)::int - 7
        ELSE EXTRACT(MONTH FROM date)::int + 5
      END AS slot,
      COALESCE(SUM(convert_timesheet_time_to_hours(t."time")), 0)::numeric AS hrs
    FROM timesheet_uploads t
    WHERE t.organization_id = p_organization_id
      AND t.billable = true
      AND t.date BETWEEN p_last_start AND p_last_end
      AND (p_staff IS NULL OR t.staff ILIKE p_staff)
      AND (p_client_group IS NULL OR t.client_group = p_client_group)
      AND (p_account_manager IS NULL OR t.account_manager = p_account_manager)
      AND (p_job_manager IS NULL OR t.job_manager = p_job_manager)
      AND (
        p_job_name IS NULL
        OR btrim(p_job_name) = ''
        OR (
          p_job_name_operator IS NOT DISTINCT FROM 'not_contains'
          AND (t.job_name IS NULL OR t.job_name NOT ILIKE ('%' || p_job_name || '%'))
        )
        OR (
          COALESCE(p_job_name_operator, '') IS DISTINCT FROM 'not_contains'
          AND t.job_name ILIKE ('%' || p_job_name || '%')
        )
      )
    GROUP BY 1
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'month', mo.label,
        'Current Year', ROUND(COALESCE(c.hrs, 0)::numeric, 2),
        'Last Year', ROUND(COALESCE(l.hrs, 0)::numeric, 2)
      )
      ORDER BY mo.slot
    ),
    '[]'::jsonb
  )
  FROM months mo
  LEFT JOIN cy c ON c.slot = mo.slot
  LEFT JOIN ly l ON l.slot = mo.slot;
$$;

-- =====================================================
-- Productivity client groups: hours + amounts, billable only
-- =====================================================

CREATE OR REPLACE FUNCTION get_productivity_client_groups_summary(
  p_organization_id uuid,
  p_current_start date,
  p_current_end date,
  p_last_start date,
  p_last_end date,
  p_staff text DEFAULT NULL,
  p_client_group text DEFAULT NULL,
  p_account_manager text DEFAULT NULL,
  p_job_manager text DEFAULT NULL,
  p_job_name text DEFAULT NULL,
  p_job_name_operator text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(btrim(t.client_group), ''), 'Uncategorized') AS cg,
      t.date::date AS d,
      convert_timesheet_time_to_hours(t."time") AS h,
      COALESCE(t.billable_amount, 0)::numeric AS amt,
      t.account_manager,
      t.job_manager
    FROM timesheet_uploads t
    WHERE t.organization_id = p_organization_id
      AND t.billable = true
      AND (
        (t.date BETWEEN p_current_start AND p_current_end)
        OR (t.date BETWEEN p_last_start AND p_last_end)
      )
      AND (p_staff IS NULL OR t.staff ILIKE p_staff)
      AND (p_client_group IS NULL OR t.client_group = p_client_group)
      AND (p_account_manager IS NULL OR t.account_manager = p_account_manager)
      AND (p_job_manager IS NULL OR t.job_manager = p_job_manager)
      AND (
        p_job_name IS NULL
        OR btrim(p_job_name) = ''
        OR (
          p_job_name_operator IS NOT DISTINCT FROM 'not_contains'
          AND (t.job_name IS NULL OR t.job_name NOT ILIKE ('%' || p_job_name || '%'))
        )
        OR (
          COALESCE(p_job_name_operator, '') IS DISTINCT FROM 'not_contains'
          AND t.job_name ILIKE ('%' || p_job_name || '%')
        )
      )
  ),
  amounts AS (
    SELECT
      cg,
      SUM(CASE WHEN d BETWEEN p_current_start AND p_current_end THEN h ELSE 0 END) AS cy_h,
      SUM(CASE WHEN d BETWEEN p_last_start AND p_last_end THEN h ELSE 0 END) AS ly_h,
      SUM(CASE WHEN d BETWEEN p_current_start AND p_current_end THEN amt ELSE 0 END) AS cy_amt,
      SUM(CASE WHEN d BETWEEN p_last_start AND p_last_end THEN amt ELSE 0 END) AS ly_amt
    FROM base
    GROUP BY cg
  ),
  am_counts AS (
    SELECT cg, account_manager AS mgr, COUNT(*)::bigint AS c
    FROM base
    WHERE account_manager IS NOT NULL AND btrim(account_manager) <> ''
    GROUP BY cg, account_manager
  ),
  am_top AS (
    SELECT DISTINCT ON (cg) cg, mgr AS partner
    FROM am_counts
    ORDER BY cg, c DESC, mgr ASC
  ),
  jm_counts AS (
    SELECT cg, job_manager AS mgr, COUNT(*)::bigint AS c
    FROM base
    WHERE job_manager IS NOT NULL AND btrim(job_manager) <> ''
    GROUP BY cg, job_manager
  ),
  jm_top AS (
    SELECT DISTINCT ON (cg) cg, mgr AS client_manager
    FROM jm_counts
    ORDER BY cg, c DESC, mgr ASC
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'clientGroup', a.cg,
        'currentYear', ROUND(a.cy_h::numeric, 2),
        'lastYear', ROUND(a.ly_h::numeric, 2),
        'currentYearAmount', ROUND(a.cy_amt::numeric, 2),
        'lastYearAmount', ROUND(a.ly_amt::numeric, 2),
        'partner', am.partner,
        'clientManager', jm.client_manager
      )
      ORDER BY a.cy_h DESC, a.cg ASC
    ),
    '[]'::jsonb
  )
  FROM amounts a
  LEFT JOIN am_top am ON am.cg = a.cg
  LEFT JOIN jm_top jm ON jm.cg = a.cg;
$$;

-- =====================================================
-- Productivity staff dropdown: billable hours CY/LY (rounded) > 0
-- =====================================================

CREATE OR REPLACE FUNCTION get_productivity_eligible_staff(
  p_organization_id uuid,
  p_current_year_start date,
  p_current_year_end date,
  p_last_year_start date,
  p_last_year_end date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      btrim(staff) AS staff_name,
      SUM(
        CASE
          WHEN date BETWEEN p_current_year_start AND p_current_year_end
          THEN convert_timesheet_time_to_hours("time")
          ELSE 0
        END
      )::numeric AS cy,
      SUM(
        CASE
          WHEN date BETWEEN p_last_year_start AND p_last_year_end
          THEN convert_timesheet_time_to_hours("time")
          ELSE 0
        END
      )::numeric AS ly
    FROM timesheet_uploads
    WHERE organization_id = p_organization_id
      AND billable = true
      AND staff IS NOT NULL
      AND lower(btrim(staff)) <> 'disbursement'
      AND (
        date BETWEEN p_current_year_start AND p_current_year_end
        OR date BETWEEN p_last_year_start AND p_last_year_end
      )
    GROUP BY btrim(staff)
  ),
  excluded AS (
    SELECT staff_name
    FROM staff_settings
    WHERE organization_id = p_organization_id
      AND (is_hidden = true OR report = false)
  )
  SELECT COALESCE(
    (SELECT jsonb_agg(a.staff_name ORDER BY a.staff_name)
     FROM agg a
     WHERE NOT EXISTS (SELECT 1 FROM excluded e WHERE e.staff_name = a.staff_name)
       AND (
         ROUND(a.cy::numeric * 100) / 100 > 0
         OR ROUND(a.ly::numeric * 100) / 100 > 0
       )),
    '[]'::jsonb
  );
$$;

-- =====================================================
-- Dashboard staff performance: per-staff aggregates (YTD)
-- =====================================================

CREATE OR REPLACE FUNCTION get_staff_performance_timesheet_by_staff(
  p_organization_id uuid,
  p_start date,
  p_end date,
  p_client_group text DEFAULT NULL,
  p_account_manager text DEFAULT NULL,
  p_job_manager text DEFAULT NULL,
  p_job_name text DEFAULT NULL,
  p_job_name_operator text DEFAULT NULL
)
RETURNS TABLE (staff text, total_amount numeric, total_hours numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    btrim(t.staff) AS staff,
    COALESCE(SUM(t.billable_amount), 0)::numeric AS total_amount,
    COALESCE(SUM(convert_timesheet_time_to_hours(t."time")), 0)::numeric AS total_hours
  FROM timesheet_uploads t
  WHERE t.organization_id = p_organization_id
    AND t.date BETWEEN p_start AND p_end
    AND t.staff IS NOT NULL
    AND lower(btrim(t.staff)) <> 'disbursement'
    AND (p_client_group IS NULL OR t.client_group = p_client_group)
    AND (p_account_manager IS NULL OR t.account_manager = p_account_manager)
    AND (p_job_manager IS NULL OR t.job_manager = p_job_manager)
    AND (
      p_job_name IS NULL
      OR btrim(p_job_name) = ''
      OR (
        p_job_name_operator IS NOT DISTINCT FROM 'not_contains'
        AND (t.job_name IS NULL OR t.job_name NOT ILIKE ('%' || p_job_name || '%'))
      )
      OR (
        COALESCE(p_job_name_operator, '') IS DISTINCT FROM 'not_contains'
        AND t.job_name ILIKE ('%' || p_job_name || '%')
      )
    )
  GROUP BY btrim(t.staff);
$$;

CREATE OR REPLACE FUNCTION get_staff_performance_billable_hours_by_staff(
  p_organization_id uuid,
  p_start date,
  p_end date,
  p_client_group text DEFAULT NULL,
  p_account_manager text DEFAULT NULL,
  p_job_manager text DEFAULT NULL,
  p_job_name text DEFAULT NULL,
  p_job_name_operator text DEFAULT NULL
)
RETURNS TABLE (staff text, billable_hours numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    btrim(t.staff) AS staff,
    COALESCE(SUM(convert_timesheet_time_to_hours(t."time")), 0)::numeric AS billable_hours
  FROM timesheet_uploads t
  WHERE t.organization_id = p_organization_id
    AND t.billable = true
    AND t.date BETWEEN p_start AND p_end
    AND t.staff IS NOT NULL
    AND lower(btrim(t.staff)) <> 'disbursement'
    AND (p_client_group IS NULL OR t.client_group = p_client_group)
    AND (p_account_manager IS NULL OR t.account_manager = p_account_manager)
    AND (p_job_manager IS NULL OR t.job_manager = p_job_manager)
    AND (
      p_job_name IS NULL
      OR btrim(p_job_name) = ''
      OR (
        p_job_name_operator IS NOT DISTINCT FROM 'not_contains'
        AND (t.job_name IS NULL OR t.job_name NOT ILIKE ('%' || p_job_name || '%'))
      )
      OR (
        COALESCE(p_job_name_operator, '') IS DISTINCT FROM 'not_contains'
        AND t.job_name ILIKE ('%' || p_job_name || '%')
      )
    )
  GROUP BY btrim(t.staff);
$$;

CREATE OR REPLACE FUNCTION get_staff_performance_recoverability_by_staff(
  p_organization_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE (staff text, write_on numeric, invoiced numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    btrim(r.staff) AS staff,
    COALESCE(SUM(r.write_on_amount), 0)::numeric AS write_on,
    COALESCE(SUM(r.invoiced_amount), 0)::numeric AS invoiced
  FROM recoverability_timesheet_uploads r
  WHERE r.organization_id = p_organization_id
    AND r.date BETWEEN p_start AND p_end
    AND r.staff IS NOT NULL
    AND lower(btrim(r.staff)) <> 'disbursement'
  GROUP BY btrim(r.staff);
$$;

CREATE OR REPLACE FUNCTION get_staff_performance_capacity_by_staff(
  p_organization_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE (staff text, capacity_hours numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    btrim(t.staff) AS staff,
    COALESCE(SUM(convert_timesheet_time_to_hours(t."time")), 0)::numeric AS capacity_hours
  FROM timesheet_uploads t
  WHERE t.organization_id = p_organization_id
    AND t.capacity_reducing = true
    AND t.date BETWEEN p_start AND p_end
    AND t.staff IS NOT NULL
    AND lower(btrim(t.staff)) <> 'disbursement'
  GROUP BY btrim(t.staff);
$$;

-- =====================================================
-- Grants
-- =====================================================

GRANT EXECUTE ON FUNCTION get_recoverability_filter_options(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recoverability_monthly_write_on_summary(uuid, date, date, date, date, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recoverability_client_groups_summary(uuid, date, date, date, date, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_productivity_monthly_billable_hours(uuid, date, date, date, date, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_productivity_client_groups_summary(uuid, date, date, date, date, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_productivity_eligible_staff(uuid, date, date, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_staff_performance_timesheet_by_staff(uuid, date, date, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_staff_performance_billable_hours_by_staff(uuid, date, date, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_staff_performance_recoverability_by_staff(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_staff_performance_capacity_by_staff(uuid, date, date) TO authenticated;
