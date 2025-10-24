import { useState } from 'react'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning'
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'error') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])

    // Auto remove toast after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 5000)
  }

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  return { toasts, showToast, removeToast }
}
