-- Performance optimization: Additional composite indexes
-- These indexes optimize the most common dashboard queries

-- =====================================================
-- TIMESHEET_UPLOADS INDEXES
-- =====================================================

-- Index for billable queries with date range (used in productivity KPI)
CREATE INDEX IF NOT EXISTS idx_timesheet_org_date_billable 
ON timesheet_uploads(organization_id, date, billable);

-- Index for capacity reducing queries
CREATE INDEX IF NOT EXISTS idx_timesheet_org_date_capacity 
ON timesheet_uploads(organization_id, date, capacity_reducing);

-- Index for filtering by account_manager (partner)
CREATE INDEX IF NOT EXISTS idx_timesheet_org_account_manager 
ON timesheet_uploads(organization_id, account_manager);

-- Index for filtering by job_manager (client manager)
CREATE INDEX IF NOT EXISTS idx_timesheet_org_job_manager 
ON timesheet_uploads(organization_id, job_manager);

-- =====================================================
-- INVOICE_UPLOADS INDEXES
-- =====================================================

-- Index for account_manager (partner) filtering
CREATE INDEX IF NOT EXISTS idx_invoice_org_account_manager 
ON invoice_uploads(organization_id, account_manager);

-- Index for job_manager (client manager) filtering  
CREATE INDEX IF NOT EXISTS idx_invoice_org_job_manager 
ON invoice_uploads(organization_id, job_manager);

-- =====================================================
-- WIP_TIMESHEET_UPLOADS INDEXES
-- =====================================================

-- Index for partner filtering
CREATE INDEX IF NOT EXISTS idx_wip_org_account_manager 
ON wip_timesheet_uploads(organization_id, account_manager);

-- Index for client manager filtering
CREATE INDEX IF NOT EXISTS idx_wip_org_job_manager 
ON wip_timesheet_uploads(organization_id, job_manager);

-- =====================================================
-- STAFF_SETTINGS INDEXES
-- =====================================================

-- Index for organization + report flag queries
CREATE INDEX IF NOT EXISTS idx_staff_settings_org_report 
ON staff_settings(organization_id, is_hidden, report);

