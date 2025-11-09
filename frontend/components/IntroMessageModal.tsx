import React, { useState } from 'react'

interface IntroMessageModalProps {
  isOpen: boolean
  onCancel: () => void
  onSubmit: (message: string | null) => void
  required?: boolean
  submitButtonText?: string
}

export default function IntroMessageModal({
  isOpen,
  onCancel,
  onSubmit,
  required = false,
  submitButtonText = 'Send like',
}: IntroMessageModalProps) {
  const [message, setMessage] = useState('')

  if (!isOpen) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content">
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>
            {required ? 'Send an introduction' : 'Add an intro message (optional)'}
          </h3>
        </div>

        <p className="modal-description">Say hi and share why you want to connect.</p>

        <div className="modal-form">
          <div className="edit-form">
            <div className="form-group">
              <textarea
                value={message}
                onChange={(e) => {
                  // Prevent extremely long input
                  if (e.target.value.length <= 5000) {
                    setMessage(e.target.value)
                  }
                }}
                rows={5}
                placeholder="Write a friendly opener…"
                maxLength={5000}
                className="input"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => {
                if (required && message.trim().length === 0) {
                  return
                }
                onSubmit(message.trim().length > 0 ? message.trim() : null)
              }}
              disabled={required && message.trim().length === 0}
            >
              {submitButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
