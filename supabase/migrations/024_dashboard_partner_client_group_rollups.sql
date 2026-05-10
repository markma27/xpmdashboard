-- Dashboard partner / client-group charts: aggregate in Postgres (one round-trip per chart).
-- Billable rollups use billable = true to match get_dashboard_kpis (see 023).

CREATE OR REPLACE FUNCTION get_dashboard_billable_by_partner(
  p_organization_id UUID,
  p_current_year_start DATE,
  p_current_year_end DATE,
  p_last_year_start DATE,
  p_last_year_end DATE
)
RETURNS TABLE (
  partner TEXT,
  current_year_total NUMERIC,
  last_year_total NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(NULLIF(TRIM(t.account_manager), ''), 'Uncategorized') AS partner,
    ROUND(COALESCE(SUM(t.billable_amount) FILTER (
      WHERE t.date BETWEEN p_current_year_start AND p_current_year_end
    ), 0)::numeric, 2) AS current_year_total,
    ROUND(COALESCE(SUM(t.billable_amount) FILTER (
      WHERE t.date BETWEEN p_last_year_start AND p_last_year_end
    ), 0)::numeric, 2) AS last_year_total
  FROM timesheet_uploads t
  WHERE t.organization_id = p_organization_id
    AND t.billable = true
    AND t.date BETWEEN LEAST(p_current_year_start, p_last_year_start)
                 AND GREATEST(p_current_year_end, p_last_year_end)
  GROUP BY 1
  ORDER BY current_year_total DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_dashboard_revenue_by_partner(
  p_organization_id UUID,
  p_current_year_start DATE,
  p_current_year_end DATE,
  p_last_year_start DATE,
  p_last_year_end DATE
)
RETURNS TABLE (
  partner TEXT,
  current_year_total NUMERIC,
  last_year_total NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(NULLIF(TRIM(i.account_manager), ''), 'Uncategorized') AS partner,
    ROUND(COALESCE(SUM(i.amount) FILTER (
      WHERE i.date BETWEEN p_current_year_start AND p_current_year_end
    ), 0)::numeric, 2) AS current_year_total,
    ROUND(COALESCE(SUM(i.amount) FILTER (
      WHERE i.date BETWEEN p_last_year_start AND p_last_year_end
    ), 0)::numeric, 2) AS last_year_total
  FROM invoice_uploads i
  WHERE i.organization_id = p_organization_id
    AND i.date BETWEEN LEAST(p_current_year_start, p_last_year_start)
                   AND GREATEST(p_current_year_end, p_last_year_end)
  GROUP BY 1
  ORDER BY current_year_total DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_dashboard_billable_by_client_group(
  p_organization_id UUID,
  p_current_year_start DATE,
  p_current_year_end DATE,
  p_last_year_start DATE,
  p_last_year_end DATE,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  client_group TEXT,
  current_year_total NUMERIC,
  last_year_total NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH agg AS (
    SELECT
      COALESCE(NULLIF(TRIM(t.client_group), ''), 'Uncategorized') AS grp,
      ROUND(COALESCE(SUM(t.billable_amount) FILTER (
        WHERE t.date BETWEEN p_current_year_start AND p_current_year_end
      ), 0)::numeric, 2) AS cy,
      ROUND(COALESCE(SUM(t.billable_amount) FILTER (
        WHERE t.date BETWEEN p_last_year_start AND p_last_year_end
      ), 0)::numeric, 2) AS ly
    FROM timesheet_uploads t
    WHERE t.organization_id = p_organization_id
      AND t.billable = true
      AND t.date BETWEEN LEAST(p_current_year_start, p_last_year_start)
                   AND GREATEST(p_current_year_end, p_last_year_end)
    GROUP BY 1
  )
  SELECT a.grp AS client_group, a.cy AS current_year_total, a.ly AS last_year_total
  FROM agg a
  ORDER BY a.cy DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_dashboard_revenue_by_client_group(
  p_organization_id UUID,
  p_current_year_start DATE,
  p_current_year_end DATE,
  p_last_year_start DATE,
  p_last_year_end DATE,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  client_group TEXT,
  current_year_total NUMERIC,
  last_year_total NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH agg AS (
    SELECT
      COALESCE(NULLIF(TRIM(i.client_group), ''), 'Uncategorized') AS grp,
      ROUND(COALESCE(SUM(i.amount) FILTER (
        WHERE i.date BETWEEN p_current_year_start AND p_current_year_end
      ), 0)::numeric, 2) AS cy,
      ROUND(COALESCE(SUM(i.amount) FILTER (
        WHERE i.date BETWEEN p_last_year_start AND p_last_year_end
      ), 0)::numeric, 2) AS ly
    FROM invoice_uploads i
    WHERE i.organization_id = p_organization_id
      AND i.date BETWEEN LEAST(p_current_year_start, p_last_year_start)
                     AND GREATEST(p_current_year_end, p_last_year_end)
    GROUP BY 1
  )
  SELECT a.grp AS client_group, a.cy AS current_year_total, a.ly AS last_year_total
  FROM agg a
  ORDER BY a.cy DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_dashboard_billable_by_partner TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_revenue_by_partner TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_billable_by_client_group TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_revenue_by_client_group TO authenticated;
