import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { getValidToken, storeToken, clearToken } from "./auth"
import { checkPassword } from "./api"

interface AuthContextType {
  isAdmin: boolean
  token: string | null
  login: (password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  token: null,
  login: async () => false,
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getValidToken())

  useEffect(() => {
    if (token) storeToken(token)
  }, [token])

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const resp = await checkPassword(password)
      setToken(resp.token)
      return true
    } catch {
      return false
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider value={{ isAdmin: token !== null, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
