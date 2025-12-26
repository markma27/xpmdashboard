-- Make target_billable_percentage nullable to allow records with only is_hidden set
-- This allows staff to be hidden without requiring any other fields

alter table staff_target_billable
  alter column target_billable_percentage drop not null;

-- Remove the check constraint that requires target_billable_percentage to be between 0 and 100
-- We'll add it back but allow NULL values
alter table staff_target_billable
  drop constraint if exists staff_target_billable_target_billable_percentage_check;

alter table staff_target_billable
  add constraint staff_target_billable_target_billable_percentage_check 
  check (target_billable_percentage is null or (target_billable_percentage >= 0 and target_billable_percentage <= 100));

