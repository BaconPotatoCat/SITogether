import { useRef, useState } from 'react'
import Head from 'next/head'

interface Profile {
  id: number
  name: string
  age: number
  location: string
  interests: string[]
  bio: string
  avatarUrl: string
}

const DUMMY_PROFILES: Profile[] = [
  { id: 1, name: 'Kira Belle', age: 23, location: 'Neon District', interests: ['JRPGs', 'Cosplay', 'Karaoke'], bio: "JRPG marathons and karaoke nights. Press start to continue.", avatarUrl: 'https://images.unsplash.com/photo-1721440171951-26505bbe23cb?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687' },
  { id: 2, name: 'Aqua Nova', age: 21, location: 'Virtual Haven', interests: ['Singing', 'Gaming', 'ASMR'], bio: "Bubbly sea idol streaming cozy nights and rhythm games. Let's duet!", avatarUrl: 'https://images.unsplash.com/photo-1663035309414-07fe9174d7d6?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1936' },
  { id: 3, name: 'Star Lumi', age: 22, location: 'Starlight City', interests: ['Art', 'Zatsudan', 'Indie Music'], bio: "Comfy constellation painter. I draw, I chat, I vibe.", avatarUrl: 'https://images.unsplash.com/photo-1758207575528-6b80f80f4408?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687' },
  { id: 4, name: 'Miko-chan', age: 20, location: 'Cherry Lane', interests: ['Cooking', 'Slice of Life', 'Books'], bio: "Bento streams and book recs. Let's share snacks and stories.", avatarUrl: 'https://images.unsplash.com/flagged/photo-1572491259205-506c425b45c3?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1170' },
  { id: 5, name: 'Airi Sky', age: 24, location: 'Cloud Harbor', interests: ['FPS', 'Tech', 'Speedruns'], bio: "Cloud runner with crisp aim and comfy vibes.", avatarUrl: 'https://images.unsplash.com/photo-1727409048076-182d2907a59e?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=987' },
  { id: 6, name: 'Neko Mika', age: 19, location: 'Catnip Alley', interests: ['Cats', 'Crafts', 'Rhythm'], bio: "Crafting cute things to upbeat tracks. Nyah~", avatarUrl: 'https://images.unsplash.com/photo-1693240531477-bc6525187514?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687' },
]

export default function Home() {
  const [deck, setDeck] = useState<Profile[]>(DUMMY_PROFILES)

  // Gesture state
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false })
  const startRef = useRef<{ x: number; y: number } | null>(null)

  // Refs for dynamic geometry
  const deckRef = useRef<HTMLDivElement | null>(null)
  const nextRef = useRef<HTMLElement | null>(null)

  // Fade-out control when removing
  const [removing, setRemoving] = useState<null | 'like' | 'pass'>(null)

  const topCard = deck[0]
  const restCards = deck.slice(1)

  const resetDrag = () => setDrag({ x: 0, y: 0, active: false })

  const onLike = () => {
    if (!topCard) return
    setRemoving('like')
    setDrag((d) => ({ ...d, x: 500 }))
    setTimeout(() => {
      setDeck((prev) => prev.filter((p) => p.id !== topCard.id))
      setRemoving(null)
      resetDrag()
    }, 220)
  }

  const onPass = () => {
    if (!topCard) return
    setRemoving('pass')
    setDrag((d) => ({ ...d, x: -500 }))
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
          <div className="deck" ref={deckRef}>
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
                      <span className="location">{p.location}</span>
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
                    <span className="location">{topCard.location}</span>
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

          <div className="swipe-actions">
            <button className="btn ghost" onClick={onPass}>Pass</button>
            <button className="btn primary" onClick={onLike}>Like</button>
          </div>
        </section>
      </main>
    </>
  )
}
