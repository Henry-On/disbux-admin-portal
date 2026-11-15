import axios from 'axios'
import { apiBaseUrl, DEVICE_NAME } from './config'

const ACCESS_KEY = 'disbuxAdminAccess'
const REFRESH_KEY = 'disbuxAdminRefresh'
const DEVICE_KEY = 'disbuxAdminDevice'

type Envelope<T = Record<string, unknown>> = { data?: T; message?: string }

type RequestOptions = {
  method?: string
  body?: BodyInit
  headers?: HeadersInit
  allowRefresh?: boolean
}

type LoginData = {
  challengeId?: string
  requiresVerification?: boolean
  email?: string
}

type SessionData = {
  accessToken?: string
  refreshToken?: string
  user?: { email?: string }
}

export type AdminIdentity = {
  id?: string
  email?: string
  status?: string
  roles?: { id: string; name: string }[]
  effectivePermissions?: string[]
}

type User = {
  firstName?: string
  otherNames?: string
  lastName?: string
  username?: string
  email?: string
  phoneNumber?: string
  DOB?: string
  accountType?: string
  NIN?: string
  BVN?: string
}

export type Submission = {
  id: string
  status: string
  createdAt: string
  rejectionReason?: string
  user?: User
}

export type Announcement = {
  id: string
  title?: string
  body?: string
  active?: boolean
  createdAt?: string
}

export class ApiError extends Error {
  constructor(message: string, public readonly status = 0) {
    super(message)
    this.name = 'ApiError'
  }
}

const http = axios.create({ withCredentials: true })
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function apiRequest<T = Record<string, unknown>>(
  path: string,
  {
    method = 'GET',
    body,
    headers = {},
    allowRefresh = true,
  }: RequestOptions = {},
): Promise<Envelope<T>> {
  const requestHeaders = new Headers(headers)
  requestHeaders.set('X-Client-Platform', 'web')
  requestHeaders.set('X-Device-Id', getDeviceId())
  requestHeaders.set('X-Device-Name', DEVICE_NAME)

  if (body !== undefined && !(typeof FormData !== 'undefined' && body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  const accessToken = sessionStorage.getItem(ACCESS_KEY)
  if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`)

  try {
    const response = await http.request<Envelope<T>>({
      baseURL: apiBaseUrl(),
      url: path,
      method,
      data: body,
      headers: Object.fromEntries(requestHeaders.entries()),
    })
    return response.data
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status ?? 0 : 0

    if (status === 401 && allowRefresh && hasRefreshToken() && !path.startsWith('/auth/')) {
      await Auth.refresh()
      return apiRequest<T>(path, { method, body, headers, allowRefresh: false })
    }

    const payload = axios.isAxiosError(error) ? error.response?.data : undefined
    const message = isRecord(payload) && typeof payload.message === 'string'
      ? payload.message
      : error instanceof Error ? error.message : `Request failed (${status}).`
    throw new ApiError(message, status)
  }
}

function authPost<T>(path: string, data: Record<string, string>) {
  return apiRequest<T>(path, {
    method: 'POST',
    body: JSON.stringify({ ...data, deviceId: getDeviceId() }),
    allowRefresh: false,
  })
}

export const Auth = {
  login: (email: string, password: string) => authPost<LoginData>('/auth/login', { email, password }),
  verify: (data: { email: string; challengeId: string; code: string }) => authPost<SessionData>('/auth/verify', data),
  resend: (data: { email: string; challengeId: string }) => authPost('/auth/resend', data),
  async logout() {
    const refreshToken = sessionStorage.getItem(REFRESH_KEY)
    try {
      if (refreshToken) await authPost('/auth/logout', { refreshToken })
    } finally {
      clearSession()
    }
  },
  me: () => apiRequest<AdminIdentity>('/admin/me'),
  async refresh() {
    if (!refreshPromise) {
      const refreshToken = sessionStorage.getItem(REFRESH_KEY)
      refreshPromise = (async () => {
        if (!refreshToken) throw new ApiError('Admin session expired. Sign in again.', 401)
        const result = await authPost<SessionData>('/auth/refresh', { refreshToken })
        const data = result.data || {}
        if (!data.accessToken || !data.refreshToken) {
          throw new ApiError('The server returned an invalid admin session.', 500)
        }
        sessionStorage.setItem(ACCESS_KEY, data.accessToken)
        sessionStorage.setItem(REFRESH_KEY, data.refreshToken)
      })()
        .catch((error: unknown) => {
          clearSession()
          throw error
        })
        .finally(() => {
          refreshPromise = null
        })
    }
    return refreshPromise
  },
  storeSession(data: SessionData) {
    if (!data.accessToken || !data.refreshToken) {
      throw new ApiError('The server returned an invalid admin session.', 500)
    }
    sessionStorage.setItem(ACCESS_KEY, data.accessToken)
    sessionStorage.setItem(REFRESH_KEY, data.refreshToken)
  },
}

export const Kyc = {
  list: (status = 'PENDING_REVIEW') => apiRequest<Submission[]>(`/kyc?status=${encodeURIComponent(status)}`),
  photo: (id: string, kind: 'selfie' | 'idPhoto') => apiRequest<{ url?: string }>(`/kyc/${encodeURIComponent(id)}/photos/${kind}`),
  review: (id: string, decision: 'APPROVED' | 'REJECTED', reason = '') => apiRequest(
    `/kyc/${encodeURIComponent(id)}/review`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ decision, reason }),
    },
  ),
}

export const Announcements = {
  publish: (data: { title: string; body: string }) => apiRequest<Record<string, number>>('/announcements', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(data),
  }),
  list: () => apiRequest<Announcement[]>('/announcements'),
  update: (id: string, patch: Partial<Pick<Announcement, 'title' | 'body' | 'active'>>) => apiRequest(
    `/announcements/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(patch),
    },
  ),
  remove: (id: string) => apiRequest(`/announcements/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  }),
}
