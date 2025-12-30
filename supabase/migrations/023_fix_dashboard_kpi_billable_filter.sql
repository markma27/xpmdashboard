-- Fix get_dashboard_kpis function to only include billable = true records
-- This ensures billable $ matches Dashboard KPI card and Productivity page

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
