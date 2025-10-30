import Head from 'next/head'
import { useRouter } from 'next/router'
import { FormEvent, useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  senderId: string
  content: string
  createdAt: string
}

interface Participant {
  id: string
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

  // Enrich avatars from profile API if missing
  useEffect(() => {
    const enrich = async () => {
      try {
        if (other && !other.avatarUrl) {
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
  }, [me, other])

  const onSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() || sending || !id || typeof id !== 'string') return
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
        <button className="btn ghost" onClick={() => router.push('/chat')} style={{ marginBottom: 12 }}>
          ← Back
        </button>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <>
            {isLocked && <div className="lock-banner">🔒 Chat is locked until you both like each other.</div>}

            <div className="chat-thread">
              {messages.map((m) => {
                const isMine = currentUserId && m.senderId === currentUserId
                const avatarUrl = isMine ? me?.avatarUrl : other?.avatarUrl
                const name = isMine ? me?.name : other?.name
                return (
                  <div key={m.id} className={`chat-row ${isMine ? 'mine' : ''}`}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={`${name || 'User'} avatar`} className="chat-avatar-sm" />
                    ) : (
                      <div aria-label={`${name || 'User'} avatar`} className="chat-avatar-sm" style={{ background: '#eee', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                        {(name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="chat-bubble-wrap">
                      <div className="chat-meta">{new Date(m.createdAt).toLocaleString()}</div>
                      <div className={`chat-bubble ${isMine ? 'mine' : ''}`}>{m.content}</div>
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
                onChange={(e) => setText(e.target.value)}
                placeholder={isLocked ? 'Chat is locked' : 'Type a message'}
                disabled={isLocked}
                style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ddd' }}
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


