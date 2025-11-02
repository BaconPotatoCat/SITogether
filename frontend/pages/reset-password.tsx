import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

export default function ResetPassword() {
  const router = useRouter()
  const { token } = router.query
  const [isLoading, setIsLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [isReady, setIsReady] = useState(false)
  const { toasts, showToast, removeToast } = useToast()
  const hasShownToast = useRef(false)
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    // Check if token exists in URL once router is ready
    if (router.isReady) {
      setIsReady(true)
      if (!token && !hasShownToast.current) {
        showToast('Invalid password reset link', 'error')
        hasShownToast.current = true
      }
    }
  }, [router.isReady, token, showToast])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Real-time password validation
    if (name === 'newPassword' || name === 'confirmPassword') {
      const newPassword = name === 'newPassword' ? value : formData.newPassword
      const confirmPassword = name === 'confirmPassword' ? value : formData.confirmPassword

      if (confirmPassword && newPassword !== confirmPassword) {
        setPasswordError('Passwords do not match')
      } else {
        setPasswordError('')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }

    // Validate password length
    if (formData.newPassword.length < 6) {
      showToast('Password must be at least 6 characters long', 'error')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: formData.newPassword,
        }),
      })

      const result = await response.json()

      if (result.success) {
        showToast('Password reset successful! Redirecting to login...', 'success')

        // Clear form
        setFormData({
          newPassword: '',
          confirmPassword: '',
        })

        // Redirect to login after a brief delay
        setTimeout(() => {
          router.push('/auth')
        }, 2000)
      } else {
        showToast(result.error || 'Failed to reset password', 'error')

        // If token is invalid/expired, give option to request new one
        if (result.error?.includes('expired') || result.error?.includes('Invalid')) {
          setTimeout(() => {
            showToast('Please request a new password reset link', 'warning')
          }, 2000)
        }
      }
    } catch (error) {
      console.error('Reset password error:', error)
      showToast('An error occurred. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading state while router is initializing
  if (!isReady) {
    return (
      <>
        <Head>
          <title>SITogether • Reset Password</title>
          <meta name="description" content="Reset your password" />
        </Head>
        <main className="container">
          <div className="auth-container">
            <div className="auth-card">
              <div className="auth-header">
                <h1>Reset Password</h1>
                <p>Loading...</p>
              </div>
            </div>
          </div>
        </main>
      </>
    )
  }

  // Show error if no token in URL
  if (!token) {
    return (
      <>
        <Head>
          <title>SITogether • Invalid Link</title>
          <meta name="description" content="Invalid password reset link" />
        </Head>
        <main className="container">
          <div className="auth-container">
            <div className="auth-card">
              <div className="auth-header">
                <h1>Invalid Link</h1>
                <p>This password reset link is invalid or has expired.</p>
              </div>
              <div style={{ padding: '0 2rem 2rem' }}>
                <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                  Please request a new password reset link from the login page.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/auth')}
                  className="btn primary"
                  style={{ width: '100%' }}
                >
                  Go to Login
                </button>
              </div>
            </div>
          </div>
        </main>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </>
    )
  }

  return (
    <>
      <Head>
        <title>SITogether • Reset Password</title>
        <meta name="description" content="Reset your password" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <h1>Reset Your Password</h1>
              <p>Enter your new password below</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your new password"
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  placeholder="Confirm your new password"
                  minLength={6}
                  className={passwordError ? 'input-error' : ''}
                />
                {passwordError && <span className="error-message">{passwordError}</span>}
              </div>

              <button
                type="submit"
                className="btn primary auth-submit"
                disabled={isLoading || !!passwordError}
              >
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                Remember your password?
                <button type="button" onClick={() => router.push('/auth')} className="auth-toggle">
                  Sign in
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  )
}
