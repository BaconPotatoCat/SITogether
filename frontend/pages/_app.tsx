import type { AppProps } from 'next/app'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { AuthProvider, useSession } from '../contexts/AuthContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import LoadingSpinner from '../components/LoadingSpinner'
import { ensureCsrfToken } from '../utils/api'
import '../styles/globals.css'

// Initialize logging bridge for server-side operations (API routes and SSR)
if (typeof window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../lib/logging-bridge')
}

function Navigation() {
  const router = useRouter()
  const { session, status, signOut } = useSession()
  const isActive = (path: string) => router.pathname === path
  const isAuthenticated = status === 'authenticated'
  const isAdmin = session?.user?.role === 'Admin'

  const handleLogout = async () => {
    await signOut()
  }

  // Get user avatar URL or use default
  const avatarUrl =
    session?.user?.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(session?.user?.name || 'User')}&size=400&background=6366f1&color=ffffff&bold=true`

  return (
    <>
      <nav className="nav-desktop">
        <div className="nav-inner">
          <div className="brand">
            <Link href="/">SITogether</Link>
          </div>
          <div className="nav-links">
            {isAdmin ? (
              // Admin-only navigation
              <>
                <Link className={isActive('/admin') ? 'nav-link active' : 'nav-link'} href="/admin">
                  Admin Dashboard
                </Link>
              </>
            ) : (
              // Normal user navigation
              <>
                <Link className={isActive('/') ? 'nav-link active' : 'nav-link'} href="/">
                  Discover
                </Link>
                {isAuthenticated && (
                  <Link
                    className={isActive('/liked') ? 'nav-link active' : 'nav-link'}
                    href="/liked"
                  >
                    Liked
                  </Link>
                )}
                <Link
                  className={isActive('/premium') ? 'nav-link active' : 'nav-link'}
                  href="/premium"
                >
                  Premium
                </Link>
                <Link className={isActive('/chat') ? 'nav-link active' : 'nav-link'} href="/chat">
                  Chat
                </Link>
              </>
            )}
            {isAuthenticated ? (
              <div className="profile-dropdown">
                <div className="nav-profile">
                  <img src={avatarUrl} alt="Profile" className="nav-avatar" />
                </div>
                <div className="dropdown-menu">
                  <Link href="/profile" className="dropdown-item">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    View Profile
                  </Link>
                  <button className="dropdown-item logout" onClick={handleLogout}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <Link className={isActive('/auth') ? 'nav-link active' : 'nav-link'} href="/auth">
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>

      <nav className={`nav-mobile ${isAdmin ? 'nav-mobile-admin' : ''}`}>
        {isAdmin ? (
          // Admin-only mobile nav
          <Link className={isActive('/admin') ? 'tab-link active' : 'tab-link'} href="/admin">
            Admin
          </Link>
        ) : (
          // Normal user mobile nav
          <>
            <Link className={isActive('/') ? 'tab-link active' : 'tab-link'} href="/">
              Discover
            </Link>
            {isAuthenticated && (
              <Link className={isActive('/liked') ? 'tab-link active' : 'tab-link'} href="/liked">
                Liked
              </Link>
            )}
            <Link className={isActive('/premium') ? 'tab-link active' : 'tab-link'} href="/premium">
              Premium
            </Link>
            <Link className={isActive('/chat') ? 'tab-link active' : 'tab-link'} href="/chat">
              Chat
            </Link>
          </>
        )}
      </nav>
    </>
  )
}

function AppContent({ Component, pageProps }: AppProps) {
  const { status } = useSession()
  const router = useRouter()

  // Initialize CSRF token on mount for authenticated users
  useEffect(() => {
    if (status === 'authenticated') {
      ensureCsrfToken().catch((err) => console.error('Failed to initialize CSRF token:', err))
    }
  }, [status])

  // Don't show loading spinner on auth page
  const isAuthPage = router.pathname === '/auth'

  if (status === 'loading' && !isAuthPage) {
    return <LoadingSpinner fullScreen message="Loading session..." />
  }

  return (
    <div className="app-shell">
      <Navigation />
      <div className="page-content">
        <Component {...pageProps} />
      </div>
    </div>
  )
}

export default function App(props: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent {...props} />
      </AuthProvider>
    </ThemeProvider>
  )
}
