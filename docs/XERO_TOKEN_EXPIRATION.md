# Xero Token Expiration and Refresh

## Understanding Xero's 30-Minute Access Token Limit

### Why 30 Minutes?

Xero uses OAuth 2.0 with the following token structure:

1. **Access Token**: Expires in **30 minutes**
   - Used for API calls
   - Short-lived for security

2. **Refresh Token**: Expires in **~60 days**
   - Used to get new access tokens
   - Long-lived for convenience

### Can It Be Changed to Forever?

**No, the 30-minute access token expiration is fixed by Xero** and cannot be changed. This is a security feature.

However, **you don't need to reconnect every 30 minutes** because:

- The system automatically uses the refresh token to get new access tokens
- Refresh tokens last ~60 days
- After 60 days, users need to reconnect (this is normal and expected)

## How Our System Handles This

### Automatic Token Refresh

The system automatically refreshes access tokens when they expire:

1. When making API calls, the system checks if the access token is expired
2. If expired, it uses the refresh token to get a new access token
3. The new access token is used for the API call
4. Users don't need to do anything - it's automatic

### Implementation Details

- **Token Storage**: Both access and refresh tokens are encrypted and stored in the database
- **Automatic Refresh**: Happens transparently in `getAuthenticatedXeroClient()`
- **Error Handling**: If refresh fails, the system will prompt users to reconnect

### When Users Need to Reconnect

Users only need to reconnect if:
- The refresh token expires (after ~60 days)
- The refresh token is revoked
- There's an error during token refresh

## Best Practices

1. **Monitor Token Expiration**: Check `expires_at` before API calls
2. **Handle Refresh Errors**: Prompt users to reconnect if refresh fails
3. **Save Refreshed Tokens**: Update the database with new tokens after refresh (TODO: implement this)
4. **User Communication**: Inform users that reconnection may be needed every ~60 days

## Future Improvements

- [ ] Save refreshed tokens back to database automatically
- [ ] Add token expiration warnings (e.g., "Your connection expires in 7 days")
- [ ] Implement background job to refresh tokens before expiration
- [ ] Add reconnection reminder notifications

