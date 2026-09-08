import axios from 'axios'
import { clearToken, getToken } from './tokenStore'

function normalizeTenantIdKey<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => normalizeTenantIdKey(item)) as T
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>
    const output: Record<string, unknown> = {}

    for (const [key, child] of Object.entries(input)) {
      const normalizedKey = key === 'tenant_id' ? 'tenantId' : key
      output[normalizedKey] = normalizeTenantIdKey(child)
    }

    return output as T
  }

  return value
}

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL
const localBrowser = typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

function tokenIsExpired(token: string | null): boolean {
  if (!token) return true
  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
    const claims = JSON.parse(atob(padded)) as { exp?: number }
    return claims.exp != null && Date.now() / 1000 >= claims.exp
  } catch {
    return true
  }
}

const client = axios.create({
  baseURL: import.meta.env.DEV && localBrowser ? '/api' : configuredApiUrl,
})

client.interceptors.request.use(config => {
  const token = getToken()
  const requestUrl = String(config.url || '')
  const isPublicAuthRoute = requestUrl === '/auth/login' || requestUrl === '/auth/register'
  if (token && !isPublicAuthRoute) {
    config.headers.Authorization = `Bearer ${token}`
    if (!localBrowser) {
      config.headers['X-SAM-Tracker-Token'] = token
    }
  }
  return config
})

client.interceptors.response.use(
  response => {
    response.data = normalizeTenantIdKey(response.data)
    return response
  },
  error => {
    const requestUrl = String(error?.config?.url || '')
    const isImportedDataRoute =
      requestUrl.includes('/vendors/imported') ||
      requestUrl.includes('/contracts/imported')
    const isDashboardRoute = requestUrl.includes('/dashboards/me')
    const isLoginRoute = requestUrl.includes('/auth/login')
    const isRegisterRoute = requestUrl.includes('/auth/register')

    // skip redirect when the login endpoint itself returns 401
    if (
      error.response?.status === 401 &&
      tokenIsExpired(getToken()) &&
      window.location.pathname !== '/login' &&
      !isImportedDataRoute &&
      !isDashboardRoute &&
      !isLoginRoute &&
      !isRegisterRoute
    ) {
      clearToken()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default client
