-- Performance optimization: SQL aggregation functions
-- These functions perform data aggregation at the database level
-- instead of fetching all rows and aggregating in JavaScript

-- =====================================================
-- REVENUE (INVOICE) AGGREGATION FUNCTIONS
-- =====================================================

-- Get monthly revenue totals for a financial year
CREATE OR REPLACE FUNCTION get_monthly_revenue(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_partner TEXT DEFAULT NULL,
  p_client_manager TEXT DEFAULT NULL
)
RETURNS TABLE (
  month_year TEXT,
  month_name TEXT,
  total_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(date, 'YYYY-MM') as month_year,
    TO_CHAR(date, 'Month') as month_name,
    COALESCE(SUM(amount), 0) as total_amount
  FROM invoice_uploads
  WHERE organization_id = p_organization_id
    AND date BETWEEN p_start_date AND p_end_date
    AND (p_partner IS NULL OR account_manager = p_partner)
    AND (p_client_manager IS NULL OR job_manager = p_client_manager)
  GROUP BY TO_CHAR(date, 'YYYY-MM'), TO_CHAR(date, 'Month')
  ORDER BY month_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get total revenue for a date range
CREATE OR REPLACE FUNCTION get_revenue_total(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS NUMERIC AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total
  FROM invoice_uploads
  WHERE organization_id = p_organization_id
    AND date BETWEEN p_start_date AND p_end_date;
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- BILLABLE AMOUNT AGGREGATION FUNCTIONS
-- =====================================================

-- Get monthly billable amounts
CREATE OR REPLACE FUNCTION get_monthly_billable(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_staff TEXT DEFAULT NULL,
  p_partner TEXT DEFAULT NULL,
  p_client_manager TEXT DEFAULT NULL
)
RETURNS TABLE (
  month_year TEXT,
  month_name TEXT,
  total_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(date, 'YYYY-MM') as month_year,
    TO_CHAR(date, 'Month') as month_name,
    COALESCE(SUM(billable_amount), 0) as total_amount
  FROM timesheet_uploads
  WHERE organization_id = p_organization_id
    AND date BETWEEN p_start_date AND p_end_date
    AND (p_staff IS NULL OR staff = p_staff)
    AND (p_partner IS NULL OR account_manager = p_partner)
    AND (p_client_manager IS NULL OR job_manager = p_client_manager)
  GROUP BY TO_CHAR(date, 'YYYY-MM'), TO_CHAR(date, 'Month')
  ORDER BY month_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get total billable amount for a date range
CREATE OR REPLACE FUNCTION get_billable_total(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS NUMERIC AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(billable_amount), 0) INTO total
  FROM timesheet_uploads
  WHERE organization_id = p_organization_id
    AND date BETWEEN p_start_date AND p_end_date;
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PRODUCTIVITY KPI FUNCTIONS
-- =====================================================

-- Get billable hours and amount for productivity calculation
CREATE OR REPLACE FUNCTION get_billable_hours_and_amount(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_staff TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_hours NUMERIC,
  total_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN time < 100 THEN time / 60.0
        ELSE FLOOR(time / 100) + (time % 100) / 60.0
      END
    ), 0) as total_hours,
    COALESCE(SUM(billable_amount), 0) as total_amount
  FROM timesheet_uploads
  WHERE organization_id = p_organization_id
    AND date BETWEEN p_start_date AND p_end_date
    AND billable = true
    AND (p_staff IS NULL OR staff = p_staff);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get capacity reducing hours
CREATE OR REPLACE FUNCTION get_capacity_reducing_hours(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_staff TEXT DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN time < 100 THEN time / 60.0
      ELSE FLOOR(time / 100) + (time % 100) / 60.0
    END
  ), 0) INTO total
  FROM timesheet_uploads
  WHERE organization_id = p_organization_id
    AND date BETWEEN p_start_date AND p_end_date
    AND capacity_reducing = true
    AND (p_staff IS NULL OR staff = p_staff);
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- WIP AGGREGATION FUNCTIONS
-- =====================================================

-- Get WIP totals by client group
CREATE OR REPLACE FUNCTION get_wip_by_client_group(
  p_organization_id UUID,
  p_partner TEXT DEFAULT NULL,
  p_client_manager TEXT DEFAULT NULL
)
RETURNS TABLE (
  client_group TEXT,
  account_manager TEXT,
  job_manager TEXT,
  total_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.client_group,
    w.account_manager,
    w.job_manager,
    COALESCE(SUM(w.billable_amount), 0) as total_amount
  FROM wip_timesheet_uploads w
  WHERE w.organization_id = p_organization_id
    AND (p_partner IS NULL OR w.account_manager = p_partner)
    AND (p_client_manager IS NULL OR w.job_manager = p_client_manager)
  GROUP BY w.client_group, w.account_manager, w.job_manager
  ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get total WIP amount
CREATE OR REPLACE FUNCTION get_wip_total(
  p_organization_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(billable_amount), 0) INTO total
  FROM wip_timesheet_uploads
  WHERE organization_id = p_organization_id;
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RECOVERABILITY AGGREGATION FUNCTIONS
-- =====================================================

-- Get recoverability data (invoice - billable)
CREATE OR REPLACE FUNCTION get_recoverability_by_month(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  month_year TEXT,
  invoice_total NUMERIC,
  billable_total NUMERIC,
  difference NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH invoice_monthly AS (
    SELECT 
      TO_CHAR(date, 'YYYY-MM') as month_year,
      COALESCE(SUM(amount), 0) as total
    FROM invoice_uploads
    WHERE organization_id = p_organization_id
      AND date BETWEEN p_start_date AND p_end_date
    GROUP BY TO_CHAR(date, 'YYYY-MM')
  ),
  billable_monthly AS (
    SELECT 
      TO_CHAR(date, 'YYYY-MM') as month_year,
      COALESCE(SUM(billable_amount), 0) as total
    FROM timesheet_uploads
    WHERE organization_id = p_organization_id
      AND date BETWEEN p_start_date AND p_end_date
    GROUP BY TO_CHAR(date, 'YYYY-MM')
  )
  SELECT 
    COALESCE(i.month_year, b.month_year) as month_year,
    COALESCE(i.total, 0) as invoice_total,
    COALESCE(b.total, 0) as billable_total,
    COALESCE(i.total, 0) - COALESCE(b.total, 0) as difference
  FROM invoice_monthly i
  FULL OUTER JOIN billable_monthly b ON i.month_year = b.month_year
  ORDER BY month_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DASHBOARD KPI FUNCTION (Combined)
-- =====================================================

-- Get all dashboard KPIs in a single call
CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  p_organization_id UUID,
  p_current_year_start DATE,
  p_current_year_end DATE,
  p_last_year_start DATE,
  p_last_year_end DATE
)
RETURNS TABLE (
  current_year_revenue NUMERIC,
  last_year_revenue NUMERIC,
  current_year_billable NUMERIC,
  last_year_billable NUMERIC,
  total_wip NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COALESCE(SUM(amount), 0) FROM invoice_uploads 
     WHERE organization_id = p_organization_id 
     AND date BETWEEN p_current_year_start AND p_current_year_end) as current_year_revenue,
    (SELECT COALESCE(SUM(amount), 0) FROM invoice_uploads 
     WHERE organization_id = p_organization_id 
     AND date BETWEEN p_last_year_start AND p_last_year_end) as last_year_revenue,
    (SELECT COALESCE(SUM(billable_amount), 0) FROM timesheet_uploads 
     WHERE organization_id = p_organization_id 
     AND billable = true
     AND date BETWEEN p_current_year_start AND p_current_year_end) as current_year_billable,
    (SELECT COALESCE(SUM(billable_amount), 0) FROM timesheet_uploads 
     WHERE organization_id = p_organization_id 
     AND billable = true
     AND date BETWEEN p_last_year_start AND p_last_year_end) as last_year_billable,
    (SELECT COALESCE(SUM(billable_amount), 0) FROM wip_timesheet_uploads 
     WHERE organization_id = p_organization_id) as total_wip;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_monthly_revenue TO authenticated;
GRANT EXECUTE ON FUNCTION get_revenue_total TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_billable TO authenticated;
GRANT EXECUTE ON FUNCTION get_billable_total TO authenticated;
GRANT EXECUTE ON FUNCTION get_billable_hours_and_amount TO authenticated;
GRANT EXECUTE ON FUNCTION get_capacity_reducing_hours TO authenticated;
GRANT EXECUTE ON FUNCTION get_wip_by_client_group TO authenticated;
GRANT EXECUTE ON FUNCTION get_wip_total TO authenticated;
GRANT EXECUTE ON FUNCTION get_recoverability_by_month TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_kpis TO authenticated;

