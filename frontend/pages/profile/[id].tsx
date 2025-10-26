import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useSession } from '../../contexts/AuthContext'

interface User {
  id: string
  email?: string
  name: string
  age: number
  gender: string
  course: string | null
  bio: string | null
  interests: string[]
  avatarUrl: string | null
  verified?: boolean
  createdAt: string
  updatedAt: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { session } = useSession()
  const idParam = router.query.id
  const id = typeof idParam === 'string' ? idParam : null
  const [profile, setProfile] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      if (!router.isReady || !id) return

      // If accessing own profile via UUID, redirect to /profile
      if (id === session?.user?.id) {
        router.push('/profile')
        return
      }

      try {
        setIsLoading(true)

        // Get user from database
        const response = await fetch(`/api/users/${id}`)
        const result = await response.json()

        if (result.success && result.data) {
          setProfile(result.data)
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
  }, [router.isReady, id, session])

  if (!router.isReady || isLoading) {
    return (
      <main className="container">
        <p className="muted">Loading...</p>
      </main>
    )
  }

  if (!profile) {
    return (
      <>
        <Head>
          <title>Profile Not Found • SITogether</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <main className="container" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '60vh',
          textAlign: 'center',
          padding: '2rem'
        }}>
          <div style={{ 
            fontSize: '4rem', 
            marginBottom: '1rem',
            opacity: 0.5 
          }}>
            👤
          </div>
          <h1 style={{ marginBottom: '0.5rem' }}>Profile Not Found</h1>
          <p className="muted" style={{ 
            marginBottom: '2rem',
            maxWidth: '400px' 
          }}>
            The profile you're looking for doesn't exist or may have been removed.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link className="btn primary" href="/">
              Back to Discover
            </Link>
            <Link className="btn ghost" href="/profile">
              My Profile
            </Link>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>{profile.name} • Profile</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="container">
        <article className="profile">
          <img
            className="profile-avatar"
            src={
              profile.avatarUrl ||
              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687'
            }
            alt={`${profile.name} avatar`}
          />
          <div className="profile-body">
            <h1>
              {profile.name}, {profile.age}
            </h1>
            <p className="muted">
              {profile.course || 'No course specified'}
            </p>
            <p className="bio" style={{ marginTop: 12 }}>
              {profile.bio || 'No bio available'}
            </p>
            <div className="chips" style={{ marginTop: 12 }}>
              {profile.interests && profile.interests.length > 0 ? (
                profile.interests.map((interest, idx) => (
                  <span key={idx} className="chip">
                    {interest}
                  </span>
                ))
              ) : (
                <span className="chip muted">No interests specified</span>
              )}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: '0.5rem' }}>
              <Link className="btn primary" href="/chat">
                Message
              </Link>
              <Link className="btn ghost" href="/">
                Back to Discover
              </Link>
            </div>
          </div>
        </article>
      </main>
    </>
  )
}
