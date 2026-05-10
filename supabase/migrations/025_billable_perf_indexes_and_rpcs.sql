-- Billable/report performance: indexes, pg_trgm for job_name search, and aggregation RPCs.
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction; Supabase migrations use
-- a transaction wrapper, so we use standard CREATE INDEX IF NOT EXISTS below.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Match TypeScript convertTimeToHours: round first, then HHMM vs minutes interpretation.
CREATE OR REPLACE FUNCTION convert_timesheet_time_to_hours(t numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN t IS NULL OR t <= 0 THEN 0::numeric
    ELSE CASE
      WHEN ROUND(t) < 100 THEN ROUND(t) / 60.0
      ELSE FLOOR(ROUND(t) / 100) + (ROUND(t)::bigint % 100) / 60.0
    END
  END;
$$;

-- =====================================================
-- Composite indexes (common filters + aggregations)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_timesheet_org_date_id
  ON timesheet_uploads (organization_id, date, id);

CREATE INDEX IF NOT EXISTS idx_timesheet_org_billable_date
  ON timesheet_uploads (organization_id, billable, date);

CREATE INDEX IF NOT EXISTS idx_timesheet_org_staff_date
  ON timesheet_uploads (organization_id, staff, date);

CREATE INDEX IF NOT EXISTS idx_timesheet_org_client_group_date
  ON timesheet_uploads (organization_id, client_group, date);

CREATE INDEX IF NOT EXISTS idx_timesheet_org_account_manager_date
  ON timesheet_uploads (organization_id, account_manager, date);

CREATE INDEX IF NOT EXISTS idx_timesheet_org_job_manager_date
  ON timesheet_uploads (organization_id, job_manager, date);

CREATE INDEX IF NOT EXISTS idx_timesheet_org_billable_client_group_date
  ON timesheet_uploads (organization_id, billable, client_group, date);

CREATE INDEX IF NOT EXISTS idx_timesheet_org_billable_account_manager_date
  ON timesheet_uploads (organization_id, billable, account_manager, date);

CREATE INDEX IF NOT EXISTS idx_timesheet_org_billable_job_manager_date
  ON timesheet_uploads (organization_id, billable, job_manager, date);

CREATE INDEX IF NOT EXISTS idx_recoverability_org_date
  ON recoverability_timesheet_uploads (organization_id, date);

CREATE INDEX IF NOT EXISTS idx_recoverability_org_staff_date
  ON recoverability_timesheet_uploads (organization_id, staff, date);

CREATE INDEX IF NOT EXISTS idx_recoverability_org_client_group_date
  ON recoverability_timesheet_uploads (organization_id, client_group, date);

CREATE INDEX IF NOT EXISTS idx_recoverability_org_account_manager_date
  ON recoverability_timesheet_uploads (organization_id, account_manager, date);

CREATE INDEX IF NOT EXISTS idx_recoverability_org_job_manager_date
  ON recoverability_timesheet_uploads (organization_id, job_manager, date);

CREATE INDEX IF NOT EXISTS idx_invoice_org_date
  ON invoice_uploads (organization_id, date);

CREATE INDEX IF NOT EXISTS idx_invoice_org_account_manager_date
  ON invoice_uploads (organization_id, account_manager, date);

CREATE INDEX IF NOT EXISTS idx_invoice_org_job_manager_date
  ON invoice_uploads (organization_id, job_manager, date);

CREATE INDEX IF NOT EXISTS idx_invoice_org_client_group_date
  ON invoice_uploads (organization_id, client_group, date);

CREATE INDEX IF NOT EXISTS idx_wip_org_date
  ON wip_timesheet_uploads (organization_id, date);

CREATE INDEX IF NOT EXISTS idx_wip_org_client_group_date
  ON wip_timesheet_uploads (organization_id, client_group, date);

CREATE INDEX IF NOT EXISTS idx_wip_org_account_manager_date
  ON wip_timesheet_uploads (organization_id, account_manager, date);

CREATE INDEX IF NOT EXISTS idx_wip_org_job_manager_date
  ON wip_timesheet_uploads (organization_id, job_manager, date);

CREATE INDEX IF NOT EXISTS idx_timesheet_uploads_job_name_trgm
  ON timesheet_uploads USING gin (job_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_wip_timesheet_uploads_job_name_trgm
  ON wip_timesheet_uploads USING gin (job_name gin_trgm_ops);

-- =====================================================
-- Billable monthly summary (financial year months July–June)
-- =====================================================

CREATE OR REPLACE FUNCTION get_billable_monthly_summary(
  p_organization_id uuid,
  p_current_year_start date,
  p_current_year_end date,
  p_last_year_start date,
  p_last_year_end date,
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
      COALESCE(SUM(billable_amount), 0)::numeric AS amt
    FROM timesheet_uploads
    WHERE organization_id = p_organization_id
      AND date BETWEEN p_current_year_start AND p_current_year_end
      AND (p_staff IS NULL OR staff = p_staff)
      AND (p_client_group IS NULL OR client_group = p_client_group)
      AND (p_account_manager IS NULL OR account_manager = p_account_manager)
      AND (p_job_manager IS NULL OR job_manager = p_job_manager)
      AND (
        p_job_name IS NULL
        OR btrim(p_job_name) = ''
        OR (
          p_job_name_operator IS NOT DISTINCT FROM 'not_contains'
          AND (job_name IS NULL OR job_name NOT ILIKE ('%' || p_job_name || '%'))
        )
        OR (
          COALESCE(p_job_name_operator, '') IS DISTINCT FROM 'not_contains'
          AND job_name ILIKE ('%' || p_job_name || '%')
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
      COALESCE(SUM(billable_amount), 0)::numeric AS amt
    FROM timesheet_uploads
    WHERE organization_id = p_organization_id
      AND date BETWEEN p_last_year_start AND p_last_year_end
      AND (p_staff IS NULL OR staff = p_staff)
      AND (p_client_group IS NULL OR client_group = p_client_group)
      AND (p_account_manager IS NULL OR account_manager = p_account_manager)
      AND (p_job_manager IS NULL OR job_manager = p_job_manager)
      AND (
        p_job_name IS NULL
        OR btrim(p_job_name) = ''
        OR (
          p_job_name_operator IS NOT DISTINCT FROM 'not_contains'
          AND (job_name IS NULL OR job_name NOT ILIKE ('%' || p_job_name || '%'))
        )
        OR (
          COALESCE(p_job_name_operator, '') IS DISTINCT FROM 'not_contains'
          AND job_name ILIKE ('%' || p_job_name || '%')
        )
      )
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
-- Billable by client group (billable = true only)
-- =====================================================

CREATE OR REPLACE FUNCTION get_billable_client_groups_summary(
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
      COALESCE(NULLIF(btrim(client_group), ''), 'Uncategorized') AS cg,
      date::date AS d,
      COALESCE(billable_amount, 0)::numeric AS amt,
      account_manager,
      job_manager
    FROM timesheet_uploads
    WHERE organization_id = p_organization_id
      AND billable = true
      AND (
        (date BETWEEN p_current_start AND p_current_end)
        OR (date BETWEEN p_last_start AND p_last_end)
      )
      AND (p_staff IS NULL OR staff = p_staff)
      AND (p_client_group IS NULL OR client_group = p_client_group)
      AND (p_account_manager IS NULL OR account_manager = p_account_manager)
      AND (p_job_manager IS NULL OR job_manager = p_job_manager)
      AND (
        p_job_name IS NULL
        OR btrim(p_job_name) = ''
        OR (
          p_job_name_operator IS NOT DISTINCT FROM 'not_contains'
          AND (job_name IS NULL OR job_name NOT ILIKE ('%' || p_job_name || '%'))
        )
        OR (
          COALESCE(p_job_name_operator, '') IS DISTINCT FROM 'not_contains'
          AND job_name ILIKE ('%' || p_job_name || '%')
        )
      )
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
-- Distinct filter values (trimmed, non-empty, sorted)
-- =====================================================

CREATE OR REPLACE FUNCTION get_billable_filter_options(p_organization_id uuid)
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
           FROM timesheet_uploads
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
           FROM timesheet_uploads
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
           FROM timesheet_uploads
           WHERE organization_id = p_organization_id
             AND job_manager IS NOT NULL AND btrim(job_manager::text) <> ''
         ) x),
        '[]'::jsonb
      ),
    'staff',
      COALESCE(
        (SELECT jsonb_agg(x.v ORDER BY x.v)
         FROM (
           SELECT DISTINCT btrim(staff) AS v
           FROM timesheet_uploads
           WHERE organization_id = p_organization_id
             AND staff IS NOT NULL AND btrim(staff) <> ''
         ) x),
        '[]'::jsonb
      )
  );
$$;

-- =====================================================
-- Billable report staff list (matches /api/billable/staff)
-- =====================================================

CREATE OR REPLACE FUNCTION get_billable_report_staff(
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
      SUM(CASE WHEN date BETWEEN p_current_year_start AND p_current_year_end
               THEN COALESCE(billable_amount, 0) ELSE 0 END)::numeric AS cy,
      SUM(CASE WHEN date BETWEEN p_last_year_start AND p_last_year_end
               THEN COALESCE(billable_amount, 0) ELSE 0 END)::numeric AS ly
    FROM timesheet_uploads
    WHERE organization_id = p_organization_id
      AND staff IS NOT NULL
      AND lower(btrim(staff)) <> 'disbursement'
    GROUP BY btrim(staff)
  ),
  excluded AS (
    SELECT staff_name
    FROM staff_settings
    WHERE organization_id = p_organization_id
      AND report = false
  )
  SELECT COALESCE(
    (SELECT jsonb_agg(a.staff_name ORDER BY a.staff_name)
     FROM agg a
     LEFT JOIN excluded e ON e.staff_name = a.staff_name
     WHERE e.staff_name IS NULL
       AND (ROUND(a.cy) > 0 OR ROUND(a.ly) > 0)),
    '[]'::jsonb
  );
$$;

-- =====================================================
-- Dashboard KPIs with billable slice filters (revenue + WIP unfiltered)
-- =====================================================

CREATE OR REPLACE FUNCTION get_dashboard_kpis_filtered(
  p_organization_id uuid,
  p_current_year_start date,
  p_current_year_end date,
  p_last_year_start date,
  p_last_year_end date,
  p_staff text DEFAULT NULL,
  p_client_group text DEFAULT NULL,
  p_account_manager text DEFAULT NULL,
  p_job_manager text DEFAULT NULL,
  p_job_name text DEFAULT NULL,
  p_job_name_operator text DEFAULT NULL
)
RETURNS TABLE (
  current_year_revenue numeric,
  last_year_revenue numeric,
  current_year_billable numeric,
  last_year_billable numeric,
  total_wip numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COALESCE(SUM(amount), 0) FROM invoice_uploads
     WHERE organization_id = p_organization_id
       AND date BETWEEN p_current_year_start AND p_current_year_end),
    (SELECT COALESCE(SUM(amount), 0) FROM invoice_uploads
     WHERE organization_id = p_organization_id
       AND date BETWEEN p_last_year_start AND p_last_year_end),
    (SELECT COALESCE(SUM(billable_amount), 0) FROM timesheet_uploads
     WHERE organization_id = p_organization_id
       AND billable = true
       AND date BETWEEN p_current_year_start AND p_current_year_end
       AND (p_staff IS NULL OR staff = p_staff)
       AND (p_client_group IS NULL OR client_group = p_client_group)
       AND (p_account_manager IS NULL OR account_manager = p_account_manager)
       AND (p_job_manager IS NULL OR job_manager = p_job_manager)
       AND (
         p_job_name IS NULL
         OR btrim(p_job_name) = ''
         OR (
           p_job_name_operator IS NOT DISTINCT FROM 'not_contains'
           AND (job_name IS NULL OR job_name NOT ILIKE ('%' || p_job_name || '%'))
         )
         OR (
           COALESCE(p_job_name_operator, '') IS DISTINCT FROM 'not_contains'
           AND job_name ILIKE ('%' || p_job_name || '%')
         )
       )),
    (SELECT COALESCE(SUM(billable_amount), 0) FROM timesheet_uploads
     WHERE organization_id = p_organization_id
       AND billable = true
       AND date BETWEEN p_last_year_start AND p_last_year_end
       AND (p_staff IS NULL OR staff = p_staff)
       AND (p_client_group IS NULL OR client_group = p_client_group)
       AND (p_account_manager IS NULL OR account_manager = p_account_manager)
       AND (p_job_manager IS NULL OR job_manager = p_job_manager)
       AND (
         p_job_name IS NULL
         OR btrim(p_job_name) = ''
         OR (
           p_job_name_operator IS NOT DISTINCT FROM 'not_contains'
           AND (job_name IS NULL OR job_name NOT ILIKE ('%' || p_job_name || '%'))
         )
         OR (
           COALESCE(p_job_name_operator, '') IS DISTINCT FROM 'not_contains'
           AND job_name ILIKE ('%' || p_job_name || '%')
         )
       )),
    (SELECT COALESCE(SUM(billable_amount), 0) FROM wip_timesheet_uploads
     WHERE organization_id = p_organization_id);
$$;

-- =====================================================
-- Recoverability KPI period totals
-- =====================================================

CREATE OR REPLACE FUNCTION get_recoverability_kpi_totals(
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
RETURNS TABLE (
  current_write_on numeric,
  current_invoiced numeric,
  last_write_on numeric,
  last_invoiced numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COALESCE(SUM(write_on_amount), 0) FROM recoverability_timesheet_uploads
     WHERE organization_id = p_organization_id
       AND date BETWEEN p_current_start AND p_current_end
       AND (p_staff IS NULL OR staff = p_staff)
       AND (p_client_group IS NULL OR client_group = p_client_group)
       AND (p_account_manager IS NULL OR account_manager = p_account_manager)
       AND (p_job_manager IS NULL OR job_manager = p_job_manager)),
    (SELECT COALESCE(SUM(invoiced_amount), 0) FROM recoverability_timesheet_uploads
     WHERE organization_id = p_organization_id
       AND date BETWEEN p_current_start AND p_current_end
       AND (p_staff IS NULL OR staff = p_staff)
       AND (p_client_group IS NULL OR client_group = p_client_group)
       AND (p_account_manager IS NULL OR account_manager = p_account_manager)
       AND (p_job_manager IS NULL OR job_manager = p_job_manager)),
    (SELECT COALESCE(SUM(write_on_amount), 0) FROM recoverability_timesheet_uploads
     WHERE organization_id = p_organization_id
       AND date BETWEEN p_last_start AND p_last_end
       AND (p_staff IS NULL OR staff = p_staff)
       AND (p_client_group IS NULL OR client_group = p_client_group)
       AND (p_account_manager IS NULL OR account_manager = p_account_manager)
       AND (p_job_manager IS NULL OR job_manager = p_job_manager)),
    (SELECT COALESCE(SUM(invoiced_amount), 0) FROM recoverability_timesheet_uploads
     WHERE organization_id = p_organization_id
       AND date BETWEEN p_last_start AND p_last_end
       AND (p_staff IS NULL OR staff = p_staff)
       AND (p_client_group IS NULL OR client_group = p_client_group)
       AND (p_account_manager IS NULL OR account_manager = p_account_manager)
       AND (p_job_manager IS NULL OR job_manager = p_job_manager));
$$;

-- =====================================================
-- Productivity aggregates (billable + capacity reducing + FY staff hours)
-- =====================================================

CREATE OR REPLACE FUNCTION get_productivity_billable_totals(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_staff text DEFAULT NULL,
  p_client_group text DEFAULT NULL,
  p_account_manager text DEFAULT NULL,
  p_job_manager text DEFAULT NULL,
  p_job_name text DEFAULT NULL,
  p_job_name_operator text DEFAULT NULL
)
RETURNS TABLE (total_hours numeric, total_amount numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(convert_timesheet_time_to_hours("time")), 0)::numeric,
    COALESCE(SUM(billable_amount), 0)::numeric
  FROM timesheet_uploads
  WHERE organization_id = p_organization_id
    AND billable = true
    AND date BETWEEN p_start_date AND p_end_date
    AND (p_staff IS NULL OR staff ILIKE p_staff)
    AND (p_client_group IS NULL OR client_group = p_client_group)
    AND (p_account_manager IS NULL OR account_manager = p_account_manager)
    AND (p_job_manager IS NULL OR job_manager = p_job_manager)
    AND (
      p_job_name IS NULL
      OR btrim(p_job_name) = ''
      OR (
        p_job_name_operator IS NOT DISTINCT FROM 'not_contains'
        AND (job_name IS NULL OR job_name NOT ILIKE ('%' || p_job_name || '%'))
      )
      OR (
        COALESCE(p_job_name_operator, '') IS DISTINCT FROM 'not_contains'
        AND job_name ILIKE ('%' || p_job_name || '%')
      )
    );
$$;

CREATE OR REPLACE FUNCTION get_productivity_capacity_reducing_hours(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_staff text DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(convert_timesheet_time_to_hours("time")), 0)::numeric
  FROM timesheet_uploads
  WHERE organization_id = p_organization_id
    AND capacity_reducing = true
    AND date BETWEEN p_start_date AND p_end_date
    AND (p_staff IS NULL OR staff ILIKE p_staff);
$$;

CREATE OR REPLACE FUNCTION get_productivity_staff_fy_hours(
  p_organization_id uuid,
  p_current_fy_start date,
  p_current_fy_end date,
  p_last_fy_start date,
  p_last_fy_end date
)
RETURNS TABLE (staff text, cy_hours numeric, ly_hours numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    btrim(t.staff),
    COALESCE(SUM(CASE WHEN t.date BETWEEN p_current_fy_start AND p_current_fy_end
                      THEN convert_timesheet_time_to_hours(t."time") END), 0)::numeric,
    COALESCE(SUM(CASE WHEN t.date BETWEEN p_last_fy_start AND p_last_fy_end
                      THEN convert_timesheet_time_to_hours(t."time") END), 0)::numeric
  FROM timesheet_uploads t
  WHERE t.organization_id = p_organization_id
    AND t.billable = true
    AND lower(btrim(t.staff)) <> 'disbursement'
    AND (
      t.date BETWEEN p_current_fy_start AND p_current_fy_end
      OR t.date BETWEEN p_last_fy_start AND p_last_fy_end
    )
  GROUP BY btrim(t.staff);
$$;

-- Align older helpers with convert_timesheet_time_to_hours
CREATE OR REPLACE FUNCTION get_billable_hours_and_amount(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_staff text DEFAULT NULL
)
RETURNS TABLE (total_hours numeric, total_amount numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(convert_timesheet_time_to_hours(t."time")), 0)::numeric,
    COALESCE(SUM(t.billable_amount), 0)::numeric
  FROM timesheet_uploads t
  WHERE t.organization_id = p_organization_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND t.billable = true
    AND (p_staff IS NULL OR t.staff = p_staff);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_capacity_reducing_hours(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_staff text DEFAULT NULL
)
RETURNS numeric AS $$
DECLARE
  total numeric;
BEGIN
  SELECT COALESCE(SUM(convert_timesheet_time_to_hours("time")), 0) INTO total
  FROM timesheet_uploads
  WHERE organization_id = p_organization_id
    AND date BETWEEN p_start_date AND p_end_date
    AND capacity_reducing = true
    AND (p_staff IS NULL OR staff = p_staff);
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Grants
-- =====================================================

GRANT EXECUTE ON FUNCTION convert_timesheet_time_to_hours(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION get_billable_monthly_summary(uuid, date, date, date, date, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_billable_client_groups_summary(uuid, date, date, date, date, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_billable_filter_options(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_billable_report_staff(uuid, date, date, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_kpis_filtered(uuid, date, date, date, date, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recoverability_kpi_totals(uuid, date, date, date, date, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_productivity_billable_totals(uuid, date, date, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_productivity_capacity_reducing_hours(uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_productivity_staff_fy_hours(uuid, date, date, date, date) TO authenticated;
