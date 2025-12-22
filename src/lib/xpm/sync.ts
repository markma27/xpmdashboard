import { XeroClient } from 'xero-node'
import { getAuthenticatedXeroClient } from '../xero/client'
import { createServiceRoleClient } from '../supabase/service-role'

export interface SyncResult {
  tableName: string
  success: boolean
  count: number
  error?: string
}

/**
 * Sync XPM data from Xero API
 */
export async function syncXPMData(
  organizationId: string,
  tenantId: string,
  encryptedTokenSet: string,
  tableName?: string
): Promise<SyncResult[]> {
  const results: SyncResult[] = []
  const supabase = createServiceRoleClient()

  try {
    const xeroClient = await getAuthenticatedXeroClient(encryptedTokenSet)

    // Define tables to sync
    const tablesToSync = tableName
      ? [tableName]
      : [
          'clients',
          'clientgroups',
          'jobs',
          'tasks',
          'timeentries',
          'invoices',
          'staff',
          'quotes',
          'expenseclaims',
          'categories',
          'costs',
          'customfields',
          'templates',
        ]

    for (const table of tablesToSync) {
      try {
        const result = await syncTable(xeroClient, supabase, organizationId, tenantId, table)
        results.push(result)

        // Update sync metadata
        await updateSyncMetadata(supabase, organizationId, tenantId, table, result)
      } catch (error: any) {
        const errorResult: SyncResult = {
          tableName: table,
          success: false,
          count: 0,
          error: error.message,
        }
        results.push(errorResult)
        await updateSyncMetadata(supabase, organizationId, tenantId, table, errorResult)
      }
    }

    return results
  } catch (error: any) {
    throw new Error(`Sync failed: ${error.message}`)
  }
}

/**
 * Sync a single table
 */
async function syncTable(
  xeroClient: XeroClient,
  supabase: any,
  organizationId: string,
  tenantId: string,
  tableName: string
): Promise<SyncResult> {
  try {
    // Map table names to Xero API endpoints
    const apiEndpoint = getXeroAPIEndpoint(tableName)

    // Call Xero API
    const response = await xeroClient.accountingApi.getResource(apiEndpoint, tenantId)

    // Extract data from response
    const data = extractDataFromResponse(response, tableName)

    // Get last sync time for incremental sync
    const { data: metadata } = await supabase
      .from('xpm_sync_metadata')
      .select('last_sync_at')
      .eq('organization_id', organizationId)
      .eq('tenant_id', tenantId)
      .eq('table_name', tableName)
      .single()

    const lastSyncAt = metadata?.last_sync_at

    // Transform and save data
    let count = 0
    const tableNameDB = `xpm_${tableName}`

    for (const item of data) {
      const transformed = transformXPMData(item, organizationId, tenantId, tableName)

      // Upsert data
      const { error } = await supabase.from(tableNameDB).upsert(transformed, {
        onConflict: 'organization_id,xpm_id',
      })

      if (!error) {
        count++
      }
    }

    return {
      tableName,
      success: true,
      count,
    }
  } catch (error: any) {
    return {
      tableName,
      success: false,
      count: 0,
      error: error.message,
    }
  }
}

/**
 * Get Xero API endpoint for table name
 */
function getXeroAPIEndpoint(tableName: string): string {
  const endpointMap: Record<string, string> = {
    clients: '/Clients',
    clientgroups: '/ClientGroups',
    jobs: '/Jobs',
    tasks: '/Tasks',
    timeentries: '/TimeEntries',
    invoices: '/Invoices',
    staff: '/Staff',
    quotes: '/Quotes',
    expenseclaims: '/ExpenseClaims',
    categories: '/Categories',
    costs: '/Costs',
    customfields: '/CustomFields',
    templates: '/Templates',
  }

  return endpointMap[tableName] || `/${tableName}`
}

/**
 * Extract data from Xero API response
 */
function extractDataFromResponse(response: any, tableName: string): any[] {
  // Xero API responses vary by endpoint
  // This is a simplified version - you'll need to adjust based on actual API responses
  const key = tableName.charAt(0).toUpperCase() + tableName.slice(1)
  return response.body?.[key] || response.body || []
}

/**
 * Transform XPM data for storage
 */
function transformXPMData(
  item: any,
  organizationId: string,
  tenantId: string,
  tableName: string
): any {
  return {
    organization_id: organizationId,
    tenant_id: tenantId,
    xpm_id: item.id || item.ID || item.Id,
    raw_data: item,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Update sync metadata
 */
async function updateSyncMetadata(
  supabase: any,
  organizationId: string,
  tenantId: string,
  tableName: string,
  result: SyncResult
) {
  await supabase.from('xpm_sync_metadata').upsert(
    {
      organization_id: organizationId,
      tenant_id: tenantId,
      table_name: tableName,
      last_sync_at: new Date().toISOString(),
      last_sync_status: result.success ? 'success' : 'failed',
      last_sync_count: result.count,
      error_message: result.error || null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'organization_id,tenant_id,table_name',
    }
  )
}

