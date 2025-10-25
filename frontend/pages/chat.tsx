import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

interface User {
  id: string
  name: string
  avatarUrl: string | null
}

interface Message {
  id: string
  content: string
  createdAt: string
  isIntroMessage?: boolean
  sender: User
  receiver: User
}

interface Conversation {
  id: string
  otherUser: User | null
  lastMessage: {
    content: string
    createdAt: string
    senderName: string
  } | null
  updatedAt: string
}

export default function Chat() {
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // For demo purposes, get the first user as current user
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

  // Fetch conversations when current user is set
  useEffect(() => {
    if (!currentUserId) return

    const fetchConversations = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/conversations?userId=${currentUserId}`)
        const data = await response.json()
        
        if (data.success) {
          setConversations(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch conversations:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()
  }, [currentUserId])

  // Fetch messages when a conversation is selected
  useEffect(() => {
    if (!selectedConversation) return

    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/messages?conversationId=${selectedConversation.id}`)
        const data = await response.json()
        
        if (data.success) {
          setMessages(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error)
      }
    }

    fetchMessages()
    
    // Poll for new messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [selectedConversation])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || !selectedConversation || !selectedConversation.otherUser || sending) {
      return
    }

    try {
      setSending(true)
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          senderId: currentUserId,
          receiverId: selectedConversation.otherUser.id,
          content: newMessage.trim()
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessages([...messages, data.data])
        setNewMessage('')
        
        // Update the conversation list
        const updatedConversations = conversations.map(conv => 
          conv.id === selectedConversation.id 
            ? { 
                ...conv, 
                lastMessage: {
                  content: newMessage.trim(),
                  createdAt: new Date().toISOString(),
                  senderName: 'You'
                },
                updatedAt: new Date().toISOString()
              }
            : conv
        )
        setConversations(updatedConversations)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString()
  }

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <>
        <Head>
          <title>SITogether • Chat</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <main className="container">
          <h1>Chats</h1>
          <p>Loading conversations...</p>
        </main>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>SITogether • Chat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="chat-container">
        <div className="chat-layout">
          {/* Conversations List */}
          <div className="conversations-panel">
            <div className="conversations-header">
              <h1>Chats</h1>
            </div>
            <div className="chat-list">
              {conversations.length === 0 ? (
                <div className="empty-state">
                  <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>💬</p>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>No conversations yet</p>
                  <p style={{ margin: '0', fontSize: '0.9rem' }}>Match with someone to start chatting!</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <article 
                    key={conv.id} 
                    className={`chat-item ${selectedConversation?.id === conv.id ? 'selected' : ''}`}
                    onClick={() => setSelectedConversation(conv)}
                    style={{ cursor: 'pointer' }}
                  >
                    <img 
                      className="chat-avatar" 
                      src={conv.otherUser?.avatarUrl || 'https://via.placeholder.com/56'} 
                      alt={`${conv.otherUser?.name || 'User'} avatar`} 
                    />
                    <div className="chat-body">
                      <div className="chat-head">
                        <h3>{conv.otherUser?.name || 'Unknown User'}</h3>
                        {conv.lastMessage && (
                          <span className="time">{formatTime(conv.lastMessage.createdAt)}</span>
                        )}
                      </div>
                      {conv.lastMessage ? (
                        <p className="last">{conv.lastMessage.content}</p>
                      ) : (
                        <p className="last" style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                          You matched! Say hi 👋
                        </p>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          {/* Messages Panel */}
          <div className="messages-panel">
            {selectedConversation ? (
              <>
                <div className="messages-header">
                  <img 
                    className="header-avatar" 
                    src={selectedConversation.otherUser?.avatarUrl || 'https://via.placeholder.com/40'} 
                    alt={`${selectedConversation.otherUser?.name} avatar`} 
                  />
                  <h2>{selectedConversation.otherUser?.name}</h2>
                </div>
                
                <div className="messages-list">
                  {messages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`message ${msg.sender.id === currentUserId ? 'sent' : 'received'}`}
                    >
                      <div className="message-bubble">
                        {msg.isIntroMessage && (
                          <div style={{
                            display: 'inline-block',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            color: msg.sender.id === currentUserId ? 'rgba(255, 255, 255, 0.8)' : '#6366f1',
                            backgroundColor: msg.sender.id === currentUserId ? 'rgba(255, 255, 255, 0.2)' : '#eef2ff',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            marginBottom: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            💌 Intro Message
                          </div>
                        )}
                        <p>{msg.content}</p>
                        <span className="message-time">{formatMessageTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form className="message-input-form" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    className="message-input"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sending}
                  />
                  <button 
                    type="submit" 
                    className="send-button"
                    disabled={!newMessage.trim() || sending}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </>
            ) : (
              <div className="no-conversation-selected">
                <p>Select a conversation to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
