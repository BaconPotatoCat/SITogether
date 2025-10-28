import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

export default function Auth() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [passwordError, setPasswordError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const { toasts, showToast, removeToast } = useToast()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    age: '',
    gender: '',
    course: '',
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Real-time email validation for registration
    // TODO: Uncomment to enforce SIT email validation
    // if (!isLogin && name === 'email') {
    //   const sitEmailRegex = /^\d{7}@sit\.singaporetech\.edu\.sg$/
    //   if (value && !sitEmailRegex.test(value)) {
    //     setEmailError('Must be a valid SIT student email (e.g., 2500000@sit.singaporetech.edu.sg)')
    //   } else {
    //     setEmailError('')
    //   }
    // }

    // Real-time password validation for registration
    if (!isLogin && (name === 'password' || name === 'confirmPassword')) {
      const password = name === 'password' ? value : formData.password
      const confirmPassword = name === 'confirmPassword' ? value : formData.confirmPassword

      if (confirmPassword && password !== confirmPassword) {
        setPasswordError('Passwords do not match')
      } else {
        setPasswordError('')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Email validation for registration
    // TODO: Uncomment to enforce SIT email validation
    // if (!isLogin && emailError) {
    //   showToast('Please use a valid SIT student email address.', 'error')
    //   return
    // }

    // Password validation for registration
    if (!isLogin && passwordError) {
      showToast('Please fix the password mismatch before submitting.', 'error')
      return
    }

    setIsLoading(true)

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : {
            email: formData.email,
            password: formData.password,
            name: formData.name,
            age: formData.age ? parseInt(formData.age) : null,
            gender: formData.gender,
            course: formData.course,
          }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (result.success) {
        if (isLogin) {
          showToast('Login successful!', 'success')

          // Redirect to home page after a brief delay
          setTimeout(() => {
            router.push('/')
          }, 500)
        } else {
          showToast(
            'Registration successful! Please check your email for the verification link.',
            'success'
          )

          // Reset form
          setFormData({
            email: '',
            password: '',
            confirmPassword: '',
            name: '',
            age: '',
            gender: '',
            course: '',
          })
          setPasswordError('')

          // Switch to login form after successful registration
          setIsLogin(true)
        }
      } else {
        // Handle verification error with special message
        if (result.requiresVerification) {
          setUnverifiedEmail(result.email || formData.email)
          showToast(`${result.error}`, 'warning')
        } else {
          showToast(result.error || 'An error occurred', 'error')
        }
      }
    } catch (error) {
      console.error('Auth error:', error)
      showToast('An error occurred. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return

    setIsLoading(true)
    try {
      // Call Next.js API route which proxies to backend using internal Docker networking
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      })

      const result = await response.json()

      if (result.success) {
        showToast('Verification email sent! Please check your inbox.', 'success')
        setUnverifiedEmail(null)
      } else {
        showToast(result.error || 'Failed to resend verification email', 'error')
      }
    } catch (error) {
      console.error('Resend verification error:', error)
      showToast('An error occurred. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!forgotPasswordEmail) {
      showToast('Please enter your email address', 'error')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      })

      const result = await response.json()

      if (result.success) {
        showToast('Password reset instructions have been sent to your email!', 'success')
        setShowForgotPassword(false)
        setForgotPasswordEmail('')
      } else {
        showToast(result.error || 'Failed to send reset email', 'error')
      }
    } catch (error) {
      console.error('Forgot password error:', error)
      showToast('An error occurred. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    setPasswordError('')
    setEmailError('')
    setUnverifiedEmail(null)
    setShowForgotPassword(false)
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      age: '',
      gender: '',
      course: '',
    })
  }

  return (
    <>
      <Head>
        <title>SITogether • {isLogin ? 'Login' : 'Register'}</title>
        <meta name="description" content={isLogin ? 'Login to SITogether' : 'Join SITogether'} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <h1>{isLogin ? 'Welcome Back' : 'Join SITogether'}</h1>
              <p>
                {isLogin
                  ? 'Sign in to discover new connections'
                  : 'Create your account to start connecting'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {!isLogin && (
                <>
                  <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required={!isLogin}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="age">Age</label>
                    <input
                      type="number"
                      id="age"
                      name="age"
                      value={formData.age}
                      onChange={handleInputChange}
                      required={!isLogin}
                      placeholder="Enter your age"
                      min="18"
                      max="100"
                    />
                  </div>

                  <div className="form-group">
                    <label>Gender</label>
                    <div className="radio-group">
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="gender"
                          value="Male"
                          checked={formData.gender === 'Male'}
                          onChange={handleInputChange}
                          required={!isLogin}
                        />
                        <span>Male</span>
                      </label>
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="gender"
                          value="Female"
                          checked={formData.gender === 'Female'}
                          onChange={handleInputChange}
                          required={!isLogin}
                        />
                        <span>Female</span>
                      </label>
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="gender"
                          value="Other"
                          checked={formData.gender === 'Other'}
                          onChange={handleInputChange}
                          required={!isLogin}
                        />
                        <span>Other</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="course">Course</label>
                    <input
                      type="text"
                      id="course"
                      name="course"
                      value={formData.course}
                      onChange={handleInputChange}
                      required={!isLogin}
                      placeholder="e.g., Computer Science, Business"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder={isLogin ? 'Enter your email' : 'your.email@example.com'}
                  className={emailError ? 'error' : ''}
                />
                {emailError && <span className="error-message">{emailError}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your password"
                  minLength={6}
                />
                {isLogin && (
                  <div style={{ textAlign: 'right', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="forgot-password-link"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>

              {!isLogin && (
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required={!isLogin}
                    placeholder="Confirm your password"
                    minLength={6}
                    className={passwordError ? 'input-error' : ''}
                  />
                  {passwordError && <span className="error-message">{passwordError}</span>}
                </div>
              )}

              <button type="submit" className="btn primary auth-submit" disabled={isLoading}>
                {isLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {unverifiedEmail && (
              <div className="verification-reminder">
                <p>
                  <strong>Email not verified?</strong>
                  <br />
                  Check your inbox or click below to resend the verification email.
                </p>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="btn secondary"
                  disabled={isLoading}
                >
                  Resend Verification Email
                </button>
              </div>
            )}

            <div className="auth-footer">
              <p>
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <button type="button" onClick={toggleMode} className="auth-toggle">
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="modal-overlay" onClick={() => setShowForgotPassword(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Reset Password</h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowForgotPassword(false)}
                >
                  ×
                </button>
              </div>
              <p className="modal-description">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
              <form onSubmit={handleForgotPassword} className="modal-form">
                <div className="form-group">
                  <label htmlFor="forgot-email">Email Address</label>
                  <input
                    type="email"
                    id="forgot-email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                    autoFocus
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="btn secondary"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn primary" disabled={isLoading}>
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  )
}
