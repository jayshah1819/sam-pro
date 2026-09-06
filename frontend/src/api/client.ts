import axios from 'axios'
import { getToken } from './tokenStore'

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

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

client.interceptors.request.use(config => {
  const token = getToken()
  const requestUrl = String(config.url || '')
  const isPublicAuthRoute = requestUrl === '/auth/login' || requestUrl === '/auth/register'
  if (token && !isPublicAuthRoute) {
    config.headers.Authorization = `Bearer ${token}`
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
      window.location.pathname !== '/login' &&
      !isImportedDataRoute &&
      !isDashboardRoute &&
      !isLoginRoute &&
      !isRegisterRoute
    ) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default client
