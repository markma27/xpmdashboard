import { XeroClient } from 'xero-node'
import axios from 'axios'
import { parseString } from 'xml2js'
import { promisify } from 'util'
import { getAuthenticatedXeroClient } from '../xero/client'
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
  tableName?: string
): Promise<SyncResult[]> {
  const results: SyncResult[] = []
  const supabase = createServiceRoleClient()

  try {
    const xeroClient = await getAuthenticatedXeroClient(encryptedTokenSet)

    // Define tables to sync
    // Removed: customfields, expenseclaims, quotes, templates (not needed)
    const tablesToSync = tableName
      ? [tableName]
      : [
          'clients',
          'clientgroups',
          'jobs',
          'staff',
          'tasks',
          'timeentries',
          'invoices',
          'categories',
          'costs',
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
    
    if (tableName === 'invoices') {
      // Invoices API requires from/to dates, so use a very wide range to get ALL invoices
      // Use 10 years ago to now to ensure we get all historical invoices
      const now = new Date()
      const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate())
      
      // Format: yyyymmdd (no separators)
      const formatDate = (date: Date): string => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}${month}${day}`
      }
      
      const fromDate = formatDate(tenYearsAgo)
      const toDate = formatDate(now)
      
      // Add query parameters with wide date range
      const separator = apiEndpoint.includes('?') ? '&' : '?'
      apiEndpoint = `${apiEndpoint}${separator}from=${fromDate}&to=${toDate}&detailed=true`
      console.log(`Using wide date range for invoices: ${fromDate} to ${toDate} (10 years)`)
    } else if (tableName === 'timeentries') {
      // For time entries, try without date filters first to get all
      // If API requires dates, we can add them later
    } else if (tableName === 'clients') {
      // For clients, XPM API by default only returns active clients
      // We'll try multiple approaches to get archived clients
      console.log(`Fetching all clients including archived - will try multiple approaches`)
    }
    
    console.log(`Syncing ${tableName} from endpoint: ${apiEndpoint}`)

    // Special handling for clients - try multiple parameter combinations
    let data: any[]
    if (tableName === 'clients') {
      data = await fetchAllClients(xeroClient, apiEndpoint, tenantId, tableName)
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

    for (const item of data) {
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
  const getV2Fallback = (v3Url: string, tableName: string): string | null => {
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

      // Other errors
      lastError = {
        status: response.status,
        statusText: response.statusText,
        endpoint,
        data: response.data,
      }
      continue
    } catch (error: any) {
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
      tasks: { plural: 'Tasks', singular: 'Task' },
      timeentries: { plural: 'TimeEntries', singular: 'TimeEntry' },
      invoices: { plural: 'Invoices', singular: 'Invoice' },
      staff: { plural: 'StaffList', singular: 'Staff' }, // Fixed: StaffList -> Staff (not Staff -> StaffMember)
      categories: { plural: 'Categories', singular: 'Category' },
      costs: { plural: 'Costs', singular: 'Cost' },
    }
    
    const elements = xmlElementMap[tableName]
    if (!elements) {
      console.warn(`No XML element mapping for ${tableName}`)
      return []
    }
    
    // Extract data from XML structure
    // xml2js wraps text content in arrays, so we need to access [0]
    // Log the actual structure for debugging (especially for staff)
    if (tableName === 'staff') {
      console.log(`XML Response structure for ${tableName}:`, {
        responseKeys: Object.keys(body.Response || {}),
        expectedPlural: elements.plural,
        expectedSingular: elements.singular,
        responsePreview: JSON.stringify(body.Response).substring(0, 500),
      })
    }
    
    const pluralElement = body.Response[elements.plural]
    if (!pluralElement || !pluralElement[0]) {
      console.warn(`No ${elements.plural} element found in XML for ${tableName}`)
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
    tableName === 'timeentries' ? 'TimeEntries' : '',
    tableName === 'timeentries' ? 'Time' : '',
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

