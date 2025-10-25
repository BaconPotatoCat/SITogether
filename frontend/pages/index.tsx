import { useRef, useState, useEffect } from 'react'
import Head from 'next/head'

interface Profile {
  id: string
  name: string
  age: number
  course: string
  interests: string[]
  bio: string
  avatarUrl: string
}

export default function Home() {
  const [deck, setDeck] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [matchNotification, setMatchNotification] = useState<string | null>(null)

  // Intro message modal state
  const [showIntroModal, setShowIntroModal] = useState(false)
  const [introMessage, setIntroMessage] = useState('')

  // Gesture state
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false })
  const startRef = useRef<{ x: number; y: number } | null>(null)

  // Health check state
  const [healthCheckResult, setHealthCheckResult] = useState<string | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)

  // Refs for dynamic geometry
  const deckRef = useRef<HTMLDivElement | null>(null)
  const nextRef = useRef<HTMLElement | null>(null)

  // Fade-out control when removing
  const [removing, setRemoving] = useState<null | 'like' | 'pass'>(null)

  // Get current user (for demo purposes, get the first user)
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/users')
        const data = await response.json()
        
        if (data.success && data.data.length > 0) {
          setCurrentUserId(data.data[0].id)
        }
      } catch (error) {
        console.error('Failed to fetch current user:', error)
      }
    }
    
    fetchCurrentUser()
  }, [])

  // Fetch users from database on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/users')
        const result = await response.json()
        
        if (result.success) {
          // Filter out the current user from the deck
          const filteredUsers = currentUserId 
            ? result.data.filter((user: Profile) => user.id !== currentUserId)
            : result.data
          setDeck(filteredUsers)
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

    if (currentUserId) {
      fetchUsers()
    }
  }, [currentUserId])

  const topCard = deck[0]
  const restCards = deck.slice(1)

  const resetDrag = () => setDrag({ x: 0, y: 0, active: false })

  const showIntroMessageModal = () => {
    setShowIntroModal(true)
  }

  const sendLike = async (withIntroMessage: string = '') => {
    if (!topCard || !currentUserId) return
    setRemoving('like')
    setDrag((d) => ({ ...d, x: 500 }))
    
    // Send match request with optional intro message
    try {
      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId1: currentUserId,
          userId2: topCard.id,
          action: 'like',
          introMessage: withIntroMessage || undefined
        })
      })

      const data = await response.json()

      if (data.success && data.isNewMatch) {
        // Show match notification
        setMatchNotification(`🎉 It's a Match with ${topCard.name}!`)
        setTimeout(() => setMatchNotification(null), 5000)
      }
    } catch (error) {
      console.error('Failed to create match:', error)
    }

    setTimeout(() => {
      setDeck((prev) => prev.filter((p) => p.id !== topCard.id))
      setRemoving(null)
      resetDrag()
      setShowIntroModal(false)
      setIntroMessage('')
    }, 220)
  }

  const onLike = () => {
    if (!topCard || !currentUserId) return
    // Show intro message modal
    showIntroMessageModal()
  }

  const handleSendWithIntro = () => {
    sendLike(introMessage)
  }

  const handleSendWithoutIntro = () => {
    setShowIntroModal(false)
    setIntroMessage('')
    sendLike()
  }

  const onPass = async () => {
    if (!topCard || !currentUserId) return
    setRemoving('pass')
    setDrag((d) => ({ ...d, x: -500 }))
    
    // Send match request with pass action
    try {
      await fetch('/api/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId1: currentUserId,
          userId2: topCard.id,
          action: 'pass'
        })
      })
    } catch (error) {
      console.error('Failed to record pass:', error)
    }

    setTimeout(() => {
      setDeck((prev) => prev.filter((p) => p.id !== topCard.id))
      setRemoving(null)
      resetDrag()
    }, 220)
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
    const needed = drag.x >= 0 ? (nextRect.right - deckCenterX) : (deckCenterX - nextRect.left)
    const t = Math.min(1, Math.abs(drag.x) / Math.max(1, needed))
    return t * t * (3 - 2 * t)
  }

  // Raw progress (0..1) for overlay intensity (no easing) relative to dynamic perimeter
  const overlayProgress = () => {
    const deckRect = deckRef.current?.getBoundingClientRect()
    const nextRect = nextRef.current?.getBoundingClientRect()
    const deckCenterX = deckRect ? deckRect.left + deckRect.width / 2 : 0
    if (!deckRect || !nextRect) return Math.min(1, Math.abs(drag.x) / 200)
    const needed = drag.x >= 0 ? (nextRect.right - deckCenterX) : (deckCenterX - nextRect.left)
    return Math.min(1, Math.abs(drag.x) / Math.max(1, needed))
  }

  const likeActive = () => {
    const deckRect = deckRef.current?.getBoundingClientRect()
    const nextRect = nextRef.current?.getBoundingClientRect()
    if (!deckRect || !nextRect) return drag.x > 200
    const deckCenterX = deckRect.left + deckRect.width / 2
    return deckCenterX + drag.x > nextRect.right
  }

  const passActive = () => {
    const deckRect = deckRef.current?.getBoundingClientRect()
    const nextRect = nextRef.current?.getBoundingClientRect()
    if (!deckRect || !nextRect) return drag.x < -200
    const deckCenterX = deckRect.left + deckRect.width / 2
    return deckCenterX + drag.x < nextRect.left
  }

  // Health check function - now calls frontend API route which proxies to backend
  const checkBackendHealth = async () => {
    setIsCheckingHealth(true)
    setHealthCheckResult(null)
    
    try {
      // Call the frontend API route which will proxy the request to the backend container
      const response = await fetch('/api/health')
      const result = await response.json()
      
      if (result.success) {
        const data = result.data
        setHealthCheckResult(`✅ Backend is healthy!\nStatus: ${data.status}\nUptime: ${Math.round(data.uptime)}s\nTimestamp: ${data.timestamp}\n\n🔗 Request made by: Frontend Container → Backend Container`)
      } else {
        setHealthCheckResult(`❌ ${result.error}\n\n🔗 Request made by: Frontend Container → Backend Container`)
      }
    } catch (error) {
      setHealthCheckResult(`❌ Failed to connect to backend: ${error instanceof Error ? error.message : 'Unknown error'}\n\n🔗 Request made by: Frontend Container → Backend Container`)
    } finally {
      setIsCheckingHealth(false)
    }
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
        {/* Match notification */}
        {matchNotification && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: '#10b981',
            color: 'white',
            padding: '16px 32px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            fontSize: '18px',
            fontWeight: '600',
            animation: 'slideDown 0.3s ease-out'
          }}>
            {matchNotification}
          </div>
        )}

        {/* Temporary Health Check Section */}
        <section style={{ 
          padding: '20px', 
          marginBottom: '20px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <h2 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#333' }}>
            🔧 Backend Health Check (Temporary)
          </h2>
          <button 
            onClick={checkBackendHealth}
            disabled={isCheckingHealth}
            style={{
              padding: '10px 20px',
              backgroundColor: isCheckingHealth ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isCheckingHealth ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              marginBottom: '15px'
            }}
          >
            {isCheckingHealth ? '🔄 Checking...' : '🏥 Check Backend Health'}
          </button>
          
          {healthCheckResult && (
            <div style={{
              padding: '15px',
              backgroundColor: healthCheckResult.includes('✅') ? '#d4edda' : '#f8d7da',
              border: `1px solid ${healthCheckResult.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
              borderRadius: '4px',
              color: healthCheckResult.includes('✅') ? '#155724' : '#721c24',
              fontFamily: 'monospace',
              fontSize: '12px',
              whiteSpace: 'pre-line'
            }}>
              {healthCheckResult}
            </div>
          )}
        </section>

        <section className="swipe-section">
          {loading ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '400px',
              fontSize: '18px',
              color: '#666'
            }}>
              🔄 Loading profiles from database...
            </div>
          ) : error ? (
            <div style={{
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
              margin: '20px'
            }}>
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
                        style={{ transform: `translateY(${translateY}px) scale(${scale})`, zIndex: z, transition: 'transform 180ms ease-out' }}
                      >
                        <img className="card-img" src={p.avatarUrl} alt={`${p.name} avatar`} draggable={false} />
                        <div className="card-info">
                          <div className="card-head">
                            <h3>{p.name}, {p.age}</h3>
                            <span className="course">{p.course}</span>
                          </div>
                          <p className="bio">{p.bio}</p>
                          <div className="chips">
                            {p.interests.slice(0, 3).map((i) => (
                              <span key={i} className="chip">{i}</span>
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
                      style={{ transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x * 0.04}deg)`, zIndex: 30, opacity: removing ? 0 : 1, transition: 'transform 220ms ease-out, opacity 220ms ease-out' }}
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
                      <img className="card-img" src={topCard.avatarUrl} alt={`${topCard.name} avatar`} draggable={false} />
                      <div className="card-info">
                        <div className="card-head">
                          <h3>{topCard.name}, {topCard.age}</h3>
                          <span className="course">{topCard.course}</span>
                        </div>
                        <p className="bio">{topCard.bio}</p>
                        <div className="chips">
                          {topCard.interests.map((i) => (
                            <span key={i} className="chip">{i}</span>
                          ))}
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
                    <p className="muted">You're all caught up. Check back later for more profiles.</p>
                  </div>
                </div>
              </div>

              <div className="swipe-actions">
                <button className="btn ghost" onClick={onPass}>Pass</button>
                <button className="btn primary" onClick={onLike}>Like</button>
              </div>
            </>
          )}
        </section>

        {/* Intro Message Modal */}
        {showIntroModal && topCard && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)'
            }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#111827' }}>
                Send an intro to {topCard.name}?
              </h2>
              <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: '0.95rem' }}>
                Your message will be revealed when they like you back! 
              </p>

              <textarea
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                placeholder="Hi! I'd love to connect because..."
                maxLength={200}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  marginBottom: '12px'
                }}
              />
              <div style={{ 
                textAlign: 'right', 
                fontSize: '0.85rem', 
                color: '#9ca3af',
                marginBottom: '20px' 
              }}>
                {introMessage.length}/200
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                flexDirection: 'column'
              }}>
                <button
                  onClick={handleSendWithIntro}
                  disabled={!introMessage.trim()}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: introMessage.trim() ? '#6366f1' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: introMessage.trim() ? 'pointer' : 'not-allowed',
                    transition: 'background-color 0.2s'
                  }}
                >
                  Send with intro message
                </button>
                <button
                  onClick={handleSendWithoutIntro}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'white',
                    color: '#6366f1',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  Like without message
                </button>
                <button
                  onClick={() => {
                    setShowIntroModal(false)
                    setIntroMessage('')
                    resetDrag()
                  }}
                  style={{
                    padding: '8px 24px',
                    backgroundColor: 'transparent',
                    color: '#9ca3af',
                    border: 'none',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
