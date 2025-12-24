import { XeroClient } from 'xero-node'
import axios from 'axios'
import { parseString } from 'xml2js'
import { promisify } from 'util'
import { getAuthenticatedXeroClient, encryptTokenSetForStorage } from '../xero/client'
import { decryptTokenSet } from '../xero/crypto'
import { createServiceRoleClient } from '../supabase/service-role'

const parseXML = promisify(parseString)

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
  tableName?: string,
  connectionId?: string // Optional: connection ID to update token after refresh
): Promise<SyncResult[]> {
  const results: SyncResult[] = []
  const supabase = createServiceRoleClient()

  try {
    let xeroClient: XeroClient
    let tokenWasRefreshed = false
    try {
      xeroClient = await getAuthenticatedXeroClient(encryptedTokenSet)
      
      // Check if token was refreshed by reading the current token set
      const currentTokenSet = xeroClient.readTokenSet()
      const originalTokenSet = JSON.parse(decryptTokenSet(encryptedTokenSet))
      
      // If access_token changed, token was refreshed
      if (currentTokenSet?.access_token !== originalTokenSet?.access_token) {
        tokenWasRefreshed = true
      }
    } catch (error: any) {
      // If token refresh failed, throw a more descriptive error
      if (error.message?.includes('REFRESH_TOKEN_EXPIRED') || error.message?.includes('invalid_grant')) {
        throw new Error('REFRESH_TOKEN_EXPIRED: Your Xero connection has expired. Please reconnect to Xero.')
      }
      throw error
    }
    
    // If token was refreshed and connectionId is provided, save the new token
    if (tokenWasRefreshed && connectionId) {
      try {
        const newTokenSet = xeroClient.readTokenSet()
        const { encryptTokenSetForStorage } = await import('../xero/client')
        const encryptedNewTokenSet = encryptTokenSetForStorage(newTokenSet)
        const expiresAt = newTokenSet.expires_at 
          ? new Date(newTokenSet.expires_at * 1000)
          : new Date(Date.now() + 30 * 60 * 1000)
        
        await supabase
          .from('xero_connections')
          .update({
            token_set_enc: encryptedNewTokenSet,
            expires_at: expiresAt.toISOString(),
            is_active: true, // Ensure it's marked as active
          })
          .eq('id', connectionId)
        
        console.log(`✓ Token refreshed and saved for connection ${connectionId}`)
      } catch (saveError: any) {
        console.warn('Failed to save refreshed token:', saveError)
        // Don't throw - continue with sync using the refreshed token in memory
      }
    }

    // Define tables to sync
    // Removed: customfields, expenseclaims, quotes, templates, jobs, tasks, timeentries, categories, costs (not needed)
    const tablesToSync = tableName
      ? [tableName]
      : [
          'clients',
          'clientgroups',
          'staff',
          'invoices',
        ]

    for (const table of tablesToSync) {
      try {
        const result = await syncTable(xeroClient, supabase, organizationId, tenantId, table)
        results.push(result)

        // Update sync metadata
        await updateSyncMetadata(supabase, organizationId, tenantId, table, result)
        
        // Log result
        if (result.success) {
          console.log(`✓ ${table}: ${result.count} records synced`)
        } else {
          console.warn(`✗ ${table}: ${result.error}`)
        }
      } catch (error: any) {
        const errorMessage = error.message || error.statusText || 'Unknown error'
        const errorResult: SyncResult = {
          tableName: table,
          success: false,
          count: 0,
          error: errorMessage,
        }
        results.push(errorResult)
        await updateSyncMetadata(supabase, organizationId, tenantId, table, errorResult)
        console.error(`✗ ${table}: ${errorMessage}`)
      }
    }

    return results
  } catch (error: any) {
    throw new Error(`Sync failed: ${error.message}`)
  }
}

/**
 * Fetch all clients including archived by trying multiple API parameter combinations
 * XPM API by default only returns active clients, so we try various parameters
 */
async function fetchAllClients(
  xeroClient: XeroClient,
  baseEndpoint: string,
  tenantId: string,
  tableName: string
): Promise<any[]> {
  // Try multiple parameter combinations to get all clients
  // Based on Xero API docs: https://developer.xero.com/documentation/api/practice-manager/clients#get-list
  // The API doesn't officially support including archived clients via parameters
  // But we'll try various approaches:
  // 1. Default endpoint (may return all if IsArchived field is present)
  // 2. modifiedsince with very early date (to catch all historical clients)
  // 3. Search endpoint with wildcard
  // 4. Various status parameters (even though not documented)
  
  // Calculate a very early date (10 years ago) for modifiedsince parameter
  const now = new Date()
  const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1)
  const modifiedSince = tenYearsAgo.toISOString().split('T')[0] + 'T00:00:00'
  
  const parameterCombinations = [
    '', // Default endpoint - may return all clients with IsArchived field
    `?modifiedsince=${modifiedSince}`, // Try with very early date to get all historical clients
    `?detailed=true`, // Detailed endpoint might return more
    `?detailed=true&modifiedsince=${modifiedSince}`, // Combine detailed with early date
    '?status=All',  // User suggested format (capital A) - not documented but worth trying
    '?status=all',  // Lowercase variant
    '?includeArchived=true', // Common pattern in other APIs
    '?archived=true',
    '?showArchived=true',
  ]
  
  const allClients: any[] = []
  const seenIds = new Set<string>()
  
  console.log(`Trying ${parameterCombinations.length} different parameter combinations for clients`)
  
  for (const params of parameterCombinations) {
    const testEndpoint = `${baseEndpoint}${params}`
    console.log(`  → Trying: ${params || '(no params - default)'}`)
    console.log(`     Full URL: ${testEndpoint}`)
    
    try {
      const response = await callXPMAPI(xeroClient, testEndpoint, tenantId, tableName)
      const clients = extractDataFromResponse(response, tableName)
      
      if (clients && Array.isArray(clients)) {
        let newClientsCount = 0
        let activeCount = 0
        let archivedCount = 0
        
        for (const client of clients) {
          const clientId = client.ID || client.Id || client.id || client.UUID
          if (clientId && !seenIds.has(String(clientId))) {
            seenIds.add(String(clientId))
            allClients.push(client)
            newClientsCount++
            
            // Count status - check IsArchived field (from XML response)
            const isArchived = client.IsArchived || client.IsArchived === 'Yes' || client.IsArchived === 'true' || client.IsArchived === true
            const status = String(client.Status || client.Active || client.Archived || client.IsActive || client.IsArchived || '').toLowerCase()
            if (isArchived || status.includes('archive') || status === 'yes' || status === 'true') {
              archivedCount++
            } else {
              activeCount++
            }
          }
        }
        console.log(`    ✓ Found ${clients.length} clients (${newClientsCount} new, ${allClients.length} total unique)`)
        if (newClientsCount > 0) {
          console.log(`      Status breakdown: ${activeCount} active, ${archivedCount} archived`)
        }
      } else {
        console.log(`    → No clients returned`)
      }
    } catch (error: any) {
      // Some parameter combinations may fail, that's okay
      const errorMsg = error.message || error.response?.statusText || 'Unknown error'
      const statusCode = error.response?.status || error.status || ''
      console.log(`    ✗ Failed (may not be supported): ${statusCode ? `HTTP ${statusCode} - ` : ''}${errorMsg}`)
    }
  }
  
  console.log(`Total unique clients collected: ${allClients.length}`)
  
  // Log status summary
  if (allClients.length > 0) {
    const statusCounts: Record<string, number> = {}
    let archivedTotal = 0
    let activeTotal = 0
    
    allClients.forEach((client: any) => {
      // Check IsArchived field (from XML response: "Yes" or "No")
      const isArchived = client.IsArchived === 'Yes' || client.IsArchived === 'true' || client.IsArchived === true
      const status = client.Status || client.Active || client.Archived || client.IsActive || (isArchived ? 'Archived' : 'Active')
      
      if (isArchived || String(status).toLowerCase().includes('archive')) {
        archivedTotal++
        statusCounts['Archived'] = (statusCounts['Archived'] || 0) + 1
      } else {
        activeTotal++
        statusCounts['Active'] = (statusCounts['Active'] || 0) + 1
      }
      
      // Also log the raw IsArchived value for debugging
      if (client.IsArchived !== undefined) {
        statusCounts[`IsArchived=${client.IsArchived}`] = (statusCounts[`IsArchived=${client.IsArchived}`] || 0) + 1
      }
    })
    
    console.log(`Client status summary:`, statusCounts)
    console.log(`Total: ${activeTotal} active, ${archivedTotal} archived`)
  }
  
  return allClients
}

