import Head from 'next/head'
import { useRouter } from 'next/router'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { sanitizeForDisplay } from '../../utils/messageValidation'
import { fetchWithAuth } from '../../utils/api'
import ToastContainer from '../../components/ToastContainer'
import { useToast } from '../../hooks/useToast'

interface Message {
  content: string
  createdAt: string
  isMine: boolean
  isDeleted: boolean
}

interface Participant {
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
  const [reportedUserId, setReportedUserId] = useState<string | null>(null) // Add this
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const { toasts, showToast, removeToast } = useToast()

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
          // Add this to store reported user ID securely:
          if (data.reportedUserId) setReportedUserId(data.reportedUserId)
        }
      } finally {
        setLoading(false)
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    }
    load()
  }, [id])

  const onSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() || sending || !id || typeof id !== 'string') return

    // Client-side validation
    const { validateMessageContent } = await import('../../utils/messageValidation')
    const validation = validateMessageContent(text)
    if (!validation.isValid) {
      showToast(validation.error || 'Invalid message', 'error')
      return
    }

    setSending(true)
    try {
      const res = await fetchWithAuth(`/api/conversations/${id}/messages`, {
        method: 'POST',
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
        showToast(data.error || 'Invalid message', 'error')
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
      showToast('Please select a reason for reporting', 'warning')
      return
    }

    setIsSubmittingReport(true)
    try {
      const response = await fetchWithAuth('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportedId: reportedUserId, // Use stored ID instead of other.id
          reason: reportReason,
          description: reportDescription.trim() || null,
        }),
      })

      const result = await response.json()

      if (result.success) {
        showToast(
          'Report submitted successfully. Thank you for helping keep our community safe.',
          'success'
        )
        setShowReportModal(false)
        setReportReason('')
        setReportDescription('')
      } else {
        showToast(result.error || 'Failed to submit report', 'error')
      }
    } catch (error) {
      showToast('Failed to submit report. Please try again.', 'error')
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between', // pushes buttons to opposite ends
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <button className="btn ghost" onClick={() => router.push('/chat')}>
            ← Back
          </button>
          {!isLocked && (
            <button
              onClick={handleReportClick}
              title="Report user"
              disabled={isLocked}
              className="btn"
              style={{
                backgroundColor: 'var(--danger-color, #dc3545)', // red
                color: 'white',
                cursor: 'pointer',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              🚩 Report
            </button>
          )}
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <>
            {isLocked && (
              <div className="lock-banner">🔒 Chat is locked until you both like each other.</div>
            )}

            {/* Chat Header with Other User Info and Report Button */}
            {other && messages.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: 'var(--bg-color, #f8f9fa)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '1px solid var(--border-color, #e9ecef)',
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
                        backgroundColor: 'var(--placeholder-bg, #ddd)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '16px',
                        color: 'var(--placeholder-text, #666)',
                      }}
                    >
                      {(other.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 600,
                        color: 'var(--text-color, #333)',
                      }}
                    >
                      {other.name}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        color: 'var(--muted-text, #666)',
                      }}
                    >
                      Active conversation
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="chat-thread">
              {messages.map((m, index) => {
                // Use isMine from backend instead of senderId comparison
                const isMine = m.isMine
                const shouldBlur = isLocked && !isMine // Only blur the other user's info when locked

                // Handle deleted user case - backend should set isDeleted flag
                const isDeletedUser = m.isDeleted || false

                const displayName = shouldBlur
                  ? 'Hidden User'
                  : isDeletedUser
                    ? 'Deleted User'
                    : (isMine ? me?.name : other?.name) || 'User'
                const displayAvatarUrl =
                  shouldBlur || isDeletedUser ? null : isMine ? me?.avatarUrl : other?.avatarUrl

                return (
                  <div key={index} className={`chat-row ${isMine ? 'mine' : ''}`}>
                    {displayAvatarUrl ? (
                      <img
                        src={displayAvatarUrl}
                        alt={`${displayName} avatar`}
                        className={`chat-avatar-sm ${shouldBlur ? 'blurred' : ''}`}
                        onError={(e) => {
                          // Fallback if image fails to load - replace with placeholder
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            const placeholder = document.createElement('div')
                            placeholder.setAttribute('aria-label', `${displayName} avatar`)
                            placeholder.className = `chat-avatar-sm ${shouldBlur ? 'blurred' : ''}`
                            placeholder.style.cssText =
                              'background: #eee; color: #555; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;'
                            placeholder.textContent = displayName.charAt(0).toUpperCase()
                            parent.insertBefore(placeholder, target)
                          }
                        }}
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
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid var(--input-border, #ddd)',
                  backgroundColor: 'var(--input-bg, #fff)',
                  color: 'var(--input-text, #111827)',
                }}
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
                backgroundColor: 'var(--modal-bg, white)',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
                border: '1px solid var(--modal-border, transparent)',
                boxShadow: 'var(--modal-shadow, 0 10px 40px rgba(0, 0, 0, 0.2))',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: '20px',
                  color: 'var(--modal-title, #333)',
                }}
              >
                Report User
              </h2>
              <p
                style={{
                  marginBottom: '20px',
                  color: 'var(--modal-text, #666)',
                }}
              >
                Reporting:{' '}
                <strong style={{ color: 'var(--modal-text, #666)' }}>{other.name}</strong>
              </p>
              <p
                style={{
                  marginBottom: '20px',
                  color: 'var(--modal-text, #666)',
                }}
              >
                Please select a reason for reporting this user. All reports are reviewed by our
                moderation team.
              </p>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: 'var(--modal-label, #374151)',
                  }}
                >
                  Reason <span style={{ color: 'var(--danger-color, #dc3545)' }}>*</span>
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  disabled={isSubmittingReport}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid var(--input-border, #ddd)',
                    fontSize: '14px',
                    backgroundColor: 'var(--input-bg, #fff)',
                    color: 'var(--input-text, #111827)',
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
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: 'var(--modal-label, #374151)',
                  }}
                >
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
                    border: '1px solid var(--input-border, #ddd)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    backgroundColor: 'var(--input-bg, #fff)',
                    color: 'var(--input-text, #111827)',
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
                    backgroundColor: 'var(--secondary-color, #6c757d)',
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
                      isSubmittingReport || !reportReason.trim()
                        ? 'var(--disabled-color, #6c757d)'
                        : 'var(--danger-color, #dc3545)',
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
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  )
}
