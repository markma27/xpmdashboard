-- Rename staff_target_billable table to staff_settings
-- Add staff_name column for staff from timesheet_uploads
-- Add start_date and end_date columns
-- Make xpm_staff_id and xpm_id nullable since staff now comes from timesheet_uploads

-- Step 1: Add new columns
alter table staff_target_billable
  add column if not exists staff_name text,
  add column if not exists start_date date,
  add column if not exists end_date date;

-- Step 2: Make xpm_staff_id and xpm_id nullable
alter table staff_target_billable
  alter column xpm_staff_id drop not null,
  alter column xpm_id drop not null;

-- Step 3: Drop old unique constraint
alter table staff_target_billable
  drop constraint if exists staff_target_billable_organization_id_xpm_id_key;

-- Step 4: We'll add the unique constraint after renaming the table
-- For now, we'll allow null staff_name temporarily

-- Step 5: Drop old indexes
drop index if exists idx_staff_target_billable_xpm_staff;
drop index if exists idx_staff_target_billable_xpm_id;
drop index if exists idx_staff_target_billable_org_xpm_id;

-- Step 6: Create new indexes
create index if not exists idx_staff_settings_staff_name on staff_target_billable(organization_id, staff_name);
create index if not exists idx_staff_settings_org_staff_name on staff_target_billable(organization_id, staff_name);

-- Step 7: Rename the table
alter table staff_target_billable rename to staff_settings;

-- Step 8: Rename existing index
alter index if exists idx_staff_target_billable_org rename to idx_staff_settings_org;

-- Step 9: Create new indexes for staff_name
create index if not exists idx_staff_settings_staff_name on staff_settings(organization_id, staff_name);

-- Step 10: Add unique constraint on (organization_id, staff_name) where staff_name is not null
-- Note: PostgreSQL unique constraints allow multiple NULL values, so this works
alter table staff_settings
  add constraint staff_settings_org_staff_name_unique 
  unique(organization_id, staff_name);

-- Step 11: Rename RLS policy
drop policy if exists "users_access_own_org_staff_targets" on staff_settings;
create policy "users_access_own_org_staff_settings" on staff_settings
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Step 12: Rename trigger
drop trigger if exists update_staff_target_billable_updated_at on staff_settings;
create trigger update_staff_settings_updated_at
  before update on staff_settings
  for each row
  execute function update_updated_at_column();

