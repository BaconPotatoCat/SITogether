import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useSession } from '../contexts/AuthContext'

export default function Verify2FA() {
  const router = useRouter()
  const { refreshSession } = useSession()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [isChecking, setIsChecking] = useState(true)
  const { toasts, showToast, removeToast } = useToast()
  const [tempToken, setTempToken] = useState<string | null>(null)
  const hasCheckedRef = useRef(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Prevent double execution with ref (survives React.StrictMode double-render)
    if (hasCheckedRef.current) {
      return
    }
    hasCheckedRef.current = true

    // Retrieve tempToken from sessionStorage
    const token = sessionStorage.getItem('tempToken')
    if (!token) {
      // No tempToken means user navigated here incorrectly
      showToast('Please log in first', 'error')
      setTimeout(() => {
        router.push('/auth')
      }, 3000)
      return
      // Don't set isChecking to false - keeps loading spinner showing
    }
    setTempToken(token)
    setIsChecking(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value

    // Only allow single digit
    if (/^\d?$/.test(value)) {
      const newCode = [...code]
      newCode[index] = value
      setCode(newCode)

      // Auto-focus next input if a digit was entered
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    // Handle arrow keys
    else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
    // Handle paste
    else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        if (/^\d{6}$/.test(text)) {
          const digits = text.split('')
          setCode(digits)
          // Focus the last input after paste
          setTimeout(() => {
            inputRefs.current[5]?.focus()
          }, 0)
        }
      })
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text')
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('')
      setCode(digits)
      // Focus the last input after paste
      setTimeout(() => {
        inputRefs.current[5]?.focus()
      }, 0)
    }
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select all text when focusing
    e.target.select()
  }

  const handleResend = async () => {
    if (!tempToken) {
      showToast('Session expired. Please log in again.', 'error')
      setTimeout(() => {
        router.push('/auth')
      }, 1000)
      return
    }

    if (resendCooldown > 0) {
      return
    }

    setIsResending(true)

    try {
      const response = await fetch('/api/auth/resend-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tempToken,
        }),
      })

      const result = await response.json()

      if (result.success) {
        showToast('Verification code resent successfully!', 'success')
        setResendCooldown(60) // 60 second cooldown
        // Clear the code inputs
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      } else {
        showToast(result.error || 'Failed to resend code', 'error')
      }
    } catch (error) {
      console.error('Resend 2FA error:', error)
      showToast('An error occurred. Please try again.', 'error')
    } finally {
      setIsResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tempToken) {
      showToast('Session expired. Please log in again.', 'error')
      setTimeout(() => {
        router.push('/auth')
      }, 1000)
      return
    }

    const fullCode = code.join('')
    if (fullCode.length !== 6) {
      showToast('Please enter a valid 6-digit code', 'error')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tempToken,
          code: fullCode,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Clear tempToken from sessionStorage
        sessionStorage.removeItem('tempToken')
        showToast('Login successful!', 'success')
        // Refresh session to update AuthContext before redirecting
        await refreshSession()
        // Use window.location for a full page reload to ensure session is properly loaded
        setTimeout(() => {
          window.location.href = '/'
        }, 500)
      } else {
        showToast(result.error || 'Invalid verification code', 'error')
        setCode(['', '', '', '', '', ''])
        // Focus back on first input
        inputRefs.current[0]?.focus()
      }
    } catch (error) {
      console.error('2FA verification error:', error)
      showToast('An error occurred. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Verify Code - SITogether</title>
        <meta name="description" content="Enter your verification code" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="verify-2fa-container">
        <div className="verify-2fa-card">
          {isChecking ? (
            <>
              <div className="spinner" />
              <h1>Loading...</h1>
            </>
          ) : (
            <>
              <h1>Verify Your Identity</h1>
              <p className="subtitle">
                We&apos;ve sent a 6-digit verification code to your email. Please enter it below to
                complete your login.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="code-input-container">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(e, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      onPaste={handlePaste}
                      onFocus={handleFocus}
                      className="code-input"
                      autoFocus={index === 0}
                      disabled={isLoading}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading || code.join('').length !== 6}
                >
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </button>
              </form>
              <button onClick={() => router.push('/auth')} className="btn-secondary">
                Cancel
              </button>
              <div className="resend-container">
                <p className="resend-text">Didn&apos;t receive the code?</p>
                <button
                  onClick={handleResend}
                  className="btn-resend"
                  disabled={isResending || resendCooldown > 0 || isLoading}
                >
                  {isResending
                    ? 'Sending...'
                    : resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : 'Resend Code'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <style jsx>{`
        .verify-2fa-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .verify-2fa-card {
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 450px;
          width: 100%;
          text-align: center;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 30px;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        h1 {
          color: #333;
          font-size: 28px;
          margin-bottom: 10px;
          font-weight: 600;
        }

        .subtitle {
          color: #666;
          font-size: 14px;
          margin-bottom: 30px;
          font-weight: 500;
        }

        .code-input-container {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 20px;
        }

        .code-input {
          width: 50px;
          height: 60px;
          padding: 0;
          font-size: 28px;
          text-align: center;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          transition: all 0.3s ease;
          font-weight: 600;
        }

        .code-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .code-input:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }

        .btn-primary,
        .btn-secondary {
          width: 100%;
          padding: 14px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          margin-bottom: 12px;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: transparent;
          color: #667eea;
          border: 2px solid #667eea;
        }

        .btn-secondary:hover {
          background: #667eea;
          color: white;
        }

        .resend-container {
          text-align: center;
          margin: 20px 0 0 0;
        }

        .resend-text {
          color: #666;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .btn-resend {
          background: none;
          border: none;
          color: #667eea;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          transition: all 0.3s ease;
        }

        .btn-resend:hover:not(:disabled) {
          color: #764ba2;
        }

        .btn-resend:disabled {
          color: #999;
          cursor: not-allowed;
          text-decoration: none;
        }

        @media (max-width: 480px) {
          .verify-2fa-card {
            padding: 30px 20px;
          }

          h1 {
            font-size: 24px;
          }

          .code-input-container {
            gap: 6px;
          }

          .code-input {
            width: 45px;
            height: 55px;
            font-size: 24px;
          }
        }
      `}</style>
    </>
  )
}