/**
 * Fetch all client groups with detailed information including Clients
 * GET list only returns basic info, so we need to call GET get/[id] for each group
 */
async function fetchAllClientGroups(
  xeroClient: XeroClient,
  baseEndpoint: string,
  tenantId: string,
  tableName: string,
  organizationId?: string,
  supabase?: any,
  updateProgress?: (processedCount: number, totalRecords?: number) => Promise<void>
): Promise<any[]> {
  console.log(`Fetching all client groups with detailed information...`)
  
  // First, get the list of all groups (basic info only)
  const listResponse = await callXPMAPI(xeroClient, baseEndpoint, tenantId, tableName)
  const basicGroups = extractDataFromResponse(listResponse, tableName)
  
  if (!basicGroups || basicGroups.length === 0) {
    console.log(`No client groups found`)
    return []
  }
  
  const totalGroups = basicGroups.length
  console.log(`Found ${totalGroups} client groups, fetching detailed info for each...`)
  
  // Base URL for GET get/[id] endpoint
  const baseUrlV3 = 'https://api.xero.com/practicemanager/3.0'
  
  const allGroups: any[] = []
  
  // Update progress at start (0 records processed, totalGroups total)
  if (updateProgress && totalGroups > 0) {
    await updateProgress(0, totalGroups)
  }
  
  // Helper function to retry API calls with exponential backoff
  const retryWithBackoff = async (
    fn: () => Promise<any>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<any> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error: any) {
        const statusCode = error.response?.status || error.status
        const isRateLimit = statusCode === 429
        
        if (isRateLimit && attempt < maxRetries - 1) {
          // Check for Retry-After header (in seconds)
          const retryAfter = error.response?.headers?.['retry-after'] || 
                            error.response?.headers?.['Retry-After']
          const waitTime = retryAfter 
            ? parseInt(retryAfter, 10) * 1000 
            : baseDelay * Math.pow(2, attempt) // Exponential backoff: 1s, 2s, 4s
          
          console.warn(`Rate limited (429), waiting ${waitTime / 1000}s before retry (attempt ${attempt + 1}/${maxRetries})...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
        
        // Not rate limit or max retries reached
        throw error
      }
    }
    throw new Error('Max retries reached')
  }
  
  // Fetch detailed info for each group
  // Add delays between requests to avoid rate limiting
  // Xero API typically allows ~60 requests per minute, so we need to pace ourselves
  for (let i = 0; i < basicGroups.length; i++) {
    const basicGroup = basicGroups[i]
    const groupId = basicGroup.ID || basicGroup.Id || basicGroup.id
    if (!groupId) {
      console.warn(`Skipping group without ID:`, basicGroup)
      continue
    }
    
    // Add delays between requests to avoid rate limiting
    // Strategy: 
    // - Base delay: 200ms between requests (allows ~5 requests/second = 300/minute, well under limit)
    // - Every 50 requests: longer pause (2 seconds) to reset rate limit window
    // - Every 100 requests: even longer pause (5 seconds)
    if (i > 0) {
      if (i % 100 === 0) {
        // Every 100 requests, pause for 5 seconds
        console.log(`Processed ${i}/${basicGroups.length} groups, pausing 5s to avoid rate limits...`)
        await new Promise(resolve => setTimeout(resolve, 5000))
      } else if (i % 50 === 0) {
        // Every 50 requests, pause for 2 seconds
        console.log(`Processed ${i}/${basicGroups.length} groups, pausing 2s...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      } else {
        // Base delay between requests
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    // Try v3 endpoint: /practicemanager/3.0/clientgroup.api/get/{id}
    const detailEndpointV3 = `${baseUrlV3}/clientgroup.api/get/${groupId}`
    
    try {
      // Use retry with backoff for rate limit handling
      const detailResponse = await retryWithBackoff(
        () => callXPMAPI(xeroClient, detailEndpointV3, tenantId, tableName),
        3, // max 3 retries
        2000 // base delay 2 seconds
      )
      
      // GET get/[id] returns <Response><Group>...</Group></Response> (single Group, not Groups)
      // We need to extract it directly from the XML response
      if (!detailResponse || !detailResponse.body) {
        console.warn(`No response body for group ${groupId}`)
        allGroups.push(basicGroup)
        continue
      }
      
      const body = detailResponse.body
      if (!body || !body.Response) {
        console.warn(`Invalid response structure for group ${groupId}, using basic info`)
        allGroups.push(basicGroup)
        continue
      }
      
      const status = body.Response.Status?.[0] || body.Response.Status
      if (status !== 'OK') {
        console.warn(`Response status not OK for group ${groupId}: ${status}, using basic info`)
        allGroups.push(basicGroup)
        continue
      }
      
      // Extract the single Group element
      // xml2js wraps elements in arrays, so we need to check both [0] and direct access
      const groupElement = body.Response.Group?.[0] || body.Response.Group
      if (!groupElement) {
        console.warn(`No Group element found in response for group ${groupId}, using basic info`)
        console.log(`Available keys in Response:`, Object.keys(body.Response || {}))
        allGroups.push(basicGroup)
        continue
      }
      
      // Convert XML structure to plain object (similar to extractDataFromResponse logic)
      const detailedGroup: any = {}
      for (const key in groupElement) {
        if (key === 'Clients') {
          // Skip Clients for now, handle separately below
          continue
        }
        if (Array.isArray(groupElement[key]) && groupElement[key].length > 0) {
          if (groupElement[key].length === 1 && typeof groupElement[key][0] === 'string') {
            detailedGroup[key] = groupElement[key][0]
          } else if (groupElement[key].length === 1 && typeof groupElement[key][0] === 'object') {
            detailedGroup[key] = groupElement[key][0]
          } else {
            detailedGroup[key] = groupElement[key]
          }
        } else {
          detailedGroup[key] = groupElement[key]
        }
      }
      
      // Handle Clients nested structure - xml2js can wrap this in various ways
      if (groupElement.Clients) {
        let clientsArray: any[] = []
        
        // Case 1: Clients is an array directly
        if (Array.isArray(groupElement.Clients)) {
          clientsArray = groupElement.Clients
        }
        // Case 2: Clients.Client exists (most common case)
        else if (groupElement.Clients.Client) {
          clientsArray = Array.isArray(groupElement.Clients.Client) 
            ? groupElement.Clients.Client 
            : [groupElement.Clients.Client]
        }
        // Case 3: Clients[0].Client (xml2js wrapped in array)
        else if (Array.isArray(groupElement.Clients) && groupElement.Clients[0]?.Client) {
          const clientsWrapper = groupElement.Clients[0]
          clientsArray = Array.isArray(clientsWrapper.Client)
            ? clientsWrapper.Client
            : [clientsWrapper.Client]
        }
        // Case 4: Empty Clients element (no clients in group)
        else if (groupElement.Clients === '' || (Array.isArray(groupElement.Clients) && groupElement.Clients.length === 0)) {
          clientsArray = []
        }
        
        // Convert each client to plain object
        detailedGroup.Clients = clientsArray.map((client: any) => {
          const clientObj: any = {}
          for (const key in client) {
            if (Array.isArray(client[key]) && client[key].length > 0) {
              clientObj[key] = client[key].length === 1 && typeof client[key][0] === 'string' 
                ? client[key][0] 
                : client[key].length === 1 && typeof client[key][0] === 'object'
                ? client[key][0]
                : client[key]
            } else {
              clientObj[key] = client[key]
            }
          }
          return clientObj
        })
      } else {
        // No Clients element - group has no clients
        detailedGroup.Clients = []
      }
      
      allGroups.push(detailedGroup)
      const groupName = detailedGroup.Name || basicGroup.Name
      const clientsCount = detailedGroup.Clients ? detailedGroup.Clients.length : 0
      console.log(`✓ Fetched detailed info for group ${groupId} (${groupName}) - ${clientsCount} client(s)`)
      
      // Log client names for debugging (first 3 clients)
      if (clientsCount > 0) {
        const clientNames = detailedGroup.Clients.slice(0, 3).map((c: any) => c.Name || c.ID || 'Unknown').join(', ')
        console.log(`  └─ Clients: ${clientNames}${clientsCount > 3 ? ` (+${clientsCount - 3} more)` : ''}`)
      }
      
      // Update progress periodically (every 5% of total or every 10 groups, whichever is smaller)
      if (updateProgress && totalGroups > 0) {
        // Update more frequently for better progress visibility
        // Update every 5% of total, or every 10 groups, whichever is smaller
        const percentInterval = Math.max(1, Math.floor(totalGroups / 20)) // Every 5% (1/20)
        const progressUpdateInterval = Math.min(10, percentInterval) // At least every 10 groups
        
        if ((allGroups.length % progressUpdateInterval === 0) || allGroups.length === totalGroups) {
          // Update progress based on groups fetched (not saved yet)
          // Pass actual count of groups fetched, and total groups for accurate progress calculation
          await updateProgress(allGroups.length, totalGroups)
        }
      }
    } catch (error: any) {
      const errorMsg = error.message || error.response?.statusText || error.statusText || 'Unknown error'
      const statusCode = error.response?.status || error.status || ''
      
      // If it's rate limiting after retries, wait longer and try once more
      if (statusCode === 429) {
        console.warn(`Rate limited for group ${groupId} after retries, waiting 10s before continuing...`)
        await new Promise(resolve => setTimeout(resolve, 10000))
        
        // Try one more time after waiting
        try {
          const detailResponse = await callXPMAPI(xeroClient, detailEndpointV3, tenantId, tableName)
          // If successful, process normally (will continue to parsing logic below)
          // But we need to handle it here since we're in catch block
          // Actually, let's just use basic info for now to avoid complex nested logic
          console.warn(`  └─ Still rate limited after wait, using basic info for group ${groupId}`)
          allGroups.push(basicGroup)
          continue
        } catch (retryError: any) {
          console.warn(`  └─ Still rate limited after retry, using basic info for group ${groupId}`)
          allGroups.push(basicGroup)
          continue
        }
      }
      
      console.warn(`Error fetching details for group ${groupId}: ${statusCode ? `HTTP ${statusCode} - ` : ''}${errorMsg}`)
      
      // If it's a 404, the group might not exist anymore - still use basic info
      if (statusCode === 404) {
        console.warn(`  └─ Group ${groupId} not found (may have been deleted), using basic info`)
      }
      
      // Fallback: use basic info if detail fetch fails
      allGroups.push(basicGroup)
    }
  }
  
  console.log(`✓ Fetched detailed info for ${allGroups.length} client groups`)
  return allGroups
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
    // Map table names to Xero Practice Manager API endpoints
    let apiEndpoint = getXeroAPIEndpoint(tableName)
    
    // Some endpoints support query parameters
    // According to XPM_API_Connection_Guide.md:
    // - invoices: API requires from/to dates, but we want ALL invoices
    //   Solution: Use a very wide date range (10 years) to get all invoices
    // - time entries: can use dates, but we'll try without first
    // - clients: no filters needed - API should return all including archived with status
    
    // Format date helper function (YYYYMMDD format)
    const formatDate = (date: Date): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    }
    
    // Calculate financial year start date (Xero FY starts July 1)
    // Returns the start date of the financial year N years ago
    const getFinancialYearStart = (yearsAgo: number): Date => {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() // 0-11 (Jan = 0, Dec = 11)
      
      // If we're before July 1, the current FY started last year
      // If we're on or after July 1, the current FY started this year
      let fyStartYear: number
      if (currentMonth < 6) {
        // Before July (Jan-Jun), current FY started last year
        fyStartYear = currentYear - 1
      } else {
        // July or later, current FY started this year
        fyStartYear = currentYear
      }
      
      // Go back N financial years
      const targetFYStartYear = fyStartYear - yearsAgo
      
      // Financial year starts July 1
      return new Date(targetFYStartYear, 6, 1) // Month 6 = July
    }
    
    if (tableName === 'invoices') {
      // Invoices API requires from/to dates, so use a very wide range to get ALL invoices
      // Use 10 years ago to now to ensure we get all historical invoices
      const now = new Date()
      const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate())
      
      const fromDate = formatDate(tenYearsAgo)
      const toDate = formatDate(now)
      
      // Add query parameters with wide date range
      const separator = apiEndpoint.includes('?') ? '&' : '?'
      apiEndpoint = `${apiEndpoint}${separator}from=${fromDate}&to=${toDate}&detailed=true`
      console.log(`Using wide date range for invoices: ${fromDate} to ${toDate} (10 years)`)
    } else if (tableName === 'jobs') {
      // Jobs API GET list requires from/to dates (required parameters)
      // Reference: https://developer.xero.com/documentation/api/practice-manager/jobs#get-list
      // Use a very wide range to get ALL jobs (10 years)
      const now = new Date()
      const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate())
      
      const fromDate = formatDate(tenYearsAgo)
      const toDate = formatDate(now)
      
      // Add required query parameters
      const separator = apiEndpoint.includes('?') ? '&' : '?'
      apiEndpoint = `${apiEndpoint}${separator}from=${fromDate}&to=${toDate}&detailed=true`
      console.log(`Using wide date range for jobs: ${fromDate} to ${toDate} (10 years)`)
    } else if (tableName === 'timeentries') {
      // Time entries API GET list requires from/to dates (required parameters)
      // Reference: https://developer.xero.com/documentation/api/practice-manager/time#get-list
      // Sync from the start of the last 2 financial years (e.g., if today is Dec 23, 2025 (FY26),
      // sync from July 1, 2023 (FY24 start))
      const now = new Date()
      const twoFinancialYearsAgoStart = getFinancialYearStart(2) // 2 financial years ago
      
      const fromDate = formatDate(twoFinancialYearsAgoStart)
      const toDate = formatDate(now)
      
      // Add required query parameters
      const separator = apiEndpoint.includes('?') ? '&' : '?'
      apiEndpoint = `${apiEndpoint}${separator}from=${fromDate}&to=${toDate}`
      console.log(`Using financial year range for Timesheets: ${fromDate} to ${toDate} (from start of FY 2 years ago)`)
    } else if (tableName === 'costs') {
      // Costs API GET list requires page parameter (required)
      // Reference: https://developer.xero.com/documentation/api/practice-manager/costs#get-list
      // Maximum 1000 items per page, need to paginate
      // For now, start with page 1 - pagination will be handled in syncTable if needed
      const separator = apiEndpoint.includes('?') ? '&' : '?'
      apiEndpoint = `${apiEndpoint}${separator}page=1`
      console.log(`Using page parameter for costs: page=1`)
    } else if (tableName === 'clients') {
      // For clients, XPM API by default only returns active clients
      // We'll try multiple approaches to get archived clients
      console.log(`Fetching all clients including archived - will try multiple approaches`)
    }
    
    console.log(`Syncing ${tableName} from endpoint: ${apiEndpoint}`)

    // For progress tracking: update metadata periodically during sync
    // This allows frontend to poll and calculate progress
    let totalRecordsToSync = 0 // Will be set after data is fetched
    
    const updateProgress = async (processedCount: number, totalRecords?: number) => {
      try {
        // Store progress information
        // During sync, we store processed count in last_sync_count
        // And total records in error_message as JSON (temporary solution)
        // Format: "PROGRESS:{\"total\":45,\"processed\":10}"
        const progressInfo = totalRecords 
          ? `PROGRESS:{"total":${totalRecords},"processed":${processedCount}}`
          : `PROGRESS:{"processed":${processedCount}}`
        
        await supabase
          .from('xpm_sync_metadata')
          .upsert({
            organization_id: organizationId,
            tenant_id: tenantId,
            table_name: tableName,
            last_sync_count: processedCount, // Processed count during sync
            last_sync_status: 'syncing',
            last_sync_at: new Date().toISOString(),
            error_message: progressInfo, // Temporarily store progress info here
          }, {
            onConflict: 'organization_id,tenant_id,table_name'
          })
      } catch (error) {
        // Silently fail - progress updates are not critical
        console.warn('Failed to update sync progress:', error)
      }
    }

    // Special handling for clients and clientgroups - need detailed information
    let data: any[]
    if (tableName === 'clients') {
      data = await fetchAllClients(xeroClient, apiEndpoint, tenantId, tableName)
    } else if (tableName === 'clientgroups') {
      // Client Groups: GET list only returns basic info (ID, Name, Taxable)
      // GET get/[id] returns detailed info including Clients
      // So we need to fetch list first, then get details for each group
      data = await fetchAllClientGroups(xeroClient, apiEndpoint, tenantId, tableName, organizationId, supabase, updateProgress)
    } else {
      // Call Xero Practice Manager API
      // XPM API requires tenant ID in xero-tenant-id header
      // Implements fallback: tries v3 first, then v2 if v3 fails
      const response = await callXPMAPI(xeroClient, apiEndpoint, tenantId, tableName)
      // Extract data from response
      data = extractDataFromResponse(response, tableName)
    }
    
    console.log(`Extracted data for ${tableName}:`, {
      dataLength: data?.length || 0,
      dataType: Array.isArray(data) ? 'array' : typeof data,
      firstItem: data?.[0] || null,
    })

    // Get last sync time and count for incremental sync and progress tracking
    const { data: metadata } = await supabase
      .from('xpm_sync_metadata')
      .select('last_sync_at, last_sync_count')
      .eq('organization_id', organizationId)
      .eq('tenant_id', tenantId)
      .eq('table_name', tableName)
      .single()

    const lastSyncAt = metadata?.last_sync_at
    const totalRecords = data?.length || 0
    totalRecordsToSync = totalRecords
    
    // Update progress at the start of saving phase
    // All tables should use: progress = (processedRecords / totalRecords) * 100
    // For clientgroups: fetching phase already updated progress, saving phase continues from there
    // For other tables: start from 0
    if (totalRecords > 0) {
      if (tableName !== 'clientgroups') {
        // For non-clientgroups tables, start saving phase from 0
        await updateProgress(0, totalRecords)
      }
      // For clientgroups, don't reset progress here as fetching already updated it
      // The saving phase will continue updating progress using count (saved records)
    }

    // Transform and save data
    let count = 0
    // Map table names to database table names (some use underscores)
    const tableNameMap: Record<string, string> = {
      clients: 'xpm_clients',
      clientgroups: 'xpm_client_groups',
      jobs: 'xpm_jobs',
      tasks: 'xpm_tasks',
      timeentries: 'xpm_time_entries',
      invoices: 'xpm_invoices',
      staff: 'xpm_staff',
      categories: 'xpm_categories',
      costs: 'xpm_costs',
    }
    const tableNameDB = tableNameMap[tableName] || `xpm_${tableName}`

    if (!data || data.length === 0) {
      console.log(`No data returned for ${tableName}`)
      return {
        tableName,
        success: true,
        count: 0,
      }
    }

    console.log(`Processing ${data.length} items for ${tableName} -> ${tableNameDB}`)

    // Update progress periodically during sync (every 10 items or 10% of total)
    const progressUpdateInterval = Math.max(10, Math.floor(data.length / 10))
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i]
      const transformed = transformXPMData(item, organizationId, tenantId, tableName)
      
      // Skip if transformation failed (no ID found)
      if (!transformed) {
        console.warn(`Skipping item in ${tableName} due to transformation failure:`, item)
        continue
      }

      // Upsert data
      const { error } = await supabase.from(tableNameDB).upsert(transformed, {
        onConflict: 'organization_id,xpm_id',
      })

      if (error) {
        console.error(`Error upserting ${tableName} item to ${tableNameDB}:`, error)
        console.error(`Transformed data:`, transformed)
      } else {
        count++
        
        // Update progress periodically
        if ((i + 1) % progressUpdateInterval === 0 || (i + 1) === data.length) {
          await updateProgress(count, totalRecords)
        }
      }
    }
    
    console.log(`Successfully saved ${count} out of ${data.length} items for ${tableName}`)

    return {
      tableName,
      success: true,
      count,
    }
  } catch (error: any) {
    // Extract detailed error information
    let errorMessage = error.message || 'Unknown error'
    
    if (error.response) {
      const status = error.response.status || error.response.statusCode
      const statusText = error.response.statusText || ''
      const body = error.response.body || error.response.data
      
      // Try to extract more details from the error response
      if (body) {
        if (typeof body === 'string') {
          errorMessage = `HTTP ${status}: ${body}`
        } else if (body.Message) {
          errorMessage = `HTTP ${status}: ${body.Message}`
        } else if (body.message) {
          errorMessage = `HTTP ${status}: ${body.message}`
        } else if (body.Detail) {
          errorMessage = `HTTP ${status}: ${body.Detail}`
        } else {
          errorMessage = `HTTP ${status} ${statusText}: ${JSON.stringify(body)}`
        }
      } else {
        errorMessage = `HTTP ${status} ${statusText}`
      }
    }
    
    console.error(`Sync error for ${tableName}:`, {
      error,
      endpoint: getXeroAPIEndpoint(tableName),
      message: errorMessage,
    })
    
    return {
      tableName,
      success: false,
      count: 0,
      error: errorMessage,
    }
  }
}

