/**
 * Authentication module entry point
 * Supports API key and OAuth authentication
 */

// Basic auth
export { authenticate, storeToken } from './auth.mjs'

// OAuth
export {
  authenticateWithOAuth,
  getValidToken,
  isOAuthAuthenticated,
  logout,
  getAuthInfo,
  loadToken,
  saveToken,
  deleteToken,
  setOAuthMode
} from './oauth.mjs'

// Default export for convenience
import { authenticate, storeToken } from './auth.mjs'
import oauth from './oauth.mjs'

export default {
  authenticate,
  storeToken,
  oauth
}
