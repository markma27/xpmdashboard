-- Saved Filters table
-- This table stores saved filter configurations for different report pages
-- Each user can have one saved filter per page per organization

create table saved_filters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  page_type text not null, -- 'billable', 'productivity', 'revenue', etc.
  filters jsonb not null, -- Array of filter objects
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, user_id, page_type)
);

-- Indexes for better query performance
create index idx_saved_filters_org_user on saved_filters(organization_id, user_id);
create index idx_saved_filters_page_type on saved_filters(page_type);

-- Enable Row Level Security
alter table saved_filters enable row level security;

-- RLS Policies - Users can only access their own saved filters
create policy "users_access_own_saved_filters" on saved_filters
  for all using (
    user_id = auth.uid() and
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Trigger to automatically update updated_at
create trigger update_saved_filters_updated_at
  before update on saved_filters
  for each row
  execute function update_updated_at_column();
