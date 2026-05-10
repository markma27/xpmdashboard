import { unstable_cache, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  computeDashboardKpiPayload,
  type DashboardKpiFilter,
} from '@/lib/queries/dashboard-kpi-query'

export function organizationAnalyticsCacheTag(organizationId: string) {
  return `org-analytics:${organizationId}`
}

export function revalidateOrganizationAnalytics(organizationId: string) {
  revalidateTag(organizationAnalyticsCacheTag(organizationId))
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

const dashboardKpiRunnerByOrg = new Map<string, CachedKpiFn>()

/**
 * Per-organization cached KPI compute (60s) with tag invalidation on uploads.
 */
export function getCachedDashboardKpiRunner(organizationId: string): CachedKpiFn {
  let runner = dashboardKpiRunnerByOrg.get(organizationId)
  if (!runner) {
    runner = unstable_cache(
      async (
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
      },
      ['dashboard-kpi-v1', organizationId],
      { revalidate: 60, tags: [organizationAnalyticsCacheTag(organizationId)] }
    ) as CachedKpiFn
    dashboardKpiRunnerByOrg.set(organizationId, runner)
  }
  return runner
}
