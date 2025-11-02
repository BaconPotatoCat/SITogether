import type { AppProps } from 'next/app'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AuthProvider, useSession } from '../contexts/AuthContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import LoadingSpinner from '../components/LoadingSpinner'
import '../styles/globals.css'

function Navigation() {
  const router = useRouter()
  const { session, status, signOut } = useSession()
  const isActive = (path: string) => router.pathname === path
  const isAuthenticated = status === 'authenticated'

  const handleLogout = async () => {
    await signOut()
  }

  // Get user avatar URL or use default
  const avatarUrl =
    session?.user?.avatarUrl ||
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.1.0&auto=format&fit=crop&q=80&w=687'

  return (
    <>
      <nav className="nav-desktop">
        <div className="nav-inner">
          <div className="brand">
            <Link href="/">SITogether</Link>
          </div>
          <div className="nav-links">
            <Link className={isActive('/') ? 'nav-link active' : 'nav-link'} href="/">
              Discover
            </Link>
            {isAuthenticated && (
              <Link className={isActive('/liked') ? 'nav-link active' : 'nav-link'} href="/liked">
                Liked
              </Link>
            )}
            <Link className={isActive('/premium') ? 'nav-link active' : 'nav-link'} href="/premium">
              Premium
            </Link>
            <Link className={isActive('/chat') ? 'nav-link active' : 'nav-link'} href="/chat">
              Chat
            </Link>
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

      <nav className="nav-mobile">
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
        {isAuthenticated ? (
          <Link className={isActive('/profile') ? 'tab-link active' : 'tab-link'} href="/profile">
            Profile
          </Link>
        ) : (
          <Link className={isActive('/auth') ? 'tab-link active' : 'tab-link'} href="/auth">
            Login
          </Link>
        )}
      </nav>
    </>
  )
}

function AppContent({ Component, pageProps }: AppProps) {
  const { status } = useSession()
  const router = useRouter()

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
