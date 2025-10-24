import React from 'react'
import { Toast } from '../hooks/useToast'

interface ToastContainerProps {
  toasts: Toast[]
  removeToast: (id: number) => void
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast-content">
            <span className="toast-icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'warning' && '⚠'}
            </span>
            <span className="toast-message">{toast.message}</span>
          </div>
          <button className="toast-close" onClick={() => removeToast(toast.id)} aria-label="Close">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

export default ToastContainer
