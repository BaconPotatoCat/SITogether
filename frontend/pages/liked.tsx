import { useState, useEffect } from 'react'
import Head from 'next/head'
import { fetchWithAuth } from '../utils/api'
import IntroMessageModal from '../components/IntroMessageModal'
import ToastContainer from '../components/ToastContainer'
import { useToast } from '../hooks/useToast'

interface Profile {
  id: string
  name: string
  age: number
  gender: string
  course: string
  interests: string[]
  bio: string
  avatarUrl: string
  hasIntro?: boolean
}

export default function LikedProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isIntroOpen, setIsIntroOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [pendingLikeUserId, setPendingLikeUserId] = useState<string | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const { toasts, showToast, removeToast } = useToast()

  // Fetch liked profiles with hasIntro flag
  useEffect(() => {
    const fetchLikedProfiles = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetchWithAuth('/api/likes/all')

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        if (result.success) {
          setProfiles(result.data || [])
          setError(null)
        } else {
          setError(result.error || 'Failed to fetch liked profiles')
        }
      } catch (err) {
        console.error('Error fetching liked profiles:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch liked profiles')
      } finally {
        setLoading(false)
      }
    }

    fetchLikedProfiles()
  }, [])

  const handleProfileClick = (profile: Profile) => {
    setSelectedProfile(profile)
    setIsProfileModalOpen(true)
  }

  const handleSendIntro = () => {
    if (selectedProfile && !selectedProfile.hasIntro) {
      setPendingLikeUserId(selectedProfile.id)
      setIsProfileModalOpen(false)
      setIsIntroOpen(true)
    }
  }

  const handleReportClick = () => {
    if (selectedProfile) {
      setShowReportModal(true)
      setReportReason('')
      setReportDescription('')
    }
  }

  const handleSubmitReport = async () => {
    if (!selectedProfile || !reportReason.trim()) {
      showToast('Please select a reason for reporting', 'warning')
      return
    }

    setIsSubmittingReport(true)
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reportedId: selectedProfile.id,
          reason: reportReason,
          description: reportDescription.trim() || null,
        }),
      })

      const result = await response.json()

      if (result.success) {
        showToast(
          'Report submitted successfully. Thank you for helping keep our community safe.',
          'success'
        )
        setShowReportModal(false)
        setReportReason('')
        setReportDescription('')
      } else {
        showToast(result.error || 'Failed to submit report', 'error')
      }
    } catch (error) {
      showToast('Failed to submit report. Please try again.', 'error')
      console.error('Report error:', error)
    } finally {
      setIsSubmittingReport(false)
    }
  }

  const submitIntro = async (message: string | null) => {
    if (!pendingLikeUserId) {
      setIsIntroOpen(false)
      return
    }

    if (!message || message.trim().length === 0) {
      showToast('Please enter an introduction message', 'warning')
      return
    }

    try {
      const response = await fetchWithAuth(`/api/likes/${pendingLikeUserId}/intro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ introMessage: message.trim() }),
      })

      const result = await response.json()

      if (result.success) {
        // Refresh the list to update hasIntro flags
        const refreshResponse = await fetchWithAuth('/api/likes/all')
        if (refreshResponse.ok) {
          const refreshResult = await refreshResponse.json()
          if (refreshResult.success) {
            setProfiles(refreshResult.data || [])
          }
        }
        setSelectedProfile(null)
        showToast('Introduction sent successfully!', 'success')
      } else {
        // Handle 409 Conflict (intro already sent)
        if (response.status === 409) {
          showToast('You have already sent an introduction message to this user.', 'warning')
          // Refresh the list to update hasIntro flags
          const refreshResponse = await fetchWithAuth('/api/likes/all')
          if (refreshResponse.ok) {
            const refreshResult = await refreshResponse.json()
            if (refreshResult.success) {
              setProfiles(refreshResult.data || [])
            }
          }
        } else {
          console.error('Failed to send introduction:', result.error)
          showToast(`Failed to send introduction: ${result.error || 'Unknown error'}`, 'error')
        }
      }
    } catch (error) {
      console.error('Error sending introduction:', error)
      showToast('Failed to send introduction. Please try again.', 'error')
    } finally {
      setIsIntroOpen(false)
      setPendingLikeUserId(null)
    }
  }

  return (
    <>
      <Head>
        <title>SITogether • Liked Profiles</title>
        <meta name="description" content="Send introductions to profiles you've liked" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container">
        <IntroMessageModal
          isOpen={isIntroOpen}
          onCancel={() => {
            setIsIntroOpen(false)
            setPendingLikeUserId(null)
          }}
          onSubmit={submitIntro}
          required={true}
          submitButtonText="Send Introduction"
        />

        <section style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ marginBottom: '24px', fontSize: '28px', fontWeight: 700 }}>
            Profiles You&apos;ve Liked
          </h1>
          <p className="muted" style={{ marginBottom: '32px', fontSize: '16px' }}>
            Click on a profile to view their details and send them an introduction message.
          </p>

          {loading ? (
            <div
              className="muted"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '400px',
                fontSize: '18px',
              }}
            >
              🔄 Loading liked profiles...
            </div>
          ) : error ? (
            <div
              className="error-alert"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '400px',
                fontSize: '18px',
                borderRadius: '8px',
                padding: '20px',
                margin: '20px',
              }}
            >
              ❌ Error loading profiles: {error}
            </div>
          ) : profiles.length === 0 ? (
            <div
              className="muted"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '400px',
                fontSize: '18px',
                textAlign: 'center',
                padding: '40px',
              }}
            >
              <p style={{ marginBottom: '16px' }}>✨ No profiles to introduce yourself to!</p>
              <p className="muted" style={{ fontSize: '14px' }}>
                All your liked profiles already have introductions, or you haven&apos;t liked anyone
                yet.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                paddingBottom: '40px',
              }}
            >
              {profiles.map((profile) => (
                <article
                  key={profile.id}
                  onClick={() => handleProfileClick(profile)}
                  className="liked-profile-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    borderRadius: '12px',
                    transition:
                      'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <img
                    src={
                      profile.avatarUrl ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&size=400&background=6366f1&color=ffffff&bold=true`
                    }
                    alt={`${profile.name} avatar`}
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <h3
                      style={{
                        margin: '0 0 4px 0',
                        fontSize: '18px',
                        fontWeight: 600,
                        textAlign: 'left',
                      }}
                    >
                      {profile.name}, {profile.age}
                    </h3>
                    <p
                      className="course muted"
                      style={{ margin: '0 0 8px 0', fontSize: '14px', textAlign: 'left' }}
                    >
                      {profile.course}
                    </p>
                    <p
                      className="bio muted"
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textAlign: 'left',
                      }}
                    >
                      {profile.bio || 'No bio available'}
                    </p>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '8px',
                    }}
                  >
                    <div
                      className="chips"
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        justifyContent: 'flex-end',
                      }}
                    >
                      {profile.interests.slice(0, 2).map((interest) => (
                        <span
                          key={interest}
                          className="chip"
                          style={{
                            padding: '2px 8px',
                            backgroundColor: '#eef2ff',
                            color: '#3730a3',
                            borderRadius: '12px',
                            fontSize: '11px',
                          }}
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                    <span
                      className="liked-profile-action"
                      style={{ fontSize: '12px', fontWeight: 500 }}
                    >
                      Click to view →
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Profile Detail Modal */}
          {isProfileModalOpen && selectedProfile && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px',
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setIsProfileModalOpen(false)
                  setSelectedProfile(null)
                }
              }}
            >
              <div
                className="profile-modal-content"
                style={{
                  borderRadius: '16px',
                  width: 'min(600px, 100%)',
                  maxHeight: '90vh',
                  overflow: 'auto',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img
                    src={
                      selectedProfile.avatarUrl ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedProfile.name)}&size=400&background=6366f1&color=ffffff&bold=true`
                    }
                    alt={`${selectedProfile.name} avatar`}
                    style={{
                      width: '100%',
                      height: '400px',
                      objectFit: 'cover',
                      borderTopLeftRadius: '16px',
                      borderTopRightRadius: '16px',
                    }}
                  />
                  <button
                    onClick={() => {
                      setIsProfileModalOpen(false)
                      setSelectedProfile(null)
                    }}
                    style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(0,0,0,0.5)',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ padding: '24px' }}>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 700 }}>
                    {selectedProfile.name}, {selectedProfile.age}
                  </h2>
                  <p className="course muted" style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
                    {selectedProfile.course}
                  </p>
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>Bio</h3>
                    <p className="bio muted" style={{ margin: 0, lineHeight: '1.6' }}>
                      {selectedProfile.bio || 'No bio available'}
                    </p>
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
                      Interests
                    </h3>
                    <div
                      className="chips"
                      style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
                    >
                      {selectedProfile.interests.length > 0 ? (
                        selectedProfile.interests.map((interest) => (
                          <span
                            key={interest}
                            className="chip"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '16px',
                              fontSize: '14px',
                            }}
                          >
                            {interest}
                          </span>
                        ))
                      ) : (
                        <span className="muted" style={{ fontSize: '14px' }}>
                          No interests specified
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    {selectedProfile.hasIntro ? (
                      <button
                        className="btn"
                        disabled
                        style={{
                          width: '100%',
                          padding: '12px',
                          opacity: 0.6,
                          cursor: 'not-allowed',
                        }}
                      >
                        Introduction Already Sent ✓
                      </button>
                    ) : (
                      <button
                        className="btn primary"
                        onClick={handleSendIntro}
                        style={{ width: '100%', padding: '12px' }}
                      >
                        Send an Introduction
                      </button>
                    )}
                    <button
                      onClick={handleReportClick}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#c82333'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#dc3545'
                      }}
                    >
                      🚩 Report User
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Report Modal */}
      {showReportModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={() => {
            if (!isSubmittingReport) {
              setShowReportModal(false)
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Report User</h2>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Please select a reason for reporting this user. All reports are reviewed by our
              moderation team.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="report-reason-select"
                style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}
              >
                Reason <span style={{ color: '#dc3545' }}>*</span>
              </label>
              <select
                id="report-reason-select"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                disabled={isSubmittingReport}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                }}
              >
                <option value="">Select a reason...</option>
                <option value="Inappropriate Content">Inappropriate Content</option>
                <option value="Harassment">Harassment</option>
                <option value="Spam">Spam</option>
                <option value="Fake Profile">Fake Profile</option>
                <option value="Inappropriate Behavior">Inappropriate Behavior</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="report-description-textarea"
                style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}
              >
                Additional Details (Optional)
              </label>
              <textarea
                id="report-description-textarea"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                disabled={isSubmittingReport}
                placeholder="Please provide any additional information..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  if (!isSubmittingReport) {
                    setShowReportModal(false)
                  }
                }}
                disabled={isSubmittingReport}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSubmittingReport ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={isSubmittingReport || !reportReason.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor:
                    isSubmittingReport || !reportReason.trim() ? '#6c757d' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSubmittingReport || !reportReason.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  )
}
