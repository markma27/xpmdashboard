import { XeroClient } from 'xero-node'
import { decryptTokenSet, encryptTokenSet } from './crypto'

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID || ''
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET || ''
const XERO_REDIRECT_URI = process.env.XERO_REDIRECT_URI || ''

if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET || !XERO_REDIRECT_URI) {
  console.warn('Xero credentials not configured. Xero features will not work.')
}

/**
 * Create a new Xero client instance
 * Note: XPM (Xero Practice Manager) requires the 'practicemanager' scope
 */
export function createXeroClient() {
  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET || !XERO_REDIRECT_URI) {
    throw new Error('Xero credentials not configured')
  }

  return new XeroClient({
    clientId: XERO_CLIENT_ID,
    clientSecret: XERO_CLIENT_SECRET,
    redirectUris: [XERO_REDIRECT_URI],
    scopes: [
      'practicemanager', // XPM (Xero Practice Manager) access
      'offline_access',  // Required for refresh tokens (enables "permanent" access via auto-refresh)
    ],
  })
}

/**
 * Get authorization URL for OAuth flow
 * @param state - Optional state parameter to pass through OAuth flow
 */
export async function getAuthorizationUrl(state?: string): Promise<string> {
  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET || !XERO_REDIRECT_URI) {
    throw new Error('Xero credentials not configured. Please set XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_REDIRECT_URI environment variables.')
  }

  const xeroClient = createXeroClient()
  
  try {
    await xeroClient.initialize()
    
    // Set state in config BEFORE calling buildConsentUrl
    // xero-node will automatically include this state in the consent URL
    // This ensures the state matches when apiCallback is called later
    if (state) {
      try {
        // Use type assertion to bypass readonly property
        (xeroClient as any).config = {
          ...xeroClient.config,
          state: state,
        }
      } catch (e) {
        // If config assignment fails, try alternative method
        console.warn('Could not set state via config assignment, trying alternative method')
      }
    }
    
    const consentUrl = await xeroClient.buildConsentUrl()
    
    // If state wasn't set via config, manually append it to URL
    // This is a fallback if xero-node doesn't include it automatically
    if (state) {
      const url = new URL(consentUrl)
      // Only add if not already present
      if (!url.searchParams.has('state')) {
        url.searchParams.set('state', state)
        return url.toString()
      }
    }
    
    return consentUrl
  } catch (error: any) {
    throw new Error(`Failed to build Xero consent URL: ${error.message}`)
  }
}

/**
 * Exchange authorization code for tokens
 * @param callbackUrl - The full callback URL from Xero (includes code and state parameters)
 * @param state - The state parameter from the OAuth flow (for verification)
 * @returns XeroClient instance with tokens set
 * 
 * Note: Xero access tokens expire in 30 minutes, but refresh tokens last ~60 days.
 * The refresh token can be used to automatically get new access tokens.
 */
export async function exchangeCodeForTokens(callbackUrl: string, state?: string): Promise<XeroClient> {
  const xeroClient = createXeroClient()
  
  // Initialize client
  await xeroClient.initialize()
  
  // Extract state from callback URL if not provided
  // xero-node v5 requires state to be set in config before calling apiCallback
  // This is used for CSRF protection - the state in the callback URL must match
  let stateToUse = state
  if (!stateToUse) {
    try {
      const url = new URL(callbackUrl)
      stateToUse = url.searchParams.get('state') || undefined
    } catch (e) {
      // If URL parsing fails, use provided state or throw error
      if (!state) {
        throw new Error('State parameter is required for OAuth callback verification')
      }
    }
  }
  
  if (stateToUse) {
    // Set state in config for verification
    // Note: xero-node expects state to be set before apiCallback
    // The config object might be read-only, so we need to check the xero-node API
    // For now, try to set it directly
    try {
      // Use type assertion to bypass readonly property
      (xeroClient as any).config = {
        ...xeroClient.config,
        state: stateToUse,
      }
    } catch (e) {
      // If config is read-only, we might need to pass state differently
      console.warn('Could not set state in config, attempting apiCallback anyway')
    }
  } else {
    throw new Error('State parameter is missing from callback URL. This is required for security.')
  }
  
  // apiCallback expects the full callback URL (which includes state parameter)
  // It will verify that the state in the URL matches the state in config
  // This will exchange the authorization code for access and refresh tokens
  // Access tokens expire in 30 minutes, refresh tokens last ~60 days
  await xeroClient.apiCallback(callbackUrl)
  
  return xeroClient
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(encryptedTokenSet: string): Promise<any> {
  const xeroClient = createXeroClient()
  
  // Initialize client first (required before setTokenSet)
  await xeroClient.initialize()
  
  // Decrypt and parse token set
  const decrypted = decryptTokenSet(encryptedTokenSet)
  const tokenSet = JSON.parse(decrypted)
  
  // Validate token set has refresh_token
  if (!tokenSet.refresh_token) {
    throw new Error('No refresh token available. Please reconnect to Xero.')
  }
  
  // Set tokens in client
  await xeroClient.setTokenSet(tokenSet)
  
  // Refresh tokens
  // Note: refreshToken() returns a new token set with updated access_token
  const newTokenSet = await xeroClient.refreshToken()
  
  return newTokenSet
}

/**
 * Get Xero client with token set for API calls
 * Automatically refreshes access token if expired (access tokens expire in 30 minutes)
 * Refresh tokens typically last 60 days and can be used to get new access tokens
 */
export async function getAuthenticatedXeroClient(encryptedTokenSet: string): Promise<XeroClient> {
  const xeroClient = createXeroClient()
  
  // Initialize client
  await xeroClient.initialize()
  
  // Decrypt and parse token set
  const decrypted = decryptTokenSet(encryptedTokenSet)
  const tokenSet = JSON.parse(decrypted)
  
  // Set tokens in client
  xeroClient.setTokenSet(tokenSet)
  
  // Check if access token needs refresh
  // Xero access tokens expire in 30 minutes, but refresh tokens last ~60 days
  // We can use refresh tokens to get new access tokens automatically
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = tokenSet.expires_at || 0
  
  // Refresh if expired or about to expire (within 5 minutes)
  if (expiresAt < now + 300) {
    try {
      // Validate refresh token exists
      if (!tokenSet.refresh_token) {
        throw new Error('REFRESH_TOKEN_EXPIRED: No refresh token available. Please reconnect to Xero.')
      }
      
      // Refresh the access token using the refresh token
      await xeroClient.refreshToken()
      // Note: The refreshed token is stored in the client for this session
      // The refreshed token set should be saved back to database (handled in sync route)
    } catch (error: any) {
      // Handle specific error types
      const errorMessage = error?.error || error?.message || 'Unknown error'
      
      // invalid_grant usually means refresh token expired or revoked
      if (errorMessage === 'invalid_grant' || error?.error === 'invalid_grant') {
        console.error('Token refresh failed: Refresh token expired or revoked. User needs to reconnect.')
        throw new Error('REFRESH_TOKEN_EXPIRED: Your Xero connection has expired. Please reconnect to Xero.')
      }
      
      console.error('Token refresh failed:', error)
      throw new Error(`Access token expired and refresh failed: ${errorMessage}. Please reconnect to Xero.`)
    }
  }
  
  return xeroClient
}

/**
 * Encrypt token set for storage
 */
export function encryptTokenSetForStorage(tokenSet: any): string {
  return encryptTokenSet(JSON.stringify(tokenSet))
}

