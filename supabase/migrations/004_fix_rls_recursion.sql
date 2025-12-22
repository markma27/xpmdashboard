-- Fix RLS recursion issue in organization_members table
-- Also fix organizations table policy to allow reading newly created orgs
-- Solution: Use a helper function to check membership without causing recursion

-- Drop existing policies that cause recursion
-- Drop all possible policy names that might exist
drop policy if exists "users_can_view_own_org_members" on organization_members;
drop policy if exists "users_can_view_own_membership" on organization_members;
drop policy if exists "users_can_view_org_members" on organization_members;
drop policy if exists "users_can_insert_members" on organization_members;
drop policy if exists "users_can_insert_self" on organization_members;
drop policy if exists "admins_can_insert_members" on organization_members;
drop policy if exists "admins_can_update_members" on organization_members;
drop policy if exists "admins_can_delete_members" on organization_members;

-- Also drop and recreate organizations policies to fix the insert/select issue
drop policy if exists "users_can_view_own_organizations" on organizations;
drop policy if exists "users_can_create_organizations" on organizations;

-- Create a helper function to check if user is member of an organization
-- This function uses SECURITY DEFINER to bypass RLS for the check
create or replace function is_org_member(org_id uuid, check_user_id uuid default auth.uid())
returns boolean as $$
begin
  return exists (
    select 1 from organization_members
    where organization_id = org_id
    and user_id = check_user_id
  );
end;
$$ language plpgsql security definer;

-- Create a helper function to check if user is admin of an organization
create or replace function is_org_admin(org_id uuid, check_user_id uuid default auth.uid())
returns boolean as $$
begin
  return exists (
    select 1 from organization_members
    where organization_id = org_id
    and user_id = check_user_id
    and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Now create policies using these helper functions

-- Users can view their own membership
create policy "users_can_view_own_membership" on organization_members
  for select using (user_id = auth.uid());

-- Users can view members of organizations they belong to
create policy "users_can_view_org_members" on organization_members
  for select using (is_org_member(organization_id));

-- Users can insert themselves when creating an organization
create policy "users_can_insert_self" on organization_members
  for insert with check (user_id = auth.uid());

-- Admins can insert other members (handled via service role in API, but policy for safety)
create policy "admins_can_insert_members" on organization_members
  for insert with check (is_org_admin(organization_id));

-- Admins can update members
create policy "admins_can_update_members" on organization_members
  for update using (is_org_admin(organization_id));

-- Admins can delete members
create policy "admins_can_delete_members" on organization_members
  for delete using (is_org_admin(organization_id));

-- Recreate organizations policies

-- Users can view organizations they are members of
create policy "users_can_view_own_organizations" on organizations
  for select using (is_org_member(id));

-- Users can create organizations (any authenticated user)
create policy "users_can_create_organizations" on organizations
  for insert with check (true);

-- Note: Organization creation is handled via service role in API to bypass RLS
-- This is necessary because user doesn't have member record yet when creating org
-- The insert policy above is kept for reference but API uses service role
