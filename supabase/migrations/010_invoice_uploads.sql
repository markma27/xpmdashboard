-- Invoice Uploads table
-- This table stores invoice data uploaded from CSV files
-- Similar to timesheet_uploads but for invoice reporting

create table invoice_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  
  -- Client fields
  client_group text,
  client text,
  account_manager text,
  job_manager text,
  
  -- Invoice fields
  invoice_no text,
  date date not null,
  amount numeric(10, 2), -- invoice amount
  amount_incl_tax numeric(10, 2), -- invoice amount including tax
  
  -- Metadata
  uploaded_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for better query performance
create index idx_invoice_uploads_org on invoice_uploads(organization_id);
create index idx_invoice_uploads_date on invoice_uploads(date);
create index idx_invoice_uploads_client on invoice_uploads(client);
create index idx_invoice_uploads_client_group on invoice_uploads(client_group);
create index idx_invoice_uploads_invoice_no on invoice_uploads(invoice_no);
create index idx_invoice_uploads_org_date on invoice_uploads(organization_id, date);

-- Enable Row Level Security
alter table invoice_uploads enable row level security;

-- RLS Policies - Users can only access data from their own organization
create policy "users_access_own_org_invoices" on invoice_uploads
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Trigger to automatically update updated_at
create trigger update_invoice_uploads_updated_at
  before update on invoice_uploads
  for each row
  execute function update_updated_at_column();

