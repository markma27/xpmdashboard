import { Organization } from './auth'

export type Role = 'admin' | 'member' | 'viewer'

/**
 * Check if user has admin role in organization
 */
export function isAdmin(org: Organization | null): boolean {
  return org?.role === 'admin'
}

/**
 * Check if user has member role (or higher) in organization
 */
export function isMember(org: Organization | null): boolean {
  return org?.role === 'admin' || org?.role === 'member'
}

/**
 * Check if user has viewer role (or higher) in organization
 */
export function isViewer(org: Organization | null): boolean {
  return org?.role === 'admin' || org?.role === 'member' || org?.role === 'viewer'
}

/**
 * Require admin role - throws error if not admin
 */
export function requireAdmin(org: Organization | null): void {
  if (!isAdmin(org)) {
    throw new Error('Unauthorized: Admin access required')
  }
}

/**
 * Require member role (or higher) - throws error if not member
 */
export function requireMember(org: Organization | null): void {
  if (!isMember(org)) {
    throw new Error('Unauthorized: Member access required')
  }
}

/**
 * Get role hierarchy level (higher number = more permissions)
 */
export function getRoleLevel(role: Role): number {
  switch (role) {
    case 'admin':
      return 3
    case 'member':
      return 2
    case 'viewer':
      return 1
    default:
      return 0
  }
}

