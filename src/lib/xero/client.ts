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
    scopes: ['practicemanager'], // Array of scopes for XPM (Xero Practice Manager) access
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
  
  // Set state if provided
  if (state) {
    xeroClient.config = { ...xeroClient.config, state }
  }
  
  try {
    await xeroClient.initialize()
    const consentUrl = await xeroClient.buildConsentUrl()
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
  
  // Set state in config if provided (needed for apiCallback verification)
  if (state && xeroClient.config) {
    xeroClient.config.state = state
  }
  
  // apiCallback expects the full callback URL
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
  
  // Decrypt and parse token set
  const decrypted = decryptTokenSet(encryptedTokenSet)
  const tokenSet = JSON.parse(decrypted)
  
  // Set tokens in client
  await xeroClient.setTokenSet(tokenSet)
  
  // Refresh tokens
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
  if (tokenSet.expires_at && tokenSet.expires_at < now) {
    try {
      // Refresh the access token using the refresh token
      await xeroClient.refreshToken()
      // Note: In production, you should save the refreshed token set back to database
      // For now, the refreshed token is stored in the client for this session
    } catch (error: any) {
      console.error('Token refresh failed:', error)
      throw new Error('Access token expired and refresh failed. Please reconnect to Xero.')
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

