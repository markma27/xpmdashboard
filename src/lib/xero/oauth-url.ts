/**
 * Validates OAuth authorization URLs before client-side redirect (open-redirect mitigation).
 * Xero uses https://login.xero.com for the consent screen.
 */
const ALLOWED_XERO_OAUTH_HOSTS = new Set(['login.xero.com'])

export function assertSafeXeroOAuthRedirect(urlString: string): string {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    throw new Error('Invalid authorization URL')
  }

  if (url.protocol !== 'https:') {
    throw new Error('Authorization URL must use HTTPS')
  }

  if (!ALLOWED_XERO_OAUTH_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Authorization URL must point to Xero')
  }

  return url.toString()
}
