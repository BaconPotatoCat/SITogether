import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useSession } from '../../contexts/AuthContext'
import { getProfileById } from '../../lib/profiles'

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
  const isCurrentUser = id === session?.user?.id
  const [profile, setProfile] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    age: 0,
    course: '',
    bio: '',
    interests: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      if (!router.isReady || !id) return

      try {
        setIsLoading(true)

        // Try to get user from database first
        const response = await fetch(`/api/users/${id}`)
        const result = await response.json()

        if (result.success && result.data) {
          setProfile(result.data)
          if (isCurrentUser) {
            setEditForm({
              name: result.data.name,
              age: result.data.age,
              course: result.data.course || '',
              bio: result.data.bio || '',
              interests: Array.isArray(result.data.interests)
                ? result.data.interests.join(', ')
                : '',
            })
          }
        } else {
          // Fallback to static profiles if not found in database
          const numericId = parseInt(id, 10)
          if (Number.isFinite(numericId)) {
            const staticProfile = getProfileById(numericId)
            if (staticProfile) {
              const userProfile: User = {
                id: staticProfile.id.toString(),
                name: staticProfile.name,
                age: staticProfile.age,
                gender: 'Other',
                course: staticProfile.course,
                bio: staticProfile.bio,
                interests: staticProfile.interests,
                avatarUrl: staticProfile.avatarUrl,
                verified: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
              setProfile(userProfile)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
  }, [router.isReady, id, isCurrentUser])

  if (!router.isReady || isLoading) {
    return (
      <main className="container">
        <p className="muted">Loading...</p>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="container">
        <p className="muted">Profile not found.</p>
        <Link className="btn" href="/">
          Back
        </Link>
      </main>
    )
  }

  const handleSave = async () => {
    if (!profile) return

    try {
      setIsSaving(true)

      const response = await fetch(`/api/users/${profile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          age: editForm.age,
          course: editForm.course,
          bio: editForm.bio,
          interests: editForm.interests
            .split(',')
            .map((i) => i.trim())
            .filter((i) => i),
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Update the profile state with the updated data
        setProfile(result.data)
        setIsEditing(false)
        console.log('Profile updated successfully')
      } else {
        console.error('Failed to update profile:', result.error)
        alert(`Failed to update profile: ${result.error}`)
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert(`An error occurred while updating the profile.`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setEditForm({
        name: profile.name,
        age: profile.age,
        course: profile.course || '',
        bio: profile.bio || '',
        interests: profile.interests.join(', '),
      })
    }
    setIsEditing(false)
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
            {isEditing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Age</label>
                  <input
                    type="number"
                    value={editForm.age}
                    onChange={(e) =>
                      setEditForm({ ...editForm, age: parseInt(e.target.value) || 0 })
                    }
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Course</label>
                  <input
                    type="text"
                    value={editForm.course}
                    onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Bio</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    className="input"
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label>Interests (comma-separated)</label>
                  <input
                    type="text"
                    value={editForm.interests}
                    onChange={(e) => setEditForm({ ...editForm, interests: e.target.value })}
                    className="input"
                    placeholder="Coding, Gaming, Tech"
                  />
                </div>
                <div className="form-actions">
                  <button className="btn ghost" onClick={handleCancel} disabled={isSaving}>
                    Cancel
                  </button>
                  <button className="btn primary" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1>
                  {profile.name}, {profile.age}
                </h1>
                {profile.email && <p className="muted">{profile.email}</p>}
                <p className="muted" style={{ marginTop: profile.email ? '0.25rem' : 0 }}>
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
                  {isCurrentUser ? (
                    <button className="btn primary" onClick={() => setIsEditing(true)}>
                      Edit Profile
                    </button>
                  ) : (
                    <>
                      <Link className="btn primary" href="/chat">
                        Message
                      </Link>
                      <Link className="btn ghost" href="/">
                        Back to Discover
                      </Link>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </article>
      </main>
    </>
  )
}
