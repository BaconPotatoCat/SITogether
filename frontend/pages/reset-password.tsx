import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ResetPassword() {
  const router = useRouter()
  const { token } = router.query

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value
    setPassword(newPassword)

    // Real-time validation
    if (newPassword.length > 0 && newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long')
    } else if (confirmPassword && newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
    } else {
      setPasswordError('')
    }
  }

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newConfirmPassword = e.target.value
    setConfirmPassword(newConfirmPassword)

    // Real-time validation
    if (password && newConfirmPassword !== password) {
      setPasswordError('Passwords do not match')
    } else {
      setPasswordError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate password
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters long')
      return
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    if (!token || typeof token !== 'string') {
      setStatus('error')
      setMessage('Invalid reset token. Please check your email link.')
      return
    }

    setIsLoading(true)
    setPasswordError('')
    setStatus('idle')

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setStatus('success')
        setMessage(data.message || 'Password reset successfully! You can now log in with your new password.')
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/auth')
        }, 3000)
      } else {
        setStatus('error')
        setMessage(data.error || 'Failed to reset password. Please try again.')
      }
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Reset Password - SITogether</title>
      </Head>
      <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Reset Password</h1>

        {status === 'success' && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#d1fae5',
              color: '#065f46',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            {message}
          </div>
        )}

        {status === 'error' && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            {message}
          </div>
        )}

        {!token && status === 'idle' && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            Invalid reset link. Please check your email for the correct reset password link.
          </div>
        )}

        {token && status !== 'success' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                minLength={6}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}
              >
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                minLength={6}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '1rem',
                }}
              />
            </div>

            {passwordError && (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                }}
              >
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !!passwordError}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: isLoading || passwordError ? '#9ca3af' : '#3730a3',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: isLoading || passwordError ? 'not-allowed' : 'pointer',
                marginTop: '0.5rem',
              }}
            >
              {isLoading ? <LoadingSpinner message="Resetting password..." /> : 'Reset Password'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link href="/auth" style={{ color: '#3730a3', textDecoration: 'underline' }}>
            Back to Login
          </Link>
        </div>
      </div>
    </>
  )
}

