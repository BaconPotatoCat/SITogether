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
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)

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

  const handleReportClick = () => {
    if (!other) return
    setShowReportModal(true)
    setReportReason('')
    setReportDescription('')
  }

  const handleSubmitReport = async () => {
    if (!other || !reportReason.trim()) {
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
          reportedId: other.id,
          reason: reportReason,
          description: reportDescription.trim() || null,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('Report submitted successfully. Thank you for helping keep our community safe.')
        setShowReportModal(false)
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

            {/* Chat Header with Other User Info and Report Button */}
            {!loading && other && messages.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '1px solid #e9ecef',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {other.avatarUrl ? (
                    <img
                      src={other.avatarUrl}
                      alt={`${other.name} avatar`}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#ddd',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '16px',
                        color: '#666',
                      }}
                    >
                      {(other.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{other.name}</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                      Active conversation
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReportClick}
                  title="Report user"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  🚩 Report
                </button>
              </div>
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

        {/* Report Modal */}
        {showReportModal && other && (
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
                Reporting: <strong>{other.name}</strong>
              </p>
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
