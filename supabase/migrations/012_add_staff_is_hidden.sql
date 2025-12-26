-- Add is_hidden column to staff_target_billable table
-- This allows staff to be hidden from the default view

alter table staff_target_billable
  add column if not exists is_hidden boolean default false not null;

-- Create index for filtering hidden staff
create index if not exists idx_staff_target_billable_is_hidden on staff_target_billable(organization_id, is_hidden);

