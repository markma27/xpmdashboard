-- WIP Timesheet Uploads table
-- This table stores WIP (Work In Progress) timesheet data uploaded from CSV files
-- Separate from regular timesheet_uploads table for WIP reporting purposes

create table wip_timesheet_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  
  -- Client fields
  client_group text,
  client text,
  account_manager text,
  job_manager text,
  
  -- Job fields
  job_no text,
  job_name text,
  
  -- Ledger fields
  staff text not null,
  date date not null,
  time numeric(10, 2), -- hours worked
  billable_rate numeric(10, 2), -- hourly rate
  billable_amount numeric(10, 2), -- calculated amount
  billed boolean default false,
  note text,
  
  -- Metadata
  uploaded_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for better query performance
create index idx_wip_timesheet_uploads_org on wip_timesheet_uploads(organization_id);
create index idx_wip_timesheet_uploads_date on wip_timesheet_uploads(date);
create index idx_wip_timesheet_uploads_staff on wip_timesheet_uploads(staff);
create index idx_wip_timesheet_uploads_client on wip_timesheet_uploads(client);
create index idx_wip_timesheet_uploads_client_group on wip_timesheet_uploads(client_group);
create index idx_wip_timesheet_uploads_job_no on wip_timesheet_uploads(job_no);
create index idx_wip_timesheet_uploads_org_date on wip_timesheet_uploads(organization_id, date);

-- Enable Row Level Security
alter table wip_timesheet_uploads enable row level security;

-- RLS Policies - Users can only access data from their own organization
create policy "users_access_own_org_wip_timesheets" on wip_timesheet_uploads
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Trigger to automatically update updated_at
create trigger update_wip_timesheet_uploads_updated_at
  before update on wip_timesheet_uploads
  for each row
  execute function update_updated_at_column();

