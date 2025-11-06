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
          transition: background 0.3s ease;
        }

        :global(html.dark) .verify-container {
          background: linear-gradient(135deg, #4c5566 0%, #5b2a6b 100%);
        }

        .verify-card {
          background: white;
          border-radius: 20px;
          padding: 60px 40px;
          max-width: 500px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          transition:
            background-color 0.3s ease,
            border-color 0.3s ease;
        }

        :global(html.dark) .verify-card {
          background: #1f2937;
          border: 1px solid #374151;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 30px;
          transition: border-color 0.3s ease;
        }

        :global(html.dark) .spinner {
          border-color: #374151;
          border-top-color: #818cf8;
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

        :global(html.dark) .success-icon {
          background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%);
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

        :global(html.dark) .error-icon {
          background: #ef4444;
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
          transition: color 0.3s ease;
        }

        :global(html.dark) h1 {
          color: #f3f4f6;
        }

        p {
          font-size: 16px;
          color: #666;
          margin-bottom: 15px;
          line-height: 1.6;
          transition: color 0.3s ease;
        }

        :global(html.dark) p {
          color: #d1d5db;
        }

        .redirect-text {
          font-style: italic;
          color: #999;
          margin-top: 20px;
          transition: color 0.3s ease;
        }

        :global(html.dark) .redirect-text {
          color: #9ca3af;
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
            box-shadow 0.2s,
            background 0.3s ease;
          margin-top: 20px;
        }

        :global(html.dark) .btn-primary {
          background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }

        :global(html.dark) .btn-primary:hover {
          box-shadow: 0 10px 20px rgba(129, 140, 248, 0.4);
        }

        .btn-primary:active {
          transform: translateY(0);
        }
      `}</style>
    </>
  )
}
