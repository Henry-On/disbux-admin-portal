import { apiBaseUrl, DEVICE_NAME } from './config'

const ACCESS_KEY = 'disbuxAdminAccess'
const REFRESH_KEY = 'disbuxAdminRefresh'
const DEVICE_KEY = 'disbuxAdminDevice'

type Envelope<T = Record<string, unknown>> = { data?: T; message?: string }
type RequestOptions = { method?: string; body?: BodyInit; headers?: HeadersInit; allowRefresh?: boolean }
type LoginData = { challengeId?: string; requiresVerification?: boolean; email?: string }
type SessionData = { accessToken?: string; refreshToken?: string; user?: { email?: string } }
type User = { firstName?: string; otherNames?: string; lastName?: string; username?: string; email?: string; phoneNumber?: string; DOB?: string; accountType?: string; NIN?: string; BVN?: string }
export type Submission = { id: string; status: string; createdAt: string; rejectionReason?: string; user?: User }
export type Announcement = { id: string; title?: string; body?: string; active?: boolean; createdAt?: string }

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let refreshPromise: Promise<void> | null = null

export function getDeviceId() {
  let value = localStorage.getItem(DEVICE_KEY)
  if (!value) {
    value = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, value)
  }
  return value
}

export const hasSession = () => Boolean(sessionStorage.getItem(ACCESS_KEY))
export const hasRefreshToken = () => Boolean(sessionStorage.getItem(REFRESH_KEY))
export function clearSession() {
  sessionStorage.removeItem(ACCESS_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
}

async function readBody(response: Response): Promise<Envelope> {
  try {
    return await response.json() as Envelope
  } catch {
    return {}
  }
}

export async function apiRequest<T = Record<string, unknown>>(path: string, { method = 'GET', body, headers = {}, allowRefresh = true }: RequestOptions = {}): Promise<Envelope<T>> {
  const requestHeaders = new Headers(headers)
  requestHeaders.set('X-Client-Platform', 'web')
  requestHeaders.set('X-Device-Id', getDeviceId())
  requestHeaders.set('X-Device-Name', DEVICE_NAME)
  if (body !== undefined && !(body instanceof FormData)) requestHeaders.set('Content-Type', 'application/json')
  const accessToken = sessionStorage.getItem(ACCESS_KEY)
  if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(`${apiBaseUrl()}${path}`, { method, body, headers: requestHeaders, credentials: 'include' })
  if (response.status === 401 && allowRefresh && hasRefreshToken() && !path.startsWith('/admin/auth/')) {
    await Auth.refresh()
    return apiRequest<T>(path, { method, body, headers, allowRefresh: false })
  }
  const payload = await readBody(response)
  if (!response.ok) throw new ApiError(payload.message || `Request failed (${response.status}).`, response.status)
  return payload as Envelope<T>
}

function authPost<T>(path: string, data: Record<string, string>) {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify({ ...data, deviceId: getDeviceId() }), allowRefresh: false })
}

export const Auth = {
  login: (email: string, password: string) => authPost<LoginData>('/admin/auth/login', { email, password }),
  verify: (data: { email: string; challengeId: string; code: string }) => authPost<SessionData>('/admin/auth/verify', data),
  resend: (data: { email: string; challengeId: string }) => authPost('/admin/auth/resend', data),
  async logout() {
    const refreshToken = sessionStorage.getItem(REFRESH_KEY)
    try { if (refreshToken) await authPost('/admin/auth/logout', { refreshToken }) } finally { clearSession() }
  },
  me: () => apiRequest<{ email?: string }>('/admin/me'),
  async refresh() {
    if (!refreshPromise) {
      const refreshToken = sessionStorage.getItem(REFRESH_KEY)
      refreshPromise = (async () => {
        if (!refreshToken) throw new ApiError('Admin session expired. Sign in again.', 401)
        const result = await authPost<SessionData>('/admin/auth/refresh', { refreshToken })
        const data = result.data || {}
        if (!data.accessToken || !data.refreshToken) throw new ApiError('The server returned an invalid admin session.', 500)
        sessionStorage.setItem(ACCESS_KEY, data.accessToken)
        sessionStorage.setItem(REFRESH_KEY, data.refreshToken)
      })().catch((error: unknown) => { clearSession(); throw error }).finally(() => { refreshPromise = null })
    }
    return refreshPromise
  },
  storeSession(data: SessionData) {
    if (!data.accessToken || !data.refreshToken) throw new ApiError('The server returned an invalid admin session.', 500)
    sessionStorage.setItem(ACCESS_KEY, data.accessToken)
    sessionStorage.setItem(REFRESH_KEY, data.refreshToken)
  },
}

export const Kyc = {
  list: (status = 'PENDING_REVIEW') => apiRequest<Submission[]>(`/admin/kyc?status=${encodeURIComponent(status)}`),
  photo: (id: string, kind: 'selfie' | 'idPhoto') => apiRequest<{ url?: string }>(`/admin/kyc/${encodeURIComponent(id)}/photos/${kind}`),
  review: (id: string, decision: 'APPROVED' | 'REJECTED', reason = '') => apiRequest(`/admin/kyc/${encodeURIComponent(id)}/review`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ decision, reason }) }),
}

export const Announcements = {
  publish: (data: { title: string; body: string }) => apiRequest<Record<string, number>>('/admin/announcements', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(data) }),
  list: () => apiRequest<Announcement[]>('/admin/announcements'),
  update: (id: string, patch: Partial<Pick<Announcement, 'title' | 'body' | 'active'>>) => apiRequest(`/admin/announcements/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(patch) }),
  remove: (id: string) => apiRequest(`/admin/announcements/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'Idempotency-Key': crypto.randomUUID() } }),
}
