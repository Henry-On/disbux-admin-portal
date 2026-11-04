const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

export const DEFAULT_API_BASE = 'https://disbux-dev.up.railway.app/api'
export const DEVICE_NAME = 'Disbux Admin Portal'

export function apiBaseUrl() {
  return isLocalhost ? 'http://localhost:4000/api' : DEFAULT_API_BASE
}

export function safeNextPath(value: string | null, fallback = '/dashboard') {
  if (!value) return fallback
  try {
    const parsed = new URL(value, window.location.origin)
    const allowed = ['/dashboard', '/kyc', '/announcements', '/giveaways']
    if (parsed.origin === window.location.origin && allowed.includes(parsed.pathname)) {
      return `${parsed.pathname}${parsed.search}`
    }
  } catch {
    return fallback
  }
  return fallback
}
