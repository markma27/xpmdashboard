-- Add job_name column to timesheet_uploads table
-- This column stores the [Job] Name from CSV files

alter table timesheet_uploads
  add column if not exists job_name text;

-- Add index for better query performance
create index if not exists idx_timesheet_uploads_job_name on timesheet_uploads(job_name);
