-- Remove unused XPM tables: custom_fields, expense_claims, quotes, templates
-- These tables are no longer needed for the application

-- Drop RLS policies first
drop policy if exists "users_access_own_org_custom_fields" on xpm_custom_fields;
drop policy if exists "users_access_own_org_expense_claims" on xpm_expense_claims;
drop policy if exists "users_access_own_org_quotes" on xpm_quotes;
drop policy if exists "users_access_own_org_templates" on xpm_templates;

-- Drop triggers
drop trigger if exists update_xpm_custom_fields_updated_at on xpm_custom_fields;
drop trigger if exists update_xpm_expense_claims_updated_at on xpm_expense_claims;
drop trigger if exists update_xpm_quotes_updated_at on xpm_quotes;
drop trigger if exists update_xpm_templates_updated_at on xpm_templates;

-- Drop indexes
drop index if exists idx_xpm_custom_fields_org;
drop index if exists idx_xpm_custom_fields_xpm_id;
drop index if exists idx_xpm_expense_claims_org;
drop index if exists idx_xpm_expense_claims_xpm_id;
drop index if exists idx_xpm_quotes_org;
drop index if exists idx_xpm_quotes_xpm_id;
drop index if exists idx_xpm_templates_org;
drop index if exists idx_xpm_templates_xpm_id;

-- Drop tables
drop table if exists xpm_custom_fields;
drop table if exists xpm_expense_claims;
drop table if exists xpm_quotes;
drop table if exists xpm_templates;

-- Remove sync metadata for these tables
delete from xpm_sync_metadata 
where table_name in ('customfields', 'expenseclaims', 'quotes', 'templates');

