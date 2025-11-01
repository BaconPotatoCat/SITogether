import type { AppProps } from 'next/app'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AuthProvider, useSession } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import '../styles/globals.css'

function Navigation() {
  const router = useRouter()
  const { status, signOut, session } = useSession()
  const isActive = (path: string) => router.pathname === path
  const isAuthenticated = status === 'authenticated'
  const isAdmin = session?.user?.role === 'Admin'

  const handleLogout = async () => {
    await signOut()
  }

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
            <Link className={isActive('/chat') ? 'nav-link active' : 'nav-link'} href="/chat">
              Chat
            </Link>
            {isAdmin && (
              <Link className={isActive('/admin') ? 'nav-link active' : 'nav-link'} href="/admin">
                Admin
              </Link>
            )}
            {isAuthenticated ? (
              <button className="nav-link logout-btn" onClick={handleLogout}>
                Logout
              </button>
            ) : (
              <Link className={isActive('/auth') ? 'nav-link active' : 'nav-link'} href="/auth">
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>

      <nav className={`nav-mobile ${isAdmin ? 'nav-mobile-admin' : ''}`}>
        <Link className={isActive('/') ? 'tab-link active' : 'tab-link'} href="/">
          Discover
        </Link>
        <Link className={isActive('/chat') ? 'tab-link active' : 'tab-link'} href="/chat">
          Chat
        </Link>
        {isAdmin && (
          <Link className={isActive('/admin') ? 'tab-link active' : 'tab-link'} href="/admin">
            Admin
          </Link>
        )}
        {isAuthenticated ? (
          <button className="tab-link logout-btn" onClick={handleLogout}>
            Logout
          </button>
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
    <AuthProvider>
      <AppContent {...props} />
    </AuthProvider>
  )
}
