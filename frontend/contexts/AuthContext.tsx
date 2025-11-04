import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/router'

interface User {
  id: string
  name: string
  age: number
  role: string
  course?: string
  bio?: string
  interests?: string[]
  avatarUrl?: string
}

interface Session {
  user: User
  expires: string
}

interface AuthContextType {
  session: Session | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  status: 'loading',
  signOut: async () => {},
  refreshSession: async () => {},
})

export const useSession = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useSession must be used within AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')
  const router = useRouter()

  // Fetch session from API
  const fetchSession = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.session) {
          setSession(data.session)
          setStatus('authenticated')
        } else {
          setSession(null)
          setStatus('unauthenticated')
        }
      } else {
        setSession(null)
        setStatus('unauthenticated')
      }
    } catch (error) {
      console.error('Failed to fetch session:', error)
      setSession(null)
      setStatus('unauthenticated')
    }
  }

  // Sign out function
  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      setSession(null)
      setStatus('unauthenticated')
      router.push('/auth')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  // Fetch session on mount and route changes
  useEffect(() => {
    fetchSession()
  }, [router.pathname])

  // Refetch session periodically (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(
      () => {
        if (status === 'authenticated') {
          fetchSession()
        }
      },
      5 * 60 * 1000
    )

    return () => clearInterval(interval)
  }, [status])

  return (
    <AuthContext.Provider value={{ session, status, signOut, refreshSession: fetchSession }}>
      {children}
    </AuthContext.Provider>
  )
}
