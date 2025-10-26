import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'
import React, { useState, useEffect } from 'react'
import { useSession } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import ToastContainer from '../../components/ToastContainer'
import { useToast } from '../../hooks/useToast'
import { fetchWithAuth } from '../../utils/api'

interface User {
  id: string
  email: string
  name: string
  age: number
  gender: string
  role: string
  course: string | null
  bio: string | null
  interests: string[]
  avatarUrl: string | null
  verified?: boolean
  createdAt: string
  updatedAt: string
}

type ViewMode = 'menu' | 'edit'

export default function MyProfilePage() {
  const router = useRouter()
  const { session, status, signOut } = useSession()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { toasts, showToast, removeToast } = useToast()
  const [profile, setProfile] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('menu')
  const [editForm, setEditForm] = useState({
    name: '',
    age: 0,
    course: '',
    bio: '',
    interests: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
    }
  }, [status, router])

  // Fetch current user's profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) return

      try {
        setIsLoading(true)

        const response = await fetchWithAuth(`/api/users/${session.user.id}`)
        const result = await response.json()

        if (result.success && result.data) {
          setProfile(result.data)
          setEditForm({
            name: result.data.name,
            age: result.data.age,
            course: result.data.course || '',
            bio: result.data.bio || '',
            interests: Array.isArray(result.data.interests) ? result.data.interests.join(', ') : '',
          })
        } else {
          showToast(result.error || 'Failed to fetch profile', 'error')
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
        showToast('An error occurred while fetching your profile', 'error')
      } finally {
        setIsLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchProfile()
    }
  }, [session?.user?.id, status])

  const handleSave = async () => {
    if (!profile) return

    // Validate age
    if (!editForm.age || editForm.age < 18 || editForm.age > 65) {
      showToast('Age must be between 18 and 65', 'error')
      return
    }

    try {
      setIsSaving(true)

      const response = await fetchWithAuth(`/api/users/${profile.id}`, {
        method: 'PUT',
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
        setProfile(result.data)
        setViewMode('menu')
        showToast('Profile updated successfully!', 'success')
      } else {
        showToast(result.error || 'Failed to update profile', 'error')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      showToast('An error occurred while updating your profile', 'error')
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
        interests: Array.isArray(profile.interests) ? profile.interests.join(', ') : '',
      })
    }
    setViewMode('menu')
  }

  const handleLogout = async () => {
    await signOut()
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be less than 5MB', 'error')
      return
    }

    setIsUploadingAvatar(true)

    try {
      // Convert image to base64
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Update profile with new avatar
      if (profile) {
        const response = await fetchWithAuth(`/api/users/${profile.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: profile.name,
            age: profile.age,
            course: profile.course,
            bio: profile.bio,
            interests: profile.interests,
            avatarUrl: base64String,
          }),
        })

        const result = await response.json()

        if (result.success) {
          setProfile(result.data)
          showToast('Profile picture updated successfully!', 'success')
        } else {
          showToast(result.error || 'Failed to update profile picture', 'error')
          console.error('Failed to update profile:', result.error)
        }
      }
    } catch (error) {
      console.error('Error uploading avatar:', error)
      showToast('An error occurred while uploading your profile picture', 'error')
    } finally {
      setIsUploadingAvatar(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (status === 'loading' || isLoading) {
    return <LoadingSpinner fullScreen message="Loading your profile..." />
  }

  if (status === 'unauthenticated') {
    return null // Will redirect in useEffect
  }

  if (!profile) {
    return (
      <main className="container">
        <p className="muted">Profile not found.</p>
        <Link className="btn" href="/">
          Back to Home
        </Link>
      </main>
    )
  }

  return (
    <>
      <Head>
        <title>My Profile • SITogether</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="profile-page-container">
        {viewMode === 'menu' ? (
          <div className="profile-menu-view">
            <div className="profile-header-section">
              <div className="profile-avatar-wrapper">
                <img
                  className="profile-avatar-large"
                  src={
                    profile?.avatarUrl ||
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.1.0&auto=format&fit=crop&q=80&w=687'
                  }
                  alt={`${profile?.name} avatar`}
                />
                <button
                  className="avatar-edit-btn"
                  onClick={handleAvatarClick}
                  disabled={isUploadingAvatar}
                  title="Change profile picture"
                >
                  {isUploadingAvatar ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="spinner-icon"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                  ) : (
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
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                />
              </div>
              <h2 className="profile-name">{profile?.name}</h2>
            </div>

            <div className="profile-menu-list">
              <button className="profile-menu-item" onClick={() => setViewMode('edit')}>
                <div className="menu-item-icon" style={{ backgroundColor: '#eef2ff' }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <span className="menu-item-text">Edit Profile</span>
                <svg
                  className="menu-item-arrow"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>

              <div className="profile-menu-item">
                <div className="menu-item-icon" style={{ backgroundColor: '#eef2ff' }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {isDarkMode ? (
                      <>
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                      </>
                    ) : (
                      <>
                        <circle cx="12" cy="12" r="5"></circle>
                        <line x1="12" y1="1" x2="12" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="23"></line>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                        <line x1="1" y1="12" x2="3" y2="12"></line>
                        <line x1="21" y1="12" x2="23" y2="12"></line>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                      </>
                    )}
                  </svg>
                </div>
                <span className="menu-item-text">Dark Mode</span>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    id="darkmode-toggle"
                    checked={isDarkMode}
                    onChange={toggleDarkMode}
                  />
                  <label htmlFor="darkmode-toggle" className="toggle-label"></label>
                </div>
              </div>

              <button className="profile-menu-item" onClick={handleLogout}>
                <div className="menu-item-icon" style={{ backgroundColor: '#eef2ff' }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </div>
                <span className="menu-item-text">Logout</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-edit-view">
            <div className="edit-header">
              <button className="back-btn" onClick={handleCancel}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <h2>Edit Profile</h2>
              <div style={{ width: '24px' }}></div>
            </div>

            <div className="edit-form-container">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div className="form-group">
                <label>Age</label>
                <input
                  type="number"
                  value={editForm.age}
                  onChange={(e) => setEditForm({ ...editForm, age: parseInt(e.target.value) || 0 })}
                  className="input"
                  min="18"
                  max="65"
                  required
                />
              </div>
              <div className="form-group">
                <label>Course</label>
                <input
                  type="text"
                  value={editForm.course}
                  onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                  className="input"
                  placeholder="e.g., Computer Science"
                />
              </div>
              <div className="form-group">
                <label>Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Tell us about yourself..."
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
              <button
                className="btn primary save-btn"
                onClick={handleSave}
                disabled={isSaving || !editForm.name || !editForm.age}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  )
}
