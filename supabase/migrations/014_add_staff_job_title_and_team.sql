-- Add job_title and team columns to staff_target_billable table
-- job_title: Job title/position of the staff member (required in UI, optional in DB to allow partial saves)
-- team: Team name/group the staff member belongs to (optional)

alter table staff_target_billable
  add column if not exists job_title text,
  add column if not exists team text;

