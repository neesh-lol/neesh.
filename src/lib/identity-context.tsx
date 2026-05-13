import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { getUser, logout as nlLogout, onAuthChange, type User } from '@netlify/identity'

interface IdentityContextValue {
  user: User | null
  ready: boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  recoveryUser: User | null
  clearRecovery: () => void
  callbackMessage: { type: 'success' | 'error'; text: string } | null
  clearCallbackMessage: () => void
}

const IdentityContext = createContext<IdentityContextValue | null>(null)

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [recoveryUser, setRecoveryUser] = useState<User | null>(null)
  const [callbackMessage, setCallbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const refreshUser = useCallback(async () => {
    const u = await getUser()
    setUser(u ?? null)
  }, [])

  const clearRecovery = useCallback(() => setRecoveryUser(null), [])
  const clearCallbackMessage = useCallback(() => setCallbackMessage(null), [])

  useEffect(() => {
    getUser().then((u) => {
      setUser(u ?? null)
      setReady(true)
    })
    const unsubscribe = onAuthChange((_event, u) => {
      setUser(u ?? null)
    })
    return unsubscribe
  }, [])

  const contextValue: IdentityContextValue = {
    user,
    ready,
    logout: nlLogout,
    refreshUser,
    recoveryUser,
    clearRecovery,
    callbackMessage,
    clearCallbackMessage,
  }

  return (
    <IdentityContext.Provider value={contextValue}>
      {children}
    </IdentityContext.Provider>
  )
}

export function useIdentity() {
  const ctx = useContext(IdentityContext)
  if (!ctx) throw new Error('useIdentity must be used within IdentityProvider')
  return ctx
}
