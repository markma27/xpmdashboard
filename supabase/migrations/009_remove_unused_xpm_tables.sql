-- Remove unused XPM tables: costs, categories, tasks, timeentries, jobs
-- These tables are no longer needed for syncing

-- Drop triggers first
drop trigger if exists update_xpm_costs_updated_at on xpm_costs;
drop trigger if exists update_xpm_categories_updated_at on xpm_categories;
drop trigger if exists update_xpm_tasks_updated_at on xpm_tasks;
drop trigger if exists update_xpm_time_entries_updated_at on xpm_time_entries;
drop trigger if exists update_xpm_jobs_updated_at on xpm_jobs;

-- Drop RLS policies
drop policy if exists "users_access_own_org_costs" on xpm_costs;
drop policy if exists "users_access_own_org_categories" on xpm_categories;
drop policy if exists "users_access_own_org_tasks" on xpm_tasks;
drop policy if exists "users_access_own_org_time_entries" on xpm_time_entries;
drop policy if exists "users_access_own_org_jobs" on xpm_jobs;

-- Drop indexes
drop index if exists idx_xpm_costs_org;
drop index if exists idx_xpm_categories_org;
drop index if exists idx_xpm_tasks_org;
drop index if exists idx_xpm_time_entries_org;
drop index if exists idx_xpm_jobs_org;

-- Drop tables (CASCADE will also drop any foreign key constraints)
drop table if exists xpm_costs cascade;
drop table if exists xpm_categories cascade;
drop table if exists xpm_tasks cascade;
drop table if exists xpm_time_entries cascade;
drop table if exists xpm_jobs cascade;

-- Clean up sync metadata for these tables
-- Check both short names and full table names to ensure all records are removed
delete from xpm_sync_metadata 
where table_name in (
  'costs', 'categories', 'tasks', 'timeentries', 'jobs',
  'xpm_costs', 'xpm_categories', 'xpm_tasks', 'xpm_time_entries', 'xpm_jobs'
);

