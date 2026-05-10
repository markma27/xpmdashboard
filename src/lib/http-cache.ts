/**
 * Cache headers for authenticated org-scoped JSON APIs.
 * URLs include organizationId; requireOrg() authorizes before returning 200.
 * Enables brief CDN/browser caching to cut repeat load cost (stale-while-revalidate keeps UI snappy).
 * Server-side aggregate invalidation: `revalidateOrganizationAnalytics` in `@/lib/org-analytics-cache` (e.g. after uploads).
 */
export const CACHE_CONTROL_READONLY_JSON =
  'public, s-maxage=60, stale-while-revalidate=300' as const

export const CACHE_CONTROL_NO_STORE =
  'no-store, no-cache, must-revalidate, proxy-revalidate' as const
