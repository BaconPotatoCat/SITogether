import { useState } from 'react'
import Head from 'next/head'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [passwordError, setPasswordError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toasts, showToast, removeToast } = useToast()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    age: '',
    gender: '',
    course: ''
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
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
            course: formData.course
          }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (result.success) {
        showToast(`${isLogin ? 'Login' : 'Registration'} successful! Please check your email for the confirmation link.`, 'success')
        // Reset form
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          name: '',
          age: '',
          gender: '',
          course: ''
        })
        setPasswordError('')
        
        // Switch to login form after successful registration
        if (!isLogin) {
          setIsLogin(true)
        }
      } else {
        // Handle confirmation error with special message
        if (result.requiresConfirmation) {
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

  const toggleMode = () => {
    setIsLogin(!isLogin)
    setPasswordError('')
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      age: '',
      course: ''
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
              <p>{isLogin ? 'Sign in to discover new connections' : 'Create your account to start connecting'}</p>
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
                  placeholder="Enter your email"
                />
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
                  {passwordError && (
                    <span className="error-message">{passwordError}</span>
                  )}
                </div>
              )}

              <button type="submit" className="btn primary auth-submit" disabled={isLoading}>
                {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button type="button" onClick={toggleMode} className="auth-toggle">
                  {isLogin ? 'Sign up' : 'Sign in'}
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
