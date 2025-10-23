import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getProfileById, CURRENT_USER } from '../../lib/profiles'

interface User {
  id: string
  name: string
  age: number
  gender: string
  course: string | null
  bio: string | null
  interests: string[]
  avatarUrl: string | null
  confirmed: boolean
  createdAt: string
  updatedAt: string
}

export default function ProfilePage() {
  const router = useRouter()
  const idParam = router.query.id
  const id = typeof idParam === 'string' ? parseInt(idParam, 10) : NaN
  const isCurrentUser = id === CURRENT_USER.id
  const [profile, setProfile] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    age: 0,
    course: '',
    bio: '',
    interests: ''
  })
  const [isSaving, setIsSaving] = useState(false)

  // Fetch user data from database
  useEffect(() => {
    const fetchUser = async () => {
      if (!router.isReady) return

      try {
        setIsLoading(true)
        
        if (isCurrentUser) {
          // For current user, get the first user from database
          const response = await fetch('/api/users/first')
          const result = await response.json()
          
          if (result.success) {
            setProfile(result.data)
            setEditForm({
              name: result.data.name,
              age: result.data.age,
              course: result.data.course || '',
              bio: result.data.bio || '',
              interests: result.data.interests.join(', ')
            })
          } else {
            console.error('Failed to fetch user:', result.error)
          }
        } else if (Number.isFinite(id)) {
          // For other users, get from static profiles
          const staticProfile = getProfileById(id)
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
              confirmed: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
            setProfile(userProfile)
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
  }, [router.isReady, isCurrentUser, id])

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
        <Link className="btn" href="/">Back</Link>
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
          interests: editForm.interests.split(',').map(i => i.trim()).filter(i => i)
        })
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
        interests: profile.interests.join(', ')
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
            src={profile.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687'} 
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
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Age</label>
                  <input
                    type="number"
                    value={editForm.age}
                    onChange={(e) => setEditForm({...editForm, age: parseInt(e.target.value) || 0})}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Course</label>
                  <input
                    type="text"
                    value={editForm.course}
                    onChange={(e) => setEditForm({...editForm, course: e.target.value})}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Bio</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                    className="input"
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label>Interests (comma-separated)</label>
                  <input
                    type="text"
                    value={editForm.interests}
                    onChange={(e) => setEditForm({...editForm, interests: e.target.value})}
                    className="input"
                    placeholder="Coding, Gaming, Tech"
                  />
                </div>
                <div className="form-actions">
                  <button className="btn ghost" onClick={handleCancel} disabled={isSaving}>
                    Cancel
                  </button>
                  <button 
                    className="btn primary" 
                    onClick={handleSave} 
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1>{profile.name}, {profile.age}</h1>
                <p className="muted">{profile.course || 'No course specified'}</p>
                <p className="bio" style={{ marginTop: 12 }}>
                  {profile.bio || 'No bio available'}
                </p>
                <div className="chips" style={{ marginTop: 12 }}>
                  {profile.interests.length > 0 ? (
                    profile.interests.map((i) => (
                      <span key={i} className="chip">{i}</span>
                    ))
                  ) : (
                    <span className="chip muted">No interests specified</span>
                  )}
                </div>
                <div style={{ marginTop: 16 }}>
                  {isCurrentUser ? (
                    <button className="btn primary" onClick={() => setIsEditing(true)}>
                      Edit Profile
                    </button>
                  ) : (
                    <Link className="btn" href="/chat">Message</Link>
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