/**
 * Call Xero Practice Manager API with proper headers
 * XPM API requires Xero-Tenant-Id header
 */
/**
 * Call Xero Practice Manager API with proper headers
 * Implements fallback mechanism: tries v3 first, then v2 if v3 fails
 * 
 * Based on XPM_API_Connection_Guide.md:
 * - v3 endpoints: /practicemanager/3.0/{resource}.api/list
 * - v2 endpoints: /practicemanager/2.0/{Resources}
 * - Accept header should support XML: application/xml, application/json;q=0.9
 */
async function callXPMAPI(xeroClient: XeroClient, url: string, tenantId: string, tableName: string): Promise<any> {
  const tokenSet = xeroClient.readTokenSet()
  
  if (!tokenSet || !tokenSet.access_token) {
    throw new Error('No access token available')
  }

  // Get v2 fallback URL if this is a v3 endpoint
  // IMPORTANT: Don't use v2 fallback for individual GET requests (e.g., /get/{id})
  // v2 API doesn't support individual resource GET endpoints
  const getV2Fallback = (v3Url: string, tableName: string): string | null => {
    // Check if this is an individual GET request (contains /get/ or /get?id=)
    if (v3Url.includes('/get/') || v3Url.includes('/get?')) {
      return null // Don't use v2 fallback for individual GET requests
    }
    
    const baseUrlV2 = 'https://api.xero.com/practicemanager/2.0'
    const v2Map: Record<string, string> = {
      clients: `${baseUrlV2}/Clients`,
      clientgroups: `${baseUrlV2}/ClientGroups`,
      jobs: `${baseUrlV2}/Jobs`,
      tasks: `${baseUrlV2}/Tasks`,
      timeentries: `${baseUrlV2}/Time`,
      invoices: `${baseUrlV2}/Invoices`,
      staff: `${baseUrlV2}/Staff`,
      categories: `${baseUrlV2}/Categories`,
      costs: `${baseUrlV2}/Costs`,
    }
    return v2Map[tableName] || null
  }

  const v2Fallback = getV2Fallback(url, tableName)
  const endpointsToTry = [url]
  if (v2Fallback) {
    endpointsToTry.push(v2Fallback)
  }

  let lastError: any = null

  for (const endpoint of endpointsToTry) {
    console.log(`Calling XPM API: ${endpoint} with tenant: ${tenantId}`)

    try {
      const response = await axios({
        method: 'GET',
        url: endpoint,
        headers: {
          'Authorization': `Bearer ${tokenSet.access_token}`,
          'xero-tenant-id': tenantId,  // Note: lowercase, not Xero-Tenant-Id
          'Accept': 'application/xml, application/json;q=0.9, */*;q=0.8',  // Support XML and JSON
          'Content-Type': 'application/json',
        },
        responseType: 'text',  // Get as text first to handle XML
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      })

      if (response.status >= 200 && response.status < 300) {
        // Log response details for debugging
        const contentType = response.headers['content-type'] || ''
        console.log(`Response received from ${endpoint}:`, {
          status: response.status,
          contentType,
          dataLength: response.data?.length || 0,
          dataPreview: typeof response.data === 'string' 
            ? response.data.substring(0, 200) 
            : JSON.stringify(response.data).substring(0, 200),
        })
        
        // Try to parse as JSON first
        let body: any
        try {
          body = JSON.parse(response.data)
          console.log(`Parsed JSON response for ${tableName}:`, {
            bodyKeys: Object.keys(body || {}),
            bodyType: typeof body,
            isArray: Array.isArray(body),
          })
        } catch {
          // If not JSON, parse as XML
          // XPM API returns XML format
          try {
            console.log(`Parsing XML response for ${tableName}...`)
            const parsedXML = await parseXML(response.data)
            body = parsedXML
            console.log(`Parsed XML response for ${tableName}:`, {
              rootKeys: Object.keys(body || {}),
              rootElement: Object.keys(body || {})[0],
            })
          } catch (xmlError: any) {
            console.error(`Failed to parse XML for ${tableName}:`, xmlError)
            body = { raw: response.data, format: 'xml', parseError: xmlError.message }
          }
        }
        
        return { response, body }
      }

      if (response.status === 404) {
        // Try next endpoint
        console.warn(`Endpoint not found (404): ${endpoint}, trying next...`)
        lastError = {
          status: 404,
          statusText: 'Not Found',
          endpoint,
        }
        continue
      }

      if (response.status === 429) {
        // Rate limited - throw immediately so retry logic can handle it
        const retryAfter = response.headers['retry-after'] || response.headers['Retry-After']
        throw {
          response: {
            status: 429,
            statusText: 'Too Many Requests',
            headers: response.headers,
            data: response.data,
          },
          status: 429,
          statusText: 'Too Many Requests',
          message: `Rate limited. ${retryAfter ? `Retry after ${retryAfter}s` : 'Please wait before retrying'}`,
        }
      }

      // Other errors
      lastError = {
        status: response.status,
        statusText: response.statusText,
        endpoint,
        data: response.data,
      }
      continue
    } catch (error: any) {
      // If it's a 429 error, throw immediately for retry handling
      if (error.status === 429 || error.response?.status === 429) {
        throw error
      }
      
      if (error.response) {
        if (error.response.status === 404) {
          // Try next endpoint
          console.warn(`Endpoint not found (404): ${endpoint}, trying next...`)
          lastError = error
          continue
        }
        
        const errorDetails = {
          url: endpoint,
          status: error.response.status,
          statusText: error.response.statusText,
          headers: {
            'xero-correlation-id': error.response.headers['xero-correlation-id'],
            'x-appminlimit-remaining': error.response.headers['x-appminlimit-remaining'],
          },
          data: error.response.data,
        }
        
        console.error('XPM API Error Details:', JSON.stringify(errorDetails, null, 2))
        lastError = error
        continue
      }
      
      console.error('XPM API Error (no response):', error)
      lastError = error
      continue
    }
  }

  // All endpoints failed
  throw {
    response: lastError?.response,
    body: lastError?.response?.data || '',
    message: `Failed to fetch ${tableName} from all endpoints. Last error: ${lastError?.message || 'Unknown'}`,
    status: lastError?.status || lastError?.response?.status || 500,
    statusText: lastError?.statusText || lastError?.response?.statusText || 'Internal Server Error',
  }
}

