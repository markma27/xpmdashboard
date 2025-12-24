-- Recoverability Timesheet Uploads table
-- This table stores recoverability timesheet data uploaded from CSV files
-- Similar to regular timesheet_uploads but includes Invoiced Amount and Write On Amount

create table recoverability_timesheet_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  
  -- Client fields
  client_group text,
  client text,
  account_manager text,
  job_manager text,
  
  -- Ledger fields
  staff text not null,
  date date not null,
  time numeric(10, 2), -- hours worked
  billable_rate numeric(10, 2), -- hourly rate
  billable_amount numeric(10, 2), -- calculated amount
  invoiced_amount numeric(10, 2), -- amount invoiced
  write_on_amount numeric(10, 2), -- write on amount
  
  -- Metadata
  uploaded_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for better query performance
create index idx_recoverability_timesheet_uploads_org on recoverability_timesheet_uploads(organization_id);
create index idx_recoverability_timesheet_uploads_date on recoverability_timesheet_uploads(date);
create index idx_recoverability_timesheet_uploads_staff on recoverability_timesheet_uploads(staff);
create index idx_recoverability_timesheet_uploads_client on recoverability_timesheet_uploads(client);
create index idx_recoverability_timesheet_uploads_client_group on recoverability_timesheet_uploads(client_group);
create index idx_recoverability_timesheet_uploads_org_date on recoverability_timesheet_uploads(organization_id, date);

-- Enable Row Level Security
alter table recoverability_timesheet_uploads enable row level security;

-- RLS Policies - Users can only access data from their own organization
create policy "users_access_own_org_recoverability_timesheets" on recoverability_timesheet_uploads
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Trigger to automatically update updated_at
create trigger update_recoverability_timesheet_uploads_updated_at
  before update on recoverability_timesheet_uploads
  for each row
  execute function update_updated_at_column();

