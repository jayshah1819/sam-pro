import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { setToken } from '../api/tokenStore'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login: (token: string) => void
  logout: () => void
}

const TOKEN_KEY = 'auth_token'

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  const padded = padding === 0 ? normalized : normalized + '='.repeat(4 - padding)
  return atob(padded)
}

function parsePayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    if (!payload) return {}
    return JSON.parse(decodeBase64Url(payload))
  } catch {
    return {}
  }
}

function isExpired(token: string): boolean {
  const { exp } = parsePayload(token) as { exp?: number }
  return exp != null && Date.now() / 1000 > exp
}

function userFromToken(token: string): AuthUser | null {
  const { sub, tenantId, role } = parsePayload(token) as {
    sub?: string
    tenantId?: string
    role?: string
  }
  if (!sub) return null
  return { username: sub, tenantId: tenantId ?? '', role: role ?? 'VIEWER' }
}

function loadStoredToken(): string | null {
  const stored = localStorage.getItem(TOKEN_KEY)
  if (!stored) return null
  if (isExpired(stored)) {
    localStorage.removeItem(TOKEN_KEY)
    return null
  }
  return stored
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  // lazy initialisers run once; expired tokens are discarded before first render
  const [token, setTokenState] = useState<string | null>(loadStoredToken)
  const [user, setUser] = useState<AuthUser | null>(() => {
    const t = loadStoredToken()
    return t ? userFromToken(t) : null
  })

  useEffect(() => {
    setToken(token)
  }, [token])

  const login = (newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
    setTokenState(newToken)
    setUser(userFromToken(newToken))
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setTokenState(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextValue => useContext(AuthContext)
