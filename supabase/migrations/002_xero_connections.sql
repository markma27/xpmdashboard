-- Xero connections table (one organization can have multiple Xero connections)
create table xero_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null, -- Xero tenant ID
  tenant_name text,
  token_set_enc text not null, -- encrypted token set (JSON string)
  expires_at timestamptz not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, tenant_id)
);

-- Sync metadata table
create table xpm_sync_metadata (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  table_name text not null,
  last_sync_at timestamptz,
  last_sync_status text, -- 'success', 'failed', 'partial', 'pending'
  last_sync_count integer default 0,
  next_sync_at timestamptz,
  sync_frequency text default 'daily', -- 'hourly', 'daily', 'weekly', 'monthly'
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, tenant_id, table_name)
);

-- Indexes for better query performance
create index idx_xero_connections_organization_id on xero_connections(organization_id);
create index idx_xero_connections_tenant_id on xero_connections(tenant_id);
create index idx_xpm_sync_metadata_organization_id on xpm_sync_metadata(organization_id);
create index idx_xpm_sync_metadata_tenant_id on xpm_sync_metadata(tenant_id);
create index idx_xpm_sync_metadata_table_name on xpm_sync_metadata(table_name);

-- Enable Row Level Security
alter table xero_connections enable row level security;
alter table xpm_sync_metadata enable row level security;

-- RLS Policies for xero_connections table
-- Users can view connections for organizations they belong to
create policy "users_can_view_own_org_connections" on xero_connections
  for select using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Only admins can insert connections
create policy "admins_can_create_connections" on xero_connections
  for insert with check (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can update connections
create policy "admins_can_update_connections" on xero_connections
  for update using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can delete connections
create policy "admins_can_delete_connections" on xero_connections
  for delete using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for xpm_sync_metadata table
-- Users can view sync metadata for organizations they belong to
create policy "users_can_view_own_org_sync_metadata" on xpm_sync_metadata
  for select using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Only admins can insert/update sync metadata (usually done by system)
create policy "admins_can_manage_sync_metadata" on xpm_sync_metadata
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Triggers to automatically update updated_at
create trigger update_xero_connections_updated_at
  before update on xero_connections
  for each row
  execute function update_updated_at_column();

create trigger update_xpm_sync_metadata_updated_at
  before update on xpm_sync_metadata
  for each row
  execute function update_updated_at_column();

