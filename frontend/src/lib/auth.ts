const TOKEN_KEY = "ts_token"

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    const exp = payload.exp * 1000
    return Date.now() >= exp
  } catch {
    return true
  }
}

export function getValidToken(): string | null {
  const token = getStoredToken()
  if (!token) return null
  if (isTokenExpired(token)) {
    clearToken()
    return null
  }
  return token
}
