import Head from 'next/head'
import { useRouter } from 'next/router'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { sanitizeForDisplay } from '../../utils/messageValidation'

interface Message {
  id: string
  senderId: string
  content: string
  createdAt: string
}

interface Participant {
  id?: string
  name: string
  avatarUrl: string | null
}

export default function ConversationPage() {
  const router = useRouter()
  const { id } = router.query
  const [messages, setMessages] = useState<Message[]>([])
  const [isLocked, setIsLocked] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)
  const [me, setMe] = useState<Participant | null>(null)
  const [other, setOther] = useState<Participant | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!id || typeof id !== 'string') return
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/conversations/${id}/messages`)
        const data = await res.json()
        if (data.success) {
          setMessages(data.messages)
          setIsLocked(!!data.isLocked)
          if (data.participants) {
            setMe(data.participants.me)
            setOther(data.participants.other)
          }
          if (data.currentUserId) setCurrentUserId(data.currentUserId)
        }
      } finally {
        setLoading(false)
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    }
    load()
  }, [id])

  // Enrich avatars from profile API if missing (only if conversation is unlocked)
  useEffect(() => {
    if (isLocked) return // Don't enrich when locked to preserve privacy
    const enrich = async () => {
      try {
        if (other && !other.avatarUrl && other.id) {
          const res = await fetch(`/api/users/${other.id}`)
          const data = await res.json()
          if (data?.success && data?.user?.avatarUrl) {
            setOther({ ...other, avatarUrl: data.user.avatarUrl })
          }
        }
        if (me && !me.avatarUrl) {
          const res = await fetch(`/api/users/${me.id}`)
          const data = await res.json()
          if (data?.success && data?.user?.avatarUrl) {
            setMe({ ...me, avatarUrl: data.user.avatarUrl })
          }
        }
      } catch {}
    }
    enrich()
  }, [me, other, isLocked])

  const onSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() || sending || !id || typeof id !== 'string') return

    // Client-side validation
    const { validateMessageContent } = await import('../../utils/messageValidation')
    const validation = validateMessageContent(text)
    if (!validation.isValid) {
      alert(validation.error || 'Invalid message')
      return
    }

    setSending(true)
    try {
      const res = await fetch(`/api/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.trim() }),
      })
      const data = await res.json()
      if (res.status === 423) {
        // locked
        setIsLocked(true)
        return
      }
      if (res.status === 400) {
        // Validation error from backend
        alert(data.error || 'Invalid message')
        return
      }
      if (data.success) {
        setMessages((prev) => [...prev, data.message])
        setText('')
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 10)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Head>
        <title>SITogether • Conversation</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="container" style={{ maxWidth: 720 }}>
        <button
          className="btn ghost"
          onClick={() => router.push('/chat')}
          style={{ marginBottom: 12 }}
        >
          ← Back
        </button>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <>
            {isLocked && (
              <div className="lock-banner">🔒 Chat is locked until you both like each other.</div>
            )}

            <div className="chat-thread">
              {messages.map((m) => {
                const isMine = currentUserId && m.senderId === currentUserId
                const shouldBlur = isLocked && !isMine // Only blur the other user's info when locked
                // Always use "Hidden User" when locked to prevent any name leakage
                const displayName = shouldBlur
                  ? 'Hidden User'
                  : (isMine ? me?.name : other?.name) || 'User'
                const displayAvatarUrl = shouldBlur
                  ? null
                  : isMine
                    ? me?.avatarUrl
                    : other?.avatarUrl
                return (
                  <div key={m.id} className={`chat-row ${isMine ? 'mine' : ''}`}>
                    {displayAvatarUrl ? (
                      <img
                        src={displayAvatarUrl}
                        alt={`${displayName} avatar`}
                        className={`chat-avatar-sm ${shouldBlur ? 'blurred' : ''}`}
                      />
                    ) : (
                      <div
                        aria-label={`${displayName} avatar`}
                        className={`chat-avatar-sm ${shouldBlur ? 'blurred' : ''}`}
                        style={{
                          background: shouldBlur ? '#ccc' : '#eee',
                          color: shouldBlur ? '#999' : '#555',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="chat-bubble-wrap">
                      <div className="chat-meta">{new Date(m.createdAt).toLocaleString()}</div>
                      <div
                        className={`chat-bubble ${isMine ? 'mine' : ''}`}
                        dangerouslySetInnerHTML={{
                          __html: sanitizeForDisplay(m.content),
                        }}
                      />
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            <form onSubmit={onSend} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                type="text"
                value={text}
                onChange={(e) => {
                  // Prevent extremely long input
                  if (e.target.value.length <= 5000) {
                    setText(e.target.value)
                  }
                }}
                placeholder={isLocked ? 'Chat is locked' : 'Type a message'}
                disabled={isLocked}
                style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ddd' }}
                maxLength={5000}
              />
              <button className="btn" type="submit" disabled={isLocked || sending || !text.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </main>
    </>
  )
}
