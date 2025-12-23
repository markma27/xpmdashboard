import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type User = {
  id: string
  email?: string
}

export type Organization = {
  id: string
  name: string
  slug: string
  role?: string // User's role in this organization
}

/**
 * Get the current authenticated user
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
  }
}

/**
 * Require authentication - redirects to login if not authenticated
 */
export async function requireAuth(): Promise<User> {
  const user = await getSessionUser()
  if (!user) {
    redirect('/auth/login')
  }
  return user
}

/**
 * Load user's organizations
 */
export async function loadUserOrganizations(): Promise<Organization[]> {
  const supabase = await createClient()
  const user = await getSessionUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select(
      `
      organization_id,
      role,
      organizations (
        id,
        name,
        slug
      )
    `
    )
    .eq('user_id', user.id)

  if (error || !data) {
    return []
  }

  return data.map((member: any) => ({
    id: member.organizations.id,
    name: member.organizations.name,
    slug: member.organizations.slug,
    role: member.role,
  }))
}

/**
 * Get active organization ID from cookie
 */
export async function getActiveOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('active_org_id')?.value || null
}

/**
 * Set active organization ID in cookie
 */
export async function setActiveOrgId(orgId: string) {
  const cookieStore = await cookies()
  cookieStore.set('active_org_id', orgId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false, // Allow client-side access for localStorage fallback
    sameSite: 'lax',
  })
}

/**
 * Require organization - ensures user has at least one org
 * Note: Does not set cookie automatically - use API route /api/org/set-active for that
 */
export async function requireOrg(): Promise<Organization> {
  const user = await requireAuth()
  const orgs = await loadUserOrganizations()

  if (orgs.length === 0) {
    redirect('/onboarding/create-org')
  }

  // Check if there's an active org in cookie
  let activeOrgId = await getActiveOrgId()
  let activeOrg = orgs.find((org) => org.id === activeOrgId)

  // If no active org or active org not in user's orgs, use first org
  // But don't set cookie here - let the client/API route handle it
  if (!activeOrg && orgs.length > 0) {
    activeOrg = orgs[0]
    // Don't set cookie here - cookies can only be modified in Server Actions or Route Handlers
    // The client will set it via /api/org/set-active if needed
  }

  if (!activeOrg) {
    redirect('/onboarding/create-org')
  }

  return activeOrg
}

