import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { sanitizeForDisplay } from '../utils/messageValidation'

interface ConversationItem {
  id: string
  isLocked: boolean
  isDeleted: boolean
  lastMessage: { content: string; createdAt: string } | null
  otherUser: { name: string; avatarUrl: string | null }
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
        ) : conversations.length === 0 ? (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">💬</div>
            <h2>No chats yet</h2>
            <p>Start swiping to find matches and begin chatting!</p>
          </div>
        ) : (
          <div className="chat-list">
            {conversations.map((c) => (
              <article
                key={c.id}
                className="chat-item"
                onClick={() => router.push(`/chat/${c.id}`)}
                style={{ cursor: 'pointer' }}
              >
                {c.otherUser.avatarUrl && !c.isLocked && c.otherUser.name !== 'Deleted User' ? (
                  <img
                    className="chat-avatar"
                    src={c.otherUser.avatarUrl}
                    alt={`${c.otherUser.name} avatar`}
                    onError={(e) => {
                      // Hide image and show placeholder instead
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent) {
                        const placeholder = document.createElement('div')
                        placeholder.className = `chat-avatar ${c.isLocked ? 'blurred' : ''}`
                        placeholder.style.cssText =
                          'background: #eee; color: #555; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px;'
                        placeholder.textContent = c.otherUser.name.charAt(0).toUpperCase()
                        parent.insertBefore(placeholder, target)
                      }
                    }}
                  />
                ) : (
                  <div
                    className={`chat-avatar ${c.isLocked ? 'blurred' : ''}`}
                    style={{
                      background: c.isLocked ? '#ccc' : '#eee',
                      color: c.isLocked ? '#999' : '#555',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 20,
                    }}
                  >
                    {c.otherUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="chat-body">
                  <div className="chat-head">
                  <h3>
                      {c.isDeleted ? 'Deleted User' : c.isLocked ? 'Hidden User' : c.otherUser.name} {c.isLocked && !c.isDeleted ? '🔒' : ''}
                    </h3>
                    <span className="time">
                      {c.lastMessage ? new Date(c.lastMessage.createdAt).toLocaleString() : ''}
                    </span>
                  </div>
                  <p
                    className="last"
                    dangerouslySetInnerHTML={{
                      __html: c.lastMessage
                        ? sanitizeForDisplay(c.lastMessage.content)
                        : 'Say hello!',
                    }}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
