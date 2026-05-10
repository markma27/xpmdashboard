export type RecoverabilityFilter = { type: string; value: string; operator?: string }

export type RecoverabilityRpcParams = {
  staff: string | null
  clientGroup: string | null
  accountManager: string | null
  jobManager: string | null
}

export function recoverabilityFiltersToRpcParams(filters: RecoverabilityFilter[]): RecoverabilityRpcParams {
  const out: RecoverabilityRpcParams = {
    staff: null,
    clientGroup: null,
    accountManager: null,
    jobManager: null,
  }
  for (const f of filters) {
    if (f.type === 'account_manager' && f.value && f.value !== 'all') {
      out.accountManager = f.value
    } else if (f.type === 'job_manager' && f.value && f.value !== 'all') {
      out.jobManager = f.value
    } else if (f.type === 'client_group' && f.value) {
      out.clientGroup = f.value
    } else if (f.type === 'staff' && f.value && f.value !== 'all') {
      out.staff = f.value
    }
  }
  return out
}
