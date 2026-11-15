export const DEFAULT_API_BASE = 'https://disbux-dev.up.railway.app/api'
export const DEVICE_NAME = 'Disbux Admin Portal'

export function apiBaseUrl() {
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://localhost:4000/api'
  }
  return DEFAULT_API_BASE
}
