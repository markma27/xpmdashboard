-- Add email and report columns to staff_target_billable table
-- email: Email address of the staff member
-- report: Boolean flag indicating if staff should be included in reports (Yes/No)

alter table staff_target_billable
  add column if not exists email text,
  add column if not exists report boolean default true not null;

