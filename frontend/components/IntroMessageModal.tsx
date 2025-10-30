import React, { useState } from 'react'

interface IntroMessageModalProps {
  isOpen: boolean
  onCancel: () => void
  onSubmit: (message: string | null) => void
}

export default function IntroMessageModal({ isOpen, onCancel, onSubmit }: IntroMessageModalProps) {
  const [message, setMessage] = useState('')

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          width: 'min(480px, 92vw)',
          padding: 20,
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Add an intro message (optional)</h3>
        <p style={{ marginTop: 0, marginBottom: 12, color: '#555' }}>
          Say hi and share why you want to connect.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="Write a friendly opener…"
          style={{
            width: '100%',
            resize: 'vertical',
            fontSize: 14,
            padding: 10,
            border: '1px solid #e1e1e1',
            borderRadius: 6,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, gap: 8 }}>
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={() => onSubmit(message.trim().length > 0 ? message.trim() : null)}
          >
            Send like
          </button>
        </div>
      </div>
    </div>
  )
}
