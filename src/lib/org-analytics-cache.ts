import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  computeDashboardKpiPayload,
  type DashboardKpiFilter,
} from '@/lib/queries/dashboard-kpi-query'

export function organizationAnalyticsCacheTag(organizationId: string) {
  return `org-analytics:${organizationId}`
}

export function revalidateOrganizationAnalytics(organizationId: string) {
  revalidateTag(organizationAnalyticsCacheTag(organizationId), 'max')
}

/**
 * Server-side unstable_cache cannot wrap functions that read request cookies.
 * These analytics queries use the Supabase SSR client, so keep them uncached
 * server-side and rely on response Cache-Control + SWR dedupe instead.
 */
export function getCachedOrgRunner<TArgs extends unknown[], TResult>(
  routeKey: string,
  organizationId: string,
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  void routeKey
  void organizationId
  return fn
}

function parseFiltersKey(filtersKey: string): DashboardKpiFilter[] {
  if (!filtersKey) return []
  try {
    const parsed = JSON.parse(filtersKey)
    if (!Array.isArray(parsed)) return []
    const filters: DashboardKpiFilter[] = []
    parsed.forEach((filter: any) => {
      if (filter.type && filter.value) {
        filters.push({
          type: filter.type,
          value: typeof filter.value === 'string' ? decodeURIComponent(filter.value) : filter.value,
          operator: filter.operator,
        })
      }
    })
    return filters
  } catch {
    return []
  }
}

type CachedKpiFn = (
  currentYearEnd: string,
  currentYearStart: string,
  lastYearStart: string,
  lastYearEnd: string,
  filtersKey: string
) => ReturnType<typeof computeDashboardKpiPayload>

/**
 * Request-cookie Supabase clients cannot run inside unstable_cache.
 */
export function getCachedDashboardKpiRunner(organizationId: string): CachedKpiFn {
  return async (
    currentYearEnd: string,
    currentYearStart: string,
    lastYearStart: string,
    lastYearEnd: string,
    filtersKey: string
  ) => {
    const supabase = await createClient()
    const filters = parseFiltersKey(filtersKey)
    return computeDashboardKpiPayload(supabase, {
      organizationId,
      filters,
      currentYearEnd,
      currentYearStart,
      lastYearStart,
      lastYearEnd,
    })
  }
}
