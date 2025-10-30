import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

interface ConversationItem {
  id: string
  isLocked: boolean
  lastMessage: { content: string; createdAt: string } | null
  otherUser: { id: string; name: string; avatarUrl: string | null }
}

export default function Chat() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/conversations')
        const data = await res.json()
        if (data.success) setConversations(data.conversations)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <>
      <Head>
        <title>SITogether • Chat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container">
        <h1>Chats</h1>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <div className="chat-list">
            {conversations.map((c) => (
              <article
                key={c.id}
                className="chat-item"
                onClick={() => router.push(`/chat/${c.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <img
                  className="chat-avatar"
                  src={c.otherUser.avatarUrl || '/avatar.png'}
                  alt={`${c.otherUser.name} avatar`}
                />
                <div className="chat-body">
                  <div className="chat-head">
                    <h3>
                      {c.otherUser.name} {c.isLocked ? '🔒' : ''}
                    </h3>
                    <span className="time">
                      {c.lastMessage ? new Date(c.lastMessage.createdAt).toLocaleString() : ''}
                    </span>
                  </div>
                  <p className="last">{c.lastMessage ? c.lastMessage.content : 'Say hello!'}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
