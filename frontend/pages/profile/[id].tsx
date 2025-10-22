import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useState } from 'react'
import { getProfileById, CURRENT_USER } from '../../lib/profiles'

export default function ProfilePage() {
  const router = useRouter()
  const idParam = router.query.id
  const id = typeof idParam === 'string' ? parseInt(idParam, 10) : NaN
  const isCurrentUser = id === CURRENT_USER.id
  const profile = Number.isFinite(id) ? (isCurrentUser ? CURRENT_USER : getProfileById(id)) : undefined
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: CURRENT_USER.name,
    age: CURRENT_USER.age,
    course: CURRENT_USER.course,
    bio: CURRENT_USER.bio,
    interests: CURRENT_USER.interests.join(', ')
  })

  if (!router.isReady) {
    return null
  }

  if (!profile) {
    return (
      <main className="container">
        <p className="muted">Profile not found.</p>
        <Link className="btn" href="/">Back</Link>
      </main>
    )
  }

  const handleSave = () => {
    // In a real app, this would save to a backend
    console.log('Saving profile:', editForm)
    setIsEditing(false)
    // Update the current user data (in a real app, this would be handled by state management)
    Object.assign(CURRENT_USER, {
      name: editForm.name,
      age: editForm.age,
      course: editForm.course,
      bio: editForm.bio,
      interests: editForm.interests.split(',').map(i => i.trim()).filter(i => i)
    })
  }

  const handleCancel = () => {
    setEditForm({
      name: CURRENT_USER.name,
      age: CURRENT_USER.age,
      course: CURRENT_USER.course,
      bio: CURRENT_USER.bio,
      interests: CURRENT_USER.interests.join(', ')
    })
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
          <img className="profile-avatar" src={profile.avatarUrl} alt={`${profile.name} avatar`} />
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
                  <button className="btn ghost" onClick={handleCancel}>Cancel</button>
                  <button className="btn primary" onClick={handleSave}>Save</button>
                </div>
              </div>
            ) : (
              <>
                <h1>{profile.name}, {profile.age}</h1>
                <p className="muted">{profile.course}</p>
                <p className="bio" style={{ marginTop: 12 }}>{profile.bio}</p>
                <div className="chips" style={{ marginTop: 12 }}>
                  {profile.interests.map((i) => (
                    <span key={i} className="chip">{i}</span>
                  ))}
                </div>
                <div style={{ marginTop: 16 }}>
                  {isCurrentUser ? (
                    <button className="btn primary" onClick={() => setIsEditing(true)}>Edit Profile</button>
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
