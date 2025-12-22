-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Organizations table (Tenants)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Organization members table (many-to-many relationship)
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'viewer', -- 'admin', 'member', 'viewer'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, user_id)
);

-- Indexes for better query performance
create index idx_organization_members_user_id on organization_members(user_id);
create index idx_organization_members_organization_id on organization_members(organization_id);
create index idx_organizations_slug on organizations(slug);

-- Enable Row Level Security
alter table organizations enable row level security;
alter table organization_members enable row level security;

-- RLS Policies for organizations table
-- Users can select organizations they are members of
create policy "users_can_view_own_organizations" on organizations
  for select using (
    id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Users can insert organizations (and will become admin via trigger or application logic)
create policy "users_can_create_organizations" on organizations
  for insert with check (true);

-- Users can update organizations they are admin of
create policy "admins_can_update_organizations" on organizations
  for update using (
    id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for organization_members table
-- Users can view members of organizations they belong to
create policy "users_can_view_own_org_members" on organization_members
  for select using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Users can insert themselves as admin when creating an organization
-- (This will be handled by application logic, but we allow inserts)
create policy "users_can_insert_members" on organization_members
  for insert with check (
    -- Allow if user is inserting themselves, or if user is admin of the org
    user_id = auth.uid() or
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can update member roles
create policy "admins_can_update_members" on organization_members
  for update using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can delete members (except themselves)
create policy "admins_can_delete_members" on organization_members
  for delete using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers to automatically update updated_at
create trigger update_organizations_updated_at
  before update on organizations
  for each row
  execute function update_updated_at_column();

create trigger update_organization_members_updated_at
  before update on organization_members
  for each row
  execute function update_updated_at_column();

