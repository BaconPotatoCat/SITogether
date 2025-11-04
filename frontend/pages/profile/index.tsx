import Head from 'next/head'
import React, { useState, useEffect } from 'react'
import { useSession } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import ToastContainer from '../../components/ToastContainer'
import { useToast } from '../../hooks/useToast'
import { fetchWithAuth } from '../../utils/api'
import { validatePasswordChange } from '../../utils/passwordValidation'

type ViewMode = 'menu' | 'edit' | 'changePassword'

export default function MyProfilePage() {
  const { session, status, signOut, refreshSession } = useSession()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { toasts, showToast, removeToast } = useToast()
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
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Initialize edit form when session loads
  useEffect(() => {
    if (session?.user) {
      setEditForm({
        name: session.user.name,
        age: session.user.age,
        course: session.user.course || '',
        bio: session.user.bio || '',
        interests: Array.isArray(session.user.interests) ? session.user.interests.join(', ') : '',
      })
    }
  }, [session?.user])

  const handleSave = async () => {
    if (!session?.user) return

    // Validate age
    if (!editForm.age || editForm.age < 18 || editForm.age > 65) {
      showToast('Age must be between 18 and 65', 'error')
      return
    }

    try {
      setIsSaving(true)

      const response = await fetchWithAuth(`/api/users/${session.user.id}`, {
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
        setViewMode('menu')
        showToast('Profile updated successfully!', 'success')
        // Refresh session to update user data in AuthContext
        await refreshSession()
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
    if (session?.user) {
      setEditForm({
        name: session.user.name,
        age: session.user.age,
        course: session.user.course || '',
        bio: session.user.bio || '',
        interests: Array.isArray(session.user.interests) ? session.user.interests.join(', ') : '',
      })
    }
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    setViewMode('menu')
  }

  const handleChangePassword = async () => {
    if (!session?.user) return

    // Validate password change according to NIST 2025 guidelines
    const passwordValidation = validatePasswordChange(
      passwordForm.currentPassword,
      passwordForm.newPassword
    )
    if (!passwordValidation.isValid) {
      showToast(passwordValidation.errors[0], 'error')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('New password and confirm password do not match', 'error')
      return
    }

    try {
      setIsChangingPassword(true)

      // Use fetchWithAuth with redirectOn401: false to maintain authentication (UBAC)
      // but avoid automatic redirect on 401
      // For change-password, 401 means wrong current password, not unauthenticated
      const response = await fetchWithAuth(
        '/api/auth/change-password',
        {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
          }),
        },
        false
      )

      const result = await response.json()

      if (response.ok && result.success) {
        setViewMode('menu')
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
        showToast('Password changed successfully!', 'success')
      } else {
        // Handle different error cases
        if (response.status === 401) {
          // Check if it's an authentication failure (no token/invalid token)
          // or just wrong current password
          if (result.error && result.error.toLowerCase().includes('current password')) {
            // Wrong current password
            showToast('Current password is incorrect', 'error')
          } else if (result.error && result.error.toLowerCase().includes('authentication')) {
            // Authentication failure - user not logged in
            window.location.href = '/auth'
          } else {
            // Generic 401 - assume wrong password for security (don't reveal auth state)
            showToast('Current password is incorrect', 'error')
          }
        } else if (response.status === 400) {
          // Validation error from backend
          showToast(
            result.error || 'Invalid input. Please check your password requirements.',
            'error'
          )
        } else if (response.status === 403) {
          // Authorization failure - redirect to login
          window.location.href = '/auth'
        } else if (response.status === 500) {
          // Server error
          showToast('An error occurred. Please try again later.', 'error')
        } else {
          // Other errors
          showToast(result.error || 'Failed to change password. Please try again.', 'error')
        }
      }
    } catch (error) {
      console.error('Error changing password:', error)
      showToast('An error occurred while changing your password. Please try again.', 'error')
    } finally {
      setIsChangingPassword(false)
    }
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

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size must be less than 10MB', 'error')
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

      // Validate that base64 conversion was successful
      if (!base64String || !base64String.startsWith('data:image/')) {
        showToast('Invalid image file. Please select a valid image and try again.', 'error')
        return
      }

      // Update profile with new avatar
      if (session?.user) {
        const response = await fetchWithAuth(`/api/users/${session.user.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: session.user.name,
            age: session.user.age,
            course: session.user.course,
            bio: session.user.bio,
            interests: session.user.interests,
            avatarUrl: base64String,
          }),
        })

        // Check if response is ok and has valid JSON
        let result
        try {
          const responseText = await response.text()
          if (!response.ok) {
            // Log detailed error for debugging, but show generic message to user
            try {
              const errorResult = JSON.parse(responseText)
              console.error('Failed to update profile:', errorResult.error)
            } catch {
              console.error('Failed to update profile:', responseText)
            }
            // Always show generic error message to user for security
            showToast('Failed to update profile picture. Please try again.', 'error')
            return
          }
          // Parse the successful response
          result = JSON.parse(responseText)
        } catch (parseError) {
          console.error('Error parsing response:', parseError)
          showToast('An error occurred. Please try again.', 'error')
          return
        }

        if (result.success) {
          showToast('Profile picture updated successfully!', 'success')
          // Refresh session to update avatar in AuthContext
          await refreshSession()
        } else {
          // Log detailed error but show generic message
          console.error('Failed to update profile:', result.error)
          showToast('Failed to update profile picture. Please try again.', 'error')
        }
      }
    } catch (error) {
      // Log detailed error for debugging
      console.error('Error uploading avatar:', error)
      // Show generic error message to user for security
      showToast(
        'An error occurred while uploading your profile picture. Please try again.',
        'error'
      )
    } finally {
      setIsUploadingAvatar(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (status === 'loading') {
    return <LoadingSpinner fullScreen message="Loading your profile..." />
  }

  if (status === 'unauthenticated' || !session?.user) {
    return null // Will be redirected by middleware
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
                    session.user.avatarUrl ||
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.1.0&auto=format&fit=crop&q=80&w=687'
                  }
                  alt={`${session.user.name} avatar`}
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
              <h2 className="profile-name">{session.user.name}</h2>
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

              <button className="profile-menu-item" onClick={() => setViewMode('changePassword')}>
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
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <span className="menu-item-text">Change Password</span>
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
        ) : viewMode === 'edit' ? (
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
        ) : viewMode === 'changePassword' ? (
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
              <h2>Change Password</h2>
              <div style={{ width: '24px' }}></div>
            </div>

            <div className="edit-form-container">
              <div className="form-group">
                <label htmlFor="current-password">Current Password</label>
                <input
                  id="current-password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  className="input"
                  placeholder="Enter your current password"
                  required
                  minLength={8}
                  maxLength={64}
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                  className="input"
                  placeholder="Enter your new password (min 8 characters)"
                  required
                  minLength={8}
                  maxLength={64}
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirm-password">Confirm New Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  className="input"
                  placeholder="Confirm your new password"
                  required
                  minLength={8}
                  maxLength={64}
                />
              </div>
              <button
                className="btn primary save-btn"
                onClick={handleChangePassword}
                disabled={
                  isChangingPassword ||
                  !passwordForm.currentPassword ||
                  !passwordForm.newPassword ||
                  !passwordForm.confirmPassword
                }
              >
                {isChangingPassword ? 'Changing Password...' : 'Change Password'}
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  )
}
