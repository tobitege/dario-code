/**
 * API module entry point
 * Handles communication with the API
 */

// Re-export client functions
export { sendRequest, getClient, resetClient } from './client.mjs'

export default {
  sendRequest: (await import('./client.mjs')).sendRequest,
  getClient: (await import('./client.mjs')).getClient,
  resetClient: (await import('./client.mjs')).resetClient
}
