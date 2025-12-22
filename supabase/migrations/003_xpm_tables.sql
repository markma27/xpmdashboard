-- XPM Data Tables
-- All tables follow the same structure with organization_id, xpm_id, tenant_id, raw_data

-- Clients table
create table xpm_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Client Groups table
create table xpm_client_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Jobs table
create table xpm_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Tasks table
create table xpm_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Time Entries table
create table xpm_time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Invoices table
create table xpm_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Staff table
create table xpm_staff (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Quotes table
create table xpm_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Expense Claims table
create table xpm_expense_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Categories table
create table xpm_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Costs table
create table xpm_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Custom Fields table
create table xpm_custom_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Templates table
create table xpm_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  xpm_id text not null,
  raw_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, xpm_id)
);

-- Indexes for better query performance
create index idx_xpm_clients_org on xpm_clients(organization_id);
create index idx_xpm_clients_tenant on xpm_clients(tenant_id);
create index idx_xpm_client_groups_org on xpm_client_groups(organization_id);
create index idx_xpm_jobs_org on xpm_jobs(organization_id);
create index idx_xpm_tasks_org on xpm_tasks(organization_id);
create index idx_xpm_time_entries_org on xpm_time_entries(organization_id);
create index idx_xpm_invoices_org on xpm_invoices(organization_id);
create index idx_xpm_staff_org on xpm_staff(organization_id);
create index idx_xpm_quotes_org on xpm_quotes(organization_id);
create index idx_xpm_expense_claims_org on xpm_expense_claims(organization_id);
create index idx_xpm_categories_org on xpm_categories(organization_id);
create index idx_xpm_costs_org on xpm_costs(organization_id);
create index idx_xpm_custom_fields_org on xpm_custom_fields(organization_id);
create index idx_xpm_templates_org on xpm_templates(organization_id);

-- Enable Row Level Security
alter table xpm_clients enable row level security;
alter table xpm_client_groups enable row level security;
alter table xpm_jobs enable row level security;
alter table xpm_tasks enable row level security;
alter table xpm_time_entries enable row level security;
alter table xpm_invoices enable row level security;
alter table xpm_staff enable row level security;
alter table xpm_quotes enable row level security;
alter table xpm_expense_claims enable row level security;
alter table xpm_categories enable row level security;
alter table xpm_costs enable row level security;
alter table xpm_custom_fields enable row level security;
alter table xpm_templates enable row level security;

-- RLS Policies - Users can only access data from their own organization
create policy "users_access_own_org_clients" on xpm_clients
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "users_access_own_org_client_groups" on xpm_client_groups
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "users_access_own_org_jobs" on xpm_jobs
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "users_access_own_org_tasks" on xpm_tasks
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "users_access_own_org_time_entries" on xpm_time_entries
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "users_access_own_org_invoices" on xpm_invoices
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "users_access_own_org_staff" on xpm_staff
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "users_access_own_org_quotes" on xpm_quotes
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "users_access_own_org_expense_claims" on xpm_expense_claims
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "users_access_own_org_categories" on xpm_categories
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "users_access_own_org_costs" on xpm_costs
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "users_access_own_org_custom_fields" on xpm_custom_fields
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "users_access_own_org_templates" on xpm_templates
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Triggers to automatically update updated_at
create trigger update_xpm_clients_updated_at
  before update on xpm_clients
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_client_groups_updated_at
  before update on xpm_client_groups
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_jobs_updated_at
  before update on xpm_jobs
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_tasks_updated_at
  before update on xpm_tasks
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_time_entries_updated_at
  before update on xpm_time_entries
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_invoices_updated_at
  before update on xpm_invoices
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_staff_updated_at
  before update on xpm_staff
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_quotes_updated_at
  before update on xpm_quotes
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_expense_claims_updated_at
  before update on xpm_expense_claims
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_categories_updated_at
  before update on xpm_categories
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_costs_updated_at
  before update on xpm_costs
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_custom_fields_updated_at
  before update on xpm_custom_fields
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_templates_updated_at
  before update on xpm_templates
  for each row
  execute function update_updated_at_column();

