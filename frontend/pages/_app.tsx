import type { AppProps } from 'next/app'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { CURRENT_USER } from '../lib/profiles'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isActive = (path: string) => router.pathname === path

  return (
    <div className="app-shell">
      <nav className="nav-desktop">
        <div className="nav-inner">
          <div className="brand">
            <Link href="/">SITogether</Link>
          </div>
          <div className="nav-links">
            <Link className={isActive('/') ? 'nav-link active' : 'nav-link'} href="/">Discover</Link>
            <Link className={isActive('/chat') ? 'nav-link active' : 'nav-link'} href="/chat">Chat</Link>
            <Link href={`/profile/${CURRENT_USER.id}`} className="nav-profile">
              <img 
                src={CURRENT_USER.avatarUrl} 
                alt={`${CURRENT_USER.name} profile`} 
                className="nav-avatar"
              />
            </Link>
          </div>
        </div>
      </nav>

      <div className="page-content">
        <Component {...pageProps} />
      </div>

      <nav className="nav-mobile">
        <Link className={isActive('/') ? 'tab-link active' : 'tab-link'} href="/">Discover</Link>
        <Link className={isActive('/chat') ? 'tab-link active' : 'tab-link'} href="/chat">Chat</Link>
      </nav>
    </div>
  )
}
