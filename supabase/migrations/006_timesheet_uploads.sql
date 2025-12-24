-- Timesheet Uploads table
-- This table stores timesheet data uploaded from CSV files
-- Since CSV data doesn't have unique primary keys, we use date range deletion to avoid duplicates

create table timesheet_uploads (
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
  billed boolean default false,
  billable boolean default true,
  note text,
  
  -- Job fields
  capacity_reducing boolean default false,
  
  -- Metadata
  uploaded_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for better query performance
create index idx_timesheet_uploads_org on timesheet_uploads(organization_id);
create index idx_timesheet_uploads_date on timesheet_uploads(date);
create index idx_timesheet_uploads_staff on timesheet_uploads(staff);
create index idx_timesheet_uploads_client on timesheet_uploads(client);
create index idx_timesheet_uploads_client_group on timesheet_uploads(client_group);
create index idx_timesheet_uploads_org_date on timesheet_uploads(organization_id, date);

-- Enable Row Level Security
alter table timesheet_uploads enable row level security;

-- RLS Policies - Users can only access data from their own organization
create policy "users_access_own_org_timesheets" on timesheet_uploads
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Trigger to automatically update updated_at
create trigger update_timesheet_uploads_updated_at
  before update on timesheet_uploads
  for each row
  execute function update_updated_at_column();

