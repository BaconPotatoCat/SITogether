import { useState, useEffect } from 'react'
import Head from 'next/head'
import { fetchWithAuth } from '../utils/api'
import IntroMessageModal from '../components/IntroMessageModal'

interface Profile {
  id: string
  name: string
  age: number
  gender: string
  course: string
  interests: string[]
  bio: string
  avatarUrl: string
}

export default function LikedProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isIntroOpen, setIsIntroOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [pendingLikeUserId, setPendingLikeUserId] = useState<string | null>(null)

  // Fetch liked profiles without intro messages
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
    if (selectedProfile) {
      setPendingLikeUserId(selectedProfile.id)
      setIsProfileModalOpen(false)
      setIsIntroOpen(true)
    }
  }

  const submitIntro = async (message: string | null) => {
    if (!pendingLikeUserId) {
      setIsIntroOpen(false)
      return
    }

    if (!message || message.trim().length === 0) {
      alert('Please enter an introduction message')
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
        // Refresh the list to update (profiles with intro will still show, but user can see they've sent intro)
        // Optionally, you could filter them out client-side if needed
        setSelectedProfile(null)
      } else {
        console.error('Failed to send introduction:', result.error)
        alert(`Failed to send introduction: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error sending introduction:', error)
      alert('Failed to send introduction. Please try again.')
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
                    src={profile.avatarUrl}
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
                    src={selectedProfile.avatarUrl}
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
                  <button
                    className="btn primary"
                    onClick={handleSendIntro}
                    style={{ width: '100%', padding: '12px' }}
                  >
                    Send an Introduction
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
