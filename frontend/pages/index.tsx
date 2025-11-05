import { useRef, useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { fetchWithAuth } from '../utils/api'

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

export default function Home() {
  const router = useRouter()
  const [deck, setDeck] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Gesture state
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false })
  const startRef = useRef<{ x: number; y: number } | null>(null)

  // Refs for dynamic geometry
  const deckRef = useRef<HTMLDivElement | null>(null)
  const nextRef = useRef<HTMLElement | null>(null)

  // Fade-out control when removing
  const [removing, setRemoving] = useState<null | 'like' | 'pass'>(null)

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportingUserId, setReportingUserId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)

  // Fetch users from database on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)
        const response = await fetchWithAuth('/api/users')
        const result = await response.json()

        if (result.success) {
          setDeck(result.data)
          setError(null)
        } else {
          setError(result.error || 'Failed to fetch users')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users')
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const topCard = deck[0]
  const restCards = deck.slice(1)

  const resetDrag = () => setDrag({ x: 0, y: 0, active: false })

  const handleSwipeAction = async (
    endpoint: string,
    body: object,
    direction: number,
    actionType: 'like' | 'pass'
  ) => {
    if (!topCard) return

    try {
      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (result.success) {
        setRemoving(actionType)
        setDrag((d) => ({ ...d, x: direction }))
        setTimeout(() => {
          setDeck((prev) => prev.filter((p) => p.id !== topCard.id))
          setRemoving(null)
          resetDrag()
        }, 220)
      } else {
        console.error(`Failed to ${actionType} user:`, result.error)
        // Still remove card to prevent getting stuck
        setRemoving(actionType)
        setDrag((d) => ({ ...d, x: direction }))
        setTimeout(() => {
          setDeck((prev) => prev.filter((p) => p.id !== topCard.id))
          setRemoving(null)
          resetDrag()
        }, 220)
      }
    } catch (error) {
      console.error(`Error ${actionType}ing user:`, error)
      // Still remove card to prevent getting stuck
      setRemoving(actionType)
      setDrag((d) => ({ ...d, x: direction }))
      setTimeout(() => {
        setDeck((prev) => prev.filter((p) => p.id !== topCard.id))
        setRemoving(null)
        resetDrag()
      }, 220)
    }
  }

  const onLike = () => {
    if (!topCard) return
    handleSwipeAction('/api/likes', { likedId: topCard.id }, 500, 'like')
  }

  const onPass = () => handleSwipeAction('/api/passes', { passedId: topCard.id }, -500, 'pass')

  const handleReportClick = (userId: string) => {
    setReportingUserId(userId)
    setShowReportModal(true)
    setReportReason('')
    setReportDescription('')
  }

  const handleSubmitReport = async () => {
    if (!reportingUserId || !reportReason.trim()) {
      alert('Please select a reason for reporting')
      return
    }

    setIsSubmittingReport(true)
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reportedId: reportingUserId,
          reason: reportReason,
          description: reportDescription.trim() || null,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('Report submitted successfully. Thank you for helping keep our community safe.')
        setShowReportModal(false)
        setReportingUserId(null)
        setReportReason('')
        setReportDescription('')
      } else {
        alert(result.error || 'Failed to submit report')
      }
    } catch (error) {
      alert('Failed to submit report. Please try again.')
      console.error('Report error:', error)
    } finally {
      setIsSubmittingReport(false)
    }
  }

  const pointerDown = (clientX: number, clientY: number) => {
    startRef.current = { x: clientX, y: clientY }
    setDrag({ x: 0, y: 0, active: true })
  }

  const pointerMove = (clientX: number, clientY: number) => {
    if (!drag.active || !startRef.current) return
    const dx = clientX - startRef.current.x
    const dy = clientY - startRef.current.y
    setDrag((prev) => ({ ...prev, x: dx, y: dy }))
  }

  const pointerUp = () => {
    if (!drag.active) return

    // Dynamic threshold: trigger when the top card's center crosses beyond the next card's perimeter
    const deckRect = deckRef.current?.getBoundingClientRect()
    const nextRect = nextRef.current?.getBoundingClientRect()
    if (deckRect && nextRect) {
      const deckCenterX = deckRect.left + deckRect.width / 2
      const topCenterX = deckCenterX + drag.x
      if (topCenterX > nextRect.right) {
        onLike()
        return
      }
      if (topCenterX < nextRect.left) {
        onPass()
        return
      }
      resetDrag()
      return
    }

    // Fallback: pixel threshold
    const fallbackThreshold = 200
    if (drag.x > fallbackThreshold) {
      onLike()
    } else if (drag.x < -fallbackThreshold) {
      onPass()
    } else {
      resetDrag()
    }
  }

  // Smooth progress (0..1) based on distance required to reach the next card perimeter
  const easedProgress = () => {
    const deckRect = deckRef.current?.getBoundingClientRect()
    const nextRect = nextRef.current?.getBoundingClientRect()
    const deckCenterX = deckRect ? deckRect.left + deckRect.width / 2 : 0
    if (!deckRect || !nextRect) {
      const t = Math.min(1, Math.abs(drag.x) / 200)
      return t * t * (3 - 2 * t)
    }
    const needed = drag.x >= 0 ? nextRect.right - deckCenterX : deckCenterX - nextRect.left
    const t = Math.min(1, Math.abs(drag.x) / Math.max(1, needed))
    return t * t * (3 - 2 * t)
  }

  // Raw progress (0..1) for overlay intensity (no easing) relative to dynamic perimeter
  const overlayProgress = () => {
    const deckRect = deckRef.current?.getBoundingClientRect()
    const nextRect = nextRef.current?.getBoundingClientRect()
    const deckCenterX = deckRect ? deckRect.left + deckRect.width / 2 : 0
    if (!deckRect || !nextRect) return Math.min(1, Math.abs(drag.x) / 200)
    const needed = drag.x >= 0 ? nextRect.right - deckCenterX : deckCenterX - nextRect.left
    return Math.min(1, Math.abs(drag.x) / Math.max(1, needed))
  }

  return (
    <>
      <Head>
        <title>SITogether • Discover</title>
        <meta name="description" content="Discover new connections" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container">
        <section className="swipe-section">
          {loading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '400px',
                fontSize: '18px',
                color: '#666',
              }}
            >
              🔄 Loading profiles from database...
            </div>
          ) : error ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '400px',
                fontSize: '18px',
                color: '#dc3545',
                backgroundColor: '#f8d7da',
                border: '1px solid #f5c6cb',
                borderRadius: '8px',
                padding: '20px',
                margin: '20px',
              }}
            >
              ❌ Error loading profiles: {error}
            </div>
          ) : (
            <>
              <div className="deck" ref={deckRef}>
                <div>
                  {restCards.slice(0, 3).map((p, idx) => {
                    const baseOffset = (idx + 1) * 8
                    const baseScale = 1 - (idx + 1) * 0.02 // next: 0.98, then 0.96
                    const z = 20 - idx

                    const t = idx === 0 ? easedProgress() : 0
                    const lift = -t * 8 // smaller rise
                    const scaleUp = t * 0.02 // cap at +0.02 so next never exceeds 1.0
                    const translateY = baseOffset + lift
                    const scale = Math.min(1, baseScale + scaleUp)

                    return (
                      <article
                        key={p.id}
                        className="card stack"
                        ref={idx === 0 ? nextRef : undefined}
                        style={{
                          transform: `translateY(${translateY}px) scale(${scale})`,
                          zIndex: z,
                          transition: 'transform 180ms ease-out',
                        }}
                      >
                        <img
                          className="card-img"
                          src={p.avatarUrl}
                          alt={`${p.name} avatar`}
                          draggable={false}
                        />
                        <div className="card-info">
                          <div className="card-head">
                            <h3>
                              {p.name}, {p.age}, {p.gender}
                            </h3>
                            <span className="course">{p.course}</span>
                          </div>
                          <p className="bio">{p.bio}</p>
                          <div className="chips">
                            {p.interests.slice(0, 3).map((i) => (
                              <span key={i} className="chip">
                                {i}
                              </span>
                            ))}
                          </div>
                        </div>
                      </article>
                    )
                  })}

                  {topCard && (
                    <article
                      key={topCard.id}
                      className="card top"
                      style={{
                        transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x * 0.04}deg)`,
                        zIndex: 30,
                        opacity: removing ? 0 : 1,
                        transition: 'transform 220ms ease-out, opacity 220ms ease-out',
                      }}
                      onMouseDown={(e) => pointerDown(e.clientX, e.clientY)}
                      onMouseMove={(e) => pointerMove(e.clientX, e.clientY)}
                      onMouseUp={pointerUp}
                      onMouseLeave={pointerUp}
                      onTouchStart={(e) => pointerDown(e.touches[0].clientX, e.touches[0].clientY)}
                      onTouchMove={(e) => pointerMove(e.touches[0].clientX, e.touches[0].clientY)}
                      onTouchEnd={pointerUp}
                    >
                      <div
                        className="decision-overlay"
                        style={{
                          backgroundColor:
                            drag.x >= 0
                              ? 'rgba(16, 185, 129, ' + (overlayProgress() * 0.3).toFixed(3) + ')'
                              : 'rgba(239, 68, 68, ' + (overlayProgress() * 0.3).toFixed(3) + ')',
                        }}
                      >
                        <span
                          className="decision-text"
                          style={{
                            color: drag.x >= 0 ? '#10b981' : '#ef4444',
                            opacity: overlayProgress(),
                          }}
                        >
                          {drag.x >= 0 ? 'LIKE' : 'PASS'}
                        </span>
                      </div>
                      <img
                        className="card-img"
                        src={topCard.avatarUrl}
                        alt={`${topCard.name} avatar`}
                        draggable={false}
                      />
                      <div className="card-info">
                        <div className="card-head">
                          <h3>
                            {topCard.name}, {topCard.age}, {topCard.gender}
                          </h3>
                          <span className="course">{topCard.course}</span>
                        </div>
                        <p className="bio">{topCard.bio}</p>
                        <div className="chips">
                          {topCard.interests.map((i) => (
                            <span key={i} className="chip">
                              {i}
                            </span>
                          ))}
                        </div>
                        {/* Action Buttons */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '10px',
                            marginTop: '15px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <button
                            className="card-view-profile"
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              router.push(`/profile/${topCard.id}`)
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            title="View full profile"
                            type="button"
                          >
                            View Profile
                          </button>
                        </div>
                      </div>
                    </article>
                  )}

                  <div
                    aria-hidden={deck.length > 0}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 0,
                      opacity: deck.length === 0 ? 1 : 0,
                      transition: 'opacity 200ms ease-out',
                      pointerEvents: 'none',
                    }}
                  >
                    <p className="muted">
                      You&apos;re all caught up. Check back later for more profiles.
                    </p>
                  </div>
                </div>
              </div>

              <div className="swipe-actions">
                <button className="btn ghost" onClick={onPass}>
                  Pass
                </button>
                <button className="btn primary" onClick={onLike}>
                  Like
                </button>
                <button
                  className="btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    if (topCard) {
                      handleReportClick(topCard.id)
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  title="Report user"
                  type="button"
                  style={{
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#c82333'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc3545'
                  }}
                >
                  🚩 Report
                </button>
              </div>
            </>
          )}
        </section>

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
              zIndex: 1000,
            }}
            onClick={() => {
              if (!isSubmittingReport) {
                setShowReportModal(false)
                setReportingUserId(null)
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
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Reason <span style={{ color: '#dc3545' }}>*</span>
                </label>
                <select
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
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Additional Details (Optional)
                </label>
                <textarea
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
                      setReportingUserId(null)
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
      </main>
    </>
  )
}
