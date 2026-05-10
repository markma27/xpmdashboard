import type { DashboardKpiFilter } from '@/lib/queries/dashboard-kpi-query'

export type BillableRpcParams = {
  staff: string | null
  clientGroup: string | null
  accountManager: string | null
  jobManager: string | null
  jobName: string | null
  jobNameOperator: string | null
}

export function emptyBillableRpcParams(): BillableRpcParams {
  return {
    staff: null,
    clientGroup: null,
    accountManager: null,
    jobManager: null,
    jobName: null,
    jobNameOperator: null,
  }
}

/**
 * Parse `filters=a:b|c:d` query param used by billable report APIs.
 */
export function parsePipeBillableFilters(filtersParam: string | null): BillableRpcParams {
  const out = emptyBillableRpcParams()
  if (!filtersParam) return out

  filtersParam.split('|').forEach((filterStr) => {
    const parts = filterStr.split(':')
    if (parts.length >= 2) {
      if (parts.length === 3) {
        const type = parts[0]
        const operator = decodeURIComponent(parts[1])
        const value = decodeURIComponent(parts[2])
        if (!value || value === 'all') return
        if (type === 'job_name') {
          out.jobNameOperator = operator
          out.jobName = value
        } else {
          switch (type) {
            case 'staff':
              out.staff = value
              break
            case 'client_group':
              out.clientGroup = value
              break
            case 'account_manager':
              out.accountManager = value
              break
            case 'job_manager':
              out.jobManager = value
              break
          }
        }
      } else {
        const type = parts[0]
        const value = decodeURIComponent(parts[1])
        if (!value || value === 'all') return
        switch (type) {
          case 'staff':
            out.staff = value
            break
          case 'client_group':
            out.clientGroup = value
            break
          case 'account_manager':
            out.accountManager = value
            break
          case 'job_manager':
            out.jobManager = value
            break
          case 'job_name':
            out.jobName = value
            break
        }
      }
    }
  })
  return out
}

export function mergeBillableStaffUrlParam(
  staffFromUrl: string | null | undefined,
  parsed: BillableRpcParams
): BillableRpcParams {
  const staff =
    parsed.staff && parsed.staff !== 'all'
      ? parsed.staff
      : staffFromUrl && staffFromUrl !== 'all'
        ? staffFromUrl
        : null
  return { ...parsed, staff }
}

/**
 * Active dashboard KPI filters (exclude "all" and empty values).
 */
export function activeDashboardKpiFilters(filters: DashboardKpiFilter[]): DashboardKpiFilter[] {
  return filters.filter((f) => f.value && f.value !== 'all')
}

export function dashboardFiltersToBillableRpcParams(filters: DashboardKpiFilter[]): BillableRpcParams {
  const out = emptyBillableRpcParams()
  for (const f of filters) {
    if (!f.value || f.value === 'all') continue
    switch (f.type) {
      case 'staff':
        out.staff = f.value
        break
      case 'client_group':
        out.clientGroup = f.value
        break
      case 'account_manager':
        out.accountManager = f.value
        break
      case 'job_manager':
        out.jobManager = f.value
        break
      case 'job_name':
        out.jobName = f.value
        out.jobNameOperator = f.operator ?? null
        break
    }
  }
  return out
}
