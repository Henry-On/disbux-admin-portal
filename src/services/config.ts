const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const useLocalhost = false

export const DEFAULT_API_BASE = 'https://disbux-dev.up.railway.app/api'
export const DEVICE_NAME = 'Disbux Admin Portal'

export function apiBaseUrl() {
  return isLocalhost && useLocalhost ? 'http://localhost:4000/api' : DEFAULT_API_BASE
}
