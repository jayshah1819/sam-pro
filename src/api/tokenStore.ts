// Module-level store so the axios interceptor can read the token outside React
let currentToken: string | null = null
const TOKEN_KEY = 'auth_token'

export const setToken = (token: string | null): void => {
  currentToken = token
}

export const getToken = (): string | null => {
  if (currentToken) return currentToken
  try {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) {
      currentToken = stored
      return stored
    }
  } catch {
    // Ignore localStorage access errors and fallback to in-memory token only.
  }
  return null
}
