import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api, setToken } from '../api.js'

const AuthContext = createContext(null)
const USER_KEY = 'auth_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const cached = localStorage.getItem(USER_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    api.get('/auth/me')
      .then((u) => {
        setUser(u)
        localStorage.setItem(USER_KEY, JSON.stringify(u))
      })
      .catch((err) => {
        if (err.offline && cached) {
          try { setUser(JSON.parse(cached)) } catch (e) { setUser(null) }
        } else {
          setToken(null)
          localStorage.removeItem(USER_KEY)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password })
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data.user
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const can = useCallback(
    (perm) => {
      if (!user) return false
      return perm || true
    },
    [user]
  )

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