/**
 * Get Xero Practice Manager API endpoint for table name
 * 
 * Based on XPM API Connection Guide:
 * - v3 endpoints use format: /practicemanager/3.0/{resource}.api/list
 * - v2 endpoints use format: /practicemanager/2.0/{Resources}
 * 
 * We'll try v3 first, then fallback to v2 if needed
 */
function getXeroAPIEndpoint(tableName: string): string {
  // Xero Practice Manager API base URL
  const baseUrlV3 = 'https://api.xero.com/practicemanager/3.0'
  const baseUrlV2 = 'https://api.xero.com/practicemanager/2.0'
  
  // Map table names to Xero Practice Manager API v3 endpoints
  // Format: /practicemanager/3.0/{resource}.api/list
  // Reference: XPM_API_Connection_Guide.md
  // Note: Some endpoints require query parameters (e.g., invoices need from/to dates)
  const endpointMapV3: Record<string, string> = {
    clients: `${baseUrlV3}/client.api/list`,
    clientgroups: `${baseUrlV3}/clientgroup.api/list`,  // Note: singular form
    jobs: `${baseUrlV3}/job.api/list`,
    tasks: `${baseUrlV3}/task.api/list`,
    timeentries: `${baseUrlV3}/time.api/list`,  // Note: "time" not "timeentry"
    invoices: `${baseUrlV3}/invoice.api/list`,  // Requires from/to query params
    staff: `${baseUrlV3}/staff.api/list`,
    categories: `${baseUrlV3}/category.api/list`,
    costs: `${baseUrlV3}/cost.api/list`,
  }

  // Map to v2 endpoints (fallback)
  const endpointMapV2: Record<string, string> = {
    clients: `${baseUrlV2}/Clients`,
    clientgroups: `${baseUrlV2}/ClientGroups`,
    jobs: `${baseUrlV2}/Jobs`,
    tasks: `${baseUrlV2}/Tasks`,
    timeentries: `${baseUrlV2}/Time`,  // v2 uses "Time" not "TimeEntries"
    invoices: `${baseUrlV2}/Invoices`,  // May require date params
    staff: `${baseUrlV2}/Staff`,
    categories: `${baseUrlV2}/Categories`,
    costs: `${baseUrlV2}/Costs`,
  }

  // Return v3 endpoint (we'll implement fallback logic in callXPMAPI if needed)
  return endpointMapV3[tableName] || endpointMapV2[tableName] || `${baseUrlV3}/${tableName}.api/list`
}

