-- Staff Target Billable Percentage table
-- This table stores the target billable percentage, FTE, and default daily hours for each staff member
-- Staff members come from xpm_staff table which is synced from XPM API

create table staff_target_billable (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  xpm_staff_id uuid references xpm_staff(id) on delete cascade,
  xpm_id text not null, -- XPM staff ID for quick reference
  target_billable_percentage numeric(5, 2) not null check (target_billable_percentage >= 0 and target_billable_percentage <= 100), -- Required: Target billable percentage (0-100%)
  fte numeric(3, 2) check (fte >= 0 and fte <= 1), -- Optional: Full-Time Equivalent (0.0 to 1.0) for part-time staff
  default_daily_hours numeric(4, 2) check (default_daily_hours > 0 and default_daily_hours <= 24), -- Optional: Default daily working hours (e.g., 8 or 7.6 hours)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Indexes for better query performance
create index idx_staff_target_billable_org on staff_target_billable(organization_id);
create index idx_staff_target_billable_xpm_staff on staff_target_billable(xpm_staff_id);
create index idx_staff_target_billable_xpm_id on staff_target_billable(xpm_id);
create index idx_staff_target_billable_org_xpm_id on staff_target_billable(organization_id, xpm_id);

-- Enable Row Level Security
alter table staff_target_billable enable row level security;

-- RLS Policies - Users can only access data from their own organization
create policy "users_access_own_org_staff_targets" on staff_target_billable
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Trigger to automatically update updated_at
create trigger update_staff_target_billable_updated_at
  before update on staff_target_billable
  for each row
  execute function update_updated_at_column();
