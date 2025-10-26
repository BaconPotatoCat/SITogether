import { useEffect, useState, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

export default function VerifyEmail() {
  const router = useRouter()
  const { token } = router.query
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const hasVerifiedRef = useRef(false)

  useEffect(() => {
    // Wait for router to be ready and token to be available
    if (!router.isReady || !token || typeof token !== 'string') {
      return
    }

    // Prevent double execution with ref (survives React.StrictMode double-render)
    if (hasVerifiedRef.current) {
      return
    }

    const verifyEmail = async () => {
      hasVerifiedRef.current = true // Prevent multiple calls

      try {
        // Call Next.js API route which proxies to backend using internal Docker networking
        const response = await fetch(`/api/auth/verify?token=${token}`)
        const data = await response.json()

        if (response.ok) {
          setStatus('success')
          setMessage(data.message || 'Email verified successfully!')
          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push('/auth')
          }, 3000)
        } else {
          setStatus('error')
          setMessage(data.error || 'Verification failed. Please try again.')
        }
      } catch (error) {
        setStatus('error')
        setMessage('An error occurred during verification. Please try again.')
        console.error('Verification error:', error)
      }
    }

    verifyEmail()
  }, [token, router.isReady, router])

  return (
    <>
      <Head>
        <title>Email Verification - SITogether</title>
        <meta name="description" content="Verify your email address" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="verify-container">
        <div className="verify-card">
          {status === 'loading' && (
            <>
              <div className="spinner" />
              <h1>Verifying your email...</h1>
              <p>Please wait while we verify your email address.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="success-icon">✓</div>
              <h1>Email Verified!</h1>
              <p>{message}</p>
              <p className="redirect-text">Redirecting you to login page...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="error-icon">✗</div>
              <h1>Verification Failed</h1>
              <p>{message}</p>
              <button onClick={() => router.push('/auth')} className="btn-primary">
                Go to Login
              </button>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .verify-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .verify-card {
          background: white;
          border-radius: 20px;
          padding: 60px 40px;
          max-width: 500px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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

        .success-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-size: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 30px;
          animation: scaleIn 0.5s ease;
        }

        .error-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: #ff4444;
          color: white;
          font-size: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 30px;
          animation: scaleIn 0.5s ease;
        }

        @keyframes scaleIn {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }

        h1 {
          font-size: 32px;
          margin-bottom: 20px;
          color: #333;
        }

        p {
          font-size: 16px;
          color: #666;
          margin-bottom: 15px;
          line-height: 1.6;
        }

        .redirect-text {
          font-style: italic;
          color: #999;
          margin-top: 20px;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 14px 40px;
          border-radius: 30px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition:
            transform 0.2s,
            box-shadow 0.2s;
          margin-top: 20px;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }

        .btn-primary:active {
          transform: translateY(0);
        }
      `}</style>
    </>
  )
}