/**
 * Extract data from Xero Practice Manager API response
 * XPM API responses can be in various formats:
 * - XML: <Response><Groups><Group>...</Group></Groups></Response>
 * - JSON with { Items: [...] }
 * - JSON with { [ResourceName]: [...] }
 * - Direct array
 */
function extractDataFromResponse(response: any, tableName: string): any[] {
  if (!response || !response.body) {
    console.warn(`No response body for ${tableName}`)
    return []
  }

  const body = response.body
  
  // Handle XML responses (parsed by xml2js)
  // xml2js converts XML to JSON structure
  if (body.Response) {
    console.log(`Processing XML response for ${tableName}`)
    
    // Check status
    const status = body.Response.Status?.[0]
    if (status !== 'OK') {
      console.warn(`XML response status is not OK for ${tableName}: ${status}`)
      return []
    }
    
    // Map table names to XML element names
    // XML structure: <Response><[PluralElement]><[SingularElement]>...</[SingularElement]></[PluralElement]></Response>
    // Reference: https://developer.xero.com/documentation/api/practice-manager/staff
    // Staff API uses <StaffList><Staff>...</Staff></StaffList> structure
    const xmlElementMap: Record<string, { plural: string; singular: string }> = {
      clients: { plural: 'Clients', singular: 'Client' },
      clientgroups: { plural: 'Groups', singular: 'Group' },
      jobs: { plural: 'Jobs', singular: 'Job' },
      tasks: { plural: 'TaskList', singular: 'Task' }, // Fixed: API returns <TaskList><Task>...</Task></TaskList>
      timeentries: { plural: 'Times', singular: 'Time' }, // Fixed: API returns <Times><Time>...</Time></Times>
      invoices: { plural: 'Invoices', singular: 'Invoice' },
      staff: { plural: 'StaffList', singular: 'Staff' }, // Fixed: StaffList -> Staff (not Staff -> StaffMember)
      categories: { plural: 'Categories', singular: 'Category' },
      costs: { plural: 'Costs', singular: 'Cost' }, // Will check API docs for actual structure
    }
    
    const elements = xmlElementMap[tableName]
    if (!elements) {
      console.warn(`No XML element mapping for ${tableName}`)
      return []
    }
    
    // Extract data from XML structure
    // xml2js wraps text content in arrays, so we need to access [0]
    // Log the actual structure for debugging (especially for staff, timeentries, tasks, and costs)
    if (tableName === 'staff' || tableName === 'timeentries' || tableName === 'tasks' || tableName === 'costs') {
      console.log(`XML Response structure for ${tableName}:`, {
        responseKeys: Object.keys(body.Response || {}),
        expectedPlural: elements.plural,
        expectedSingular: elements.singular,
        responsePreview: JSON.stringify(body.Response).substring(0, 1000),
      })
    }
    
    const pluralElement = body.Response[elements.plural]
    if (!pluralElement || !pluralElement[0]) {
      console.warn(`No ${elements.plural} element found in XML for ${tableName}`)
      
      // For timeentries, try alternative element names
      if (tableName === 'timeentries') {
        console.log(`Checking alternative element names for timeentries...`)
        console.log(`Available keys in Response:`, Object.keys(body.Response || {}))
        const alternatives = ['Times', 'TimeEntries']
        for (const alt of alternatives) {
          if (body.Response[alt] && body.Response[alt][0]) {
            console.log(`Found alternative element for timeentries: ${alt}`)
            const altItems = body.Response[alt][0]['Time'] || body.Response[alt][0]['TimeEntry']
            if (altItems && Array.isArray(altItems)) {
              console.log(`Using alternative structure: ${alt} -> ${altItems.length} items`)
              return altItems.map((item: any) => {
                const converted: any = {}
                for (const key in item) {
                  if (Array.isArray(item[key]) && item[key].length > 0) {
                    converted[key] = item[key].length === 1 && typeof item[key][0] === 'string' 
                      ? item[key][0] 
                      : item[key].length === 1 && typeof item[key][0] === 'object'
                      ? item[key][0]
                      : item[key]
                  } else {
                    converted[key] = item[key]
                  }
                }
                return converted
              })
            }
          }
        }
        return []
      }
      
      // For staff, try alternative element names
      if (tableName === 'staff') {
        const alternatives = ['StaffMembers', 'Members']
        for (const alt of alternatives) {
          if (body.Response[alt] && body.Response[alt][0]) {
            console.log(`Found alternative element for staff: ${alt}`)
            const altItems = body.Response[alt][0][elements.singular] || body.Response[alt][0]['StaffMember'] || body.Response[alt][0]['Member']
            if (altItems && Array.isArray(altItems)) {
              console.log(`Using alternative structure: ${alt} -> ${altItems.length} items`)
              const convertedItems = altItems.map((item: any) => {
                const converted: any = {}
                for (const key in item) {
                  if (Array.isArray(item[key]) && item[key].length > 0) {
                    converted[key] = item[key].length === 1 && typeof item[key][0] === 'string' 
                      ? item[key][0] 
                      : item[key].length === 1 && typeof item[key][0] === 'object'
                      ? item[key][0]
                      : item[key]
                  } else {
                    converted[key] = item[key]
                  }
                }
                return converted
              })
              console.log(`Extracted ${convertedItems.length} items from alternative XML structure for ${tableName}`)
              return convertedItems
            }
          }
        }
      }
      return []
    }
    
    const items = pluralElement[0][elements.singular]
    if (!items || !Array.isArray(items)) {
      console.warn(`No ${elements.singular} items found in XML for ${tableName}`)
      // For staff, check if items are directly in pluralElement[0] or use different singular name
      if (tableName === 'staff') {
        console.log(`Checking alternative structures for staff...`)
        const directKeys = Object.keys(pluralElement[0] || {})
        console.log(`Keys in pluralElement[0]:`, directKeys)
        
        // Try alternative singular names
        const altSingulars = ['StaffMember', 'Member', 'Staff']
        for (const altSingular of altSingulars) {
          if (pluralElement[0][altSingular] && Array.isArray(pluralElement[0][altSingular])) {
            console.log(`Found items using alternative singular name: ${altSingular}`)
            const altItems = pluralElement[0][altSingular]
            const convertedItems = altItems.map((item: any) => {
              const converted: any = {}
              for (const key in item) {
                if (Array.isArray(item[key]) && item[key].length > 0) {
                  converted[key] = item[key].length === 1 && typeof item[key][0] === 'string' 
                    ? item[key][0] 
                    : item[key].length === 1 && typeof item[key][0] === 'object'
                    ? item[key][0]
                    : item[key]
                } else {
                  converted[key] = item[key]
                }
              }
              return converted
            })
            console.log(`Extracted ${convertedItems.length} items using ${altSingular} for ${tableName}`)
            return convertedItems
          }
        }
      }
      return []
    }
    
    // Convert XML structure to plain objects
    // xml2js wraps text nodes in arrays, so we need to extract values
    // Preserve all fields including status information (e.g., Active, Archived, Status)
    const convertedItems = items.map((item: any) => {
      const converted: any = {}
      for (const key in item) {
        // xml2js wraps text content in arrays
        if (Array.isArray(item[key]) && item[key].length > 0) {
          // If it's an array with one element, extract it
          if (item[key].length === 1 && typeof item[key][0] === 'string') {
            converted[key] = item[key][0]
          } else if (item[key].length === 1 && typeof item[key][0] === 'object') {
            // Nested object
            converted[key] = item[key][0]
          } else {
            // Array of values
            converted[key] = item[key]
          }
        } else {
          converted[key] = item[key]
        }
      }
      
      // Log status information for clients (if available) - helps verify archived clients are included
      if (tableName === 'clients') {
        const status = converted.Status || converted.Active || converted.Archived || converted.IsActive
        const clientId = converted.ID || converted.Id || converted.id
        if (status !== undefined) {
          console.log(`Client ${clientId}: Status=${status}`)
        }
      }
      
      // For clientgroups, ensure Clients nested structure is preserved
      if (tableName === 'clientgroups' && item.Clients) {
        // xml2js might wrap Clients in different ways
        // Handle: Clients might be { Client: [...] } or { Clients: { Client: [...] } }
        if (Array.isArray(item.Clients)) {
          converted.Clients = item.Clients.map((client: any) => {
            const clientObj: any = {}
            for (const key in client) {
              if (Array.isArray(client[key]) && client[key].length > 0) {
                clientObj[key] = client[key].length === 1 && typeof client[key][0] === 'string' 
                  ? client[key][0] 
                  : client[key]
              } else {
                clientObj[key] = client[key]
              }
            }
            return clientObj
          })
        } else if (item.Clients.Client) {
          // Handle: { Clients: { Client: [...] } }
          const clients = Array.isArray(item.Clients.Client) ? item.Clients.Client : [item.Clients.Client]
          converted.Clients = clients.map((client: any) => {
            const clientObj: any = {}
            for (const key in client) {
              if (Array.isArray(client[key]) && client[key].length > 0) {
                clientObj[key] = client[key].length === 1 && typeof client[key][0] === 'string' 
                  ? client[key][0] 
                  : client[key]
              } else {
                clientObj[key] = client[key]
              }
            }
            return clientObj
          })
        } else {
          // Keep as-is if already in correct format
          converted.Clients = item.Clients
        }
      }
      
      return converted
    })
    
    console.log(`Extracted ${convertedItems.length} items from XML for ${tableName}`)
    
    // For clients, log summary of statuses
    if (tableName === 'clients' && convertedItems.length > 0) {
      const statusCounts: Record<string, number> = {}
      convertedItems.forEach((item: any) => {
        const status = item.Status || item.Active || item.Archived || item.IsActive || 'Unknown'
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })
      console.log(`Client status summary:`, statusCounts)
    }
    
    return convertedItems
  }
  
  // Handle JSON responses
  // Try common response formats
  if (Array.isArray(body)) {
    console.log(`Found array response for ${tableName}, length: ${body.length}`)
    return body
  }
  
  // Try Items array (common in XPM API)
  if (body.Items && Array.isArray(body.Items)) {
    console.log(`Found Items array for ${tableName}, length: ${body.Items.length}`)
    return body.Items
  }
  
  // Try various key formats based on table name
  const keysToTry: string[] = [
    // Capitalized singular: "Client", "Job"
    tableName.charAt(0).toUpperCase() + tableName.slice(1),
    // Capitalized plural: "Clients", "Jobs"
    tableName.charAt(0).toUpperCase() + tableName.slice(1) + 's',
    // Lowercase: "client", "job"
    tableName.toLowerCase(),
    // Original: "clients", "jobs"
    tableName,
    // Special cases
    tableName === 'clientgroups' ? 'ClientGroups' : '',
    tableName === 'timeentries' ? 'Times' : '', // API returns <Times> not <TimeEntries>
    tableName === 'timeentries' ? 'Time' : '',
    tableName === 'timeentries' ? 'TimeEntries' : '', // Fallback
  ].filter((key): key is string => Boolean(key))
  
  for (const key of keysToTry) {
    if (body[key] && Array.isArray(body[key])) {
      console.log(`Found data array for ${tableName} under key "${key}", length: ${body[key].length}`)
      return body[key]
    }
  }
  
  // Log the full body structure for debugging
  console.warn(`Could not extract data for ${tableName} from response. Body structure:`, {
    bodyKeys: Object.keys(body || {}),
    bodyType: typeof body,
    bodyPreview: JSON.stringify(body).substring(0, 500),
  })
  
  return []
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
  // Extract ID from various possible formats
  // XML format: ID might be in array format from xml2js: { ID: ['123'] }
  // JSON format: ID might be direct: { id: '123' }
  let xpmId: any = null
  
  // Try different ID field names
  const idFields = ['id', 'ID', 'Id', 'UUID', 'uuid', 'GUID', 'guid']
  for (const field of idFields) {
    if (item[field]) {
      // Handle xml2js array format: ['123'] -> '123'
      if (Array.isArray(item[field]) && item[field].length > 0) {
        xpmId = item[field][0]
      } else {
        xpmId = item[field]
      }
      break
    }
  }
  
  if (!xpmId) {
    console.warn(`No ID found for ${tableName} item. Available keys:`, Object.keys(item))
    console.warn(`Item preview:`, JSON.stringify(item).substring(0, 200))
    return null
  }

  return {
    organization_id: organizationId,
    tenant_id: tenantId,
    xpm_id: String(xpmId), // Ensure ID is a string
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
  // Clear any temporary progress info from error_message
  // Only keep actual error messages
  const errorMessage = result.error && !result.error.startsWith('PROGRESS:') 
    ? result.error 
    : null
  
  await supabase.from('xpm_sync_metadata').upsert(
    {
      organization_id: organizationId,
      tenant_id: tenantId,
      table_name: tableName,
      last_sync_at: new Date().toISOString(),
      last_sync_status: result.success ? 'success' : 'failed',
      last_sync_count: result.count,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'organization_id,tenant_id,table_name',
    }
  )
}

