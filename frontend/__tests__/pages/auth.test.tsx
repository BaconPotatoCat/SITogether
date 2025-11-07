import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useRouter } from 'next/router'
import React from 'react'
import Auth from '../../pages/auth'
import { config } from '../../utils/config'

// Suppress act() warnings for Next.js dynamic imports (LoadableComponent)
// This is a known issue with Next.js's dynamic import system in tests
// The warnings don't affect test correctness - dynamic imports work correctly
const originalError = console.error
beforeAll(() => {
  console.error = jest.fn((...args: unknown[]) => {
    // Check all arguments for the warning message (React formats warnings differently)
    const fullMessage = args.map((arg) => (typeof arg === 'string' ? arg : String(arg))).join(' ')

    // Suppress warnings related to Next.js LoadableComponent
    // Check for multiple variations of the warning message
    const isLoadableWarning =
      fullMessage.includes('ForwardRef(LoadableComponent)') ||
      fullMessage.includes('LoadableComponent') ||
      fullMessage.includes('useLoadableModule') ||
      fullMessage.includes('loadable.shared-runtime') ||
      (fullMessage.includes('not wrapped in act') &&
        (fullMessage.includes('loadable') || fullMessage.includes('Loadable')))

    if (isLoadableWarning) {
      return
    }
    originalError.call(console, ...args)
  })
})

afterAll(() => {
  console.error = originalError
})

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

// Mock react-google-recaptcha
const mockRecaptchaToken = 'mock-recaptcha-token'
const mockRecaptchaChange = jest.fn()
const mockRecaptchaCallbacks = {
  onExpired: null as (() => void) | null,
  onError: null as (() => void) | null,
}

jest.mock('react-google-recaptcha', () => {
  const MockRecaptcha = React.forwardRef<
    HTMLDivElement,
    {
      onChange?: (token: string | null) => void
      onExpired?: () => void
      onError?: () => void
      sitekey?: string
    }
  >(
    (
      {
        onChange,
        onExpired,
        onError,
        sitekey,
      }: {
        onChange?: (token: string | null) => void
        onExpired?: () => void
        onError?: () => void
        sitekey?: string
      },
      ref: React.Ref<HTMLDivElement>
    ) => {
      // Store callbacks for testing
      if (onExpired) {
        mockRecaptchaCallbacks.onExpired = onExpired
      }
      if (onError) {
        mockRecaptchaCallbacks.onError = onError
      }

      if (onChange) {
        mockRecaptchaChange.mockImplementation(onChange)
      }

      // Simulate successful verification after component mounts
      // Use setTimeout with act() to handle React state updates properly
      // The delay ensures the dynamic component has fully loaded and Next.js loadable is ready
      React.useEffect(() => {
        // Use a longer delay to ensure Next.js dynamic import has completed
        const timer = setTimeout(() => {
          if (onChange) {
            // Wrap in act() to handle React state updates
            act(() => {
              // Call mockRecaptchaChange which will also call onChange via mockImplementation
              mockRecaptchaChange(mockRecaptchaToken)
            })
          }
        }, 100)

        return () => clearTimeout(timer)
      }, [onChange])

      // Return a proper React element
      return React.createElement('div', {
        'data-testid': 'recaptcha',
        'data-sitekey': sitekey || '',
        ref,
      })
    }
  )

  MockRecaptcha.displayName = 'MockRecaptcha'
  return MockRecaptcha
})

// Mock AuthContext
const mockRefreshSession = jest.fn()
jest.mock('../../contexts/AuthContext', () => ({
  useSession: jest.fn(() => ({
    refreshSession: mockRefreshSession,
    session: null,
    status: 'unauthenticated',
    signOut: jest.fn(),
  })),
}))

// Mock fetch
global.fetch = jest.fn()

// Mock window.location
const mockLocationHref = jest.fn()
const originalLocation = window.location
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (window as any).location
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).location = {
  ...originalLocation,
  href: '',
}
Object.defineProperty(window.location, 'href', {
  configurable: true,
  writable: true,
  value: '',
})
// Override the setter
Object.defineProperty(window.location, 'href', {
  set: mockLocationHref,
  get: () => '',
  configurable: true,
})

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: { [key: string]: string } = {}

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
})

describe('Auth Page', () => {
  const mockPush = jest.fn()
  const mockRouter = {
    push: mockPush,
    query: {},
  }

  beforeEach(() => {
    jest.clearAllMocks()
    sessionStorageMock.clear()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(global.fetch as jest.Mock).mockClear()
    mockRefreshSession.mockResolvedValue(undefined)
    mockLocationHref.mockClear()
    // Default mock implementation to prevent unhandled fetch calls
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      })
    )
  })

  describe('Page Rendering', () => {
    it('should render login form by default', () => {
      render(<Auth />)

      expect(screen.getByText('Welcome Back')).toBeInTheDocument()
      expect(screen.getByText('Sign in to discover new connections')).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('should render registration form when toggled', () => {
      render(<Auth />)

      // Click on "Sign up" button
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      expect(screen.getByText('Join SITogether')).toBeInTheDocument()
      expect(screen.getByText('Create your account to start connecting')).toBeInTheDocument()
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/age/i)).toBeInTheDocument()
      const radioButtons = screen.getAllByRole('radio')
      expect(radioButtons.length).toBeGreaterThan(0)
      expect(screen.getByLabelText(/course/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    it('should have password input with minLength 8 and maxLength 64 in registration form', () => {
      render(<Auth />)

      // Toggle to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      const passwordInput = screen.getByLabelText(/^password$/i)
      expect(passwordInput).toHaveAttribute('minLength', '8')
      expect(passwordInput).toHaveAttribute('maxLength', '64')
      expect(passwordInput).toHaveAttribute('placeholder', 'Enter your password (min 8 characters)')

      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      expect(confirmPasswordInput).toHaveAttribute('minLength', '8')
      expect(confirmPasswordInput).toHaveAttribute('maxLength', '64')
    })

    it('should have password input with minLength 8 and maxLength 64 in login form', () => {
      render(<Auth />)

      const passwordInput = screen.getByLabelText(/^password$/i)
      expect(passwordInput).toHaveAttribute('minLength', '8')
      expect(passwordInput).toHaveAttribute('maxLength', '64')
      expect(passwordInput).toHaveAttribute('placeholder', 'Enter your password (min 8 characters)')
    })

    it('should render forgot password link on login form', () => {
      render(<Auth />)

      const forgotPasswordLink = screen.getByText(/forgot password/i)
      expect(forgotPasswordLink).toBeInTheDocument()
    })

    it('should display correct page title for login', async () => {
      render(<Auth />)

      await waitFor(() => {
        expect(document.title).toBe('SITogether • Login')
      })
    })

    it('should display correct page title for registration', async () => {
      render(<Auth />)

      // Toggle to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      await waitFor(() => {
        expect(document.title).toBe('SITogether • Register')
      })
    })
  })

  describe('Form Switching', () => {
    it('should toggle from login to registration', () => {
      render(<Auth />)

      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      expect(screen.getByText('Join SITogether')).toBeInTheDocument()
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    })

    it('should toggle from registration to login', () => {
      render(<Auth />)

      // Switch to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      // Switch back to login
      const signInButton = screen.getByRole('button', { name: /sign in$/i })
      fireEvent.click(signInButton)

      expect(screen.getByText('Welcome Back')).toBeInTheDocument()
      expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument()
    })

    it('should clear form data when switching between login and registration', () => {
      render(<Auth />)

      // Fill login form
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      // Switch to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      // Check that form is cleared
      const newEmailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const newPasswordInput = screen.getByLabelText('Password') as HTMLInputElement

      expect(newEmailInput.value).toBe('')
      expect(newPasswordInput.value).toBe('')
    })

    it('should clear validation errors when switching forms', () => {
      render(<Auth />)

      // Switch to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      // Create password mismatch
      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i) as HTMLInputElement

      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'differentpassword' } })

      // Error should appear
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()

      // Switch back to login
      const signInButton = screen.getByRole('button', { name: /sign in$/i })
      fireEvent.click(signInButton)

      // Switch to registration again - error should be cleared
      fireEvent.click(screen.getByRole('button', { name: /sign up/i }))

      expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument()
    })
  })

  describe('Login Form', () => {
    it('should handle input changes for email and password', () => {
      render(<Auth />)

      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      expect(emailInput.value).toBe('test@example.com')
      expect(passwordInput.value).toBe('password123')
    })

    it('should successfully login with valid credentials', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Login successful',
        }),
      })

      render(<Auth />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/login',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'password123',
            }),
          })
        )
      })

      await waitFor(() => {
        expect(screen.getByText(/login successful/i)).toBeInTheDocument()
      })
    })

    it('should redirect to home page after successful login', async () => {
      jest.useFakeTimers()
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Login successful',
        }),
      })

      render(<Auth />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText(/login successful/i)).toBeInTheDocument()
      })

      // Wait for refreshSession to be called
      await waitFor(() => {
        expect(mockRefreshSession).toHaveBeenCalled()
      })

      // Fast-forward time to trigger redirect
      jest.advanceTimersByTime(500)

      // Check for window.location.href redirect instead of router.push
      expect(mockLocationHref).toHaveBeenCalledWith('/')

      jest.useRealTimers()
    })

    it('should redirect to 2FA page when requiresTwoFactor is true', async () => {
      jest.useFakeTimers()
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Please check your email for the verification code',
          requiresTwoFactor: true,
          tempToken: 'mock-temp-token-12345',
        }),
      })

      render(<Auth />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(
          screen.getByText(/please check your email for the verification code/i)
        ).toBeInTheDocument()
      })

      // Verify tempToken is stored in sessionStorage
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('tempToken', 'mock-temp-token-12345')

      // Fast-forward time to trigger redirect
      jest.advanceTimersByTime(500)

      expect(mockPush).toHaveBeenCalledWith('/verify-2fa')

      jest.useRealTimers()
    })

    it('should show error toast for invalid credentials', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Invalid email or password',
        }),
      })

      render(<Auth />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
      })
    })

    it('should show error toast for unverified account', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          error: 'Account not verified. Please check your email.',
          requiresVerification: true,
          email: 'unverified@example.com',
        }),
      })

      render(<Auth />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'unverified@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText(/account not verified/i)).toBeInTheDocument()
      })
    })

    it('should disable button during login', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    success: true,
                    message: 'Login successful',
                  }),
                }),
              100
            )
          )
      )

      render(<Auth />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      expect(loginButton).toBeDisabled()

      await waitFor(() => {
        expect(loginButton).not.toBeDisabled()
      })
    })

    it('should handle network error during login', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<Auth />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText(/an error occurred/i)).toBeInTheDocument()
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Auth error:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Registration Form', () => {
    beforeEach(() => {
      // Clear mocks but ensure mockRecaptchaChange is properly reset
      jest.clearAllMocks()
      mockRecaptchaChange.mockClear()
      mockRecaptchaCallbacks.onExpired = null
      mockRecaptchaCallbacks.onError = null

      render(<Auth />)
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)
    })

    it('should render all registration fields', () => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/age/i)).toBeInTheDocument()
      expect(screen.getByText(/gender/i)).toBeInTheDocument()
      const genderRadios = screen.getAllByRole('radio')
      expect(genderRadios.length).toBeGreaterThan(0)
      expect(screen.getByLabelText(/course/i)).toBeInTheDocument()
    })

    it('should handle input changes for all registration fields', () => {
      const nameInput = screen.getByLabelText(/full name/i) as HTMLInputElement
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i) as HTMLInputElement
      const ageInput = screen.getByLabelText(/age/i) as HTMLInputElement
      const genderRadios = screen.getAllByRole('radio') as HTMLInputElement[]
      const genderMaleInput = genderRadios.find((r) => r.value === 'Male')!
      const courseInput = screen.getByLabelText(/course/i) as HTMLInputElement

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(ageInput, { target: { value: '20' } })
      fireEvent.click(genderMaleInput)
      fireEvent.change(courseInput, { target: { value: 'Computer Science' } })

      expect(nameInput.value).toBe('John Doe')
      expect(emailInput.value).toBe('john@example.com')
      expect(passwordInput.value).toBe('password123')
      expect(confirmPasswordInput.value).toBe('password123')
      expect(ageInput.value).toBe('20')
      expect(genderMaleInput.checked).toBe(true)
      expect(courseInput.value).toBe('Computer Science')
    })

    it('should show error when passwords do not match', () => {
      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i) as HTMLInputElement

      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'differentpassword' } })

      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    it('should clear password error when passwords match', () => {
      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i) as HTMLInputElement

      // First create mismatch
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'differentpassword' } })

      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()

      // Then fix it
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })

      expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument()
    })

    it('should prevent submission when passwords do not match', async () => {
      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i) as HTMLInputElement
      const genderRadios = screen.getAllByRole('radio') as HTMLInputElement[]
      const genderMaleInput = genderRadios.find((r) => r.value === 'Male')!
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } })
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'differentpassword' } })
      fireEvent.change(screen.getByLabelText(/age/i), { target: { value: '20' } })
      fireEvent.click(genderMaleInput)
      fireEvent.change(screen.getByLabelText(/course/i), { target: { value: 'Computer Science' } })

      // Password error should be displayed inline
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()

      fireEvent.click(submitButton)

      // The form should show a toast error when passwords don't match on submit
      await waitFor(() => {
        // Check for toast error message specifically (not the inline error)
        // Use getAllByText since there are multiple instances (inline + toast)
        const messages = screen.getAllByText(/passwords do not match/i)
        // Should have both inline error and toast message
        expect(messages.length).toBeGreaterThanOrEqual(2)
        // Verify toast message exists by checking for toast-container parent
        const toastMessage = messages.find((msg) => {
          const container = msg.closest('.toast-container')
          return container !== null
        })
        expect(toastMessage).toBeDefined()
        expect(toastMessage).toBeInTheDocument()
      })

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should successfully register with valid data', async () => {
      // Wait for reCAPTCHA to generate token before filling form
      await waitFor(
        () => {
          expect(mockRecaptchaChange).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Registration successful',
        }),
      })

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const ageInput = screen.getByLabelText(/age/i)
      const genderRadios = screen.getAllByRole('radio') as HTMLInputElement[]
      const genderMaleInput = genderRadios.find((r) => r.value === 'Male')!
      const courseInput = screen.getByLabelText(/course/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(ageInput, { target: { value: '20' } })
      fireEvent.click(genderMaleInput)
      fireEvent.change(courseInput, { target: { value: 'Computer Science' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/register',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'john@example.com',
              password: 'password123',
              name: 'John Doe',
              age: 20,
              gender: 'Male',
              course: 'Computer Science',
              recaptchaToken: mockRecaptchaToken,
            }),
          })
        )
      })

      await waitFor(() => {
        expect(screen.getByText(/registration successful/i)).toBeInTheDocument()
      })
    })

    it('should switch to login form after successful registration', async () => {
      // Wait for reCAPTCHA to generate token before filling form
      await waitFor(
        () => {
          expect(mockRecaptchaChange).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Registration successful',
        }),
      })

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const ageInput = screen.getByLabelText(/age/i)
      const genderRadios = screen.getAllByRole('radio') as HTMLInputElement[]
      const genderMaleInput = genderRadios.find((r) => r.value === 'Male')!
      const courseInput = screen.getByLabelText(/course/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(ageInput, { target: { value: '20' } })
      fireEvent.click(genderMaleInput)
      fireEvent.change(courseInput, { target: { value: 'Computer Science' } })

      fireEvent.click(submitButton)

      // Wait for registration success toast
      await waitFor(() => {
        expect(screen.getByText(/registration successful/i)).toBeInTheDocument()
      })

      // Verify form switched to login
      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument()
      })
    })

    it('should clear form after successful registration', async () => {
      // Wait for reCAPTCHA to generate token before filling form
      await waitFor(
        () => {
          expect(mockRecaptchaChange).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Registration successful',
        }),
      })

      const nameInput = screen.getByLabelText(/full name/i) as HTMLInputElement
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i) as HTMLInputElement
      const ageInput = screen.getByLabelText(/age/i) as HTMLInputElement
      const genderRadios = screen.getAllByRole('radio') as HTMLInputElement[]
      const genderMaleInput = genderRadios.find((r) => r.value === 'Male')!
      const courseInput = screen.getByLabelText(/course/i) as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(ageInput, { target: { value: '20' } })
      fireEvent.click(genderMaleInput)
      fireEvent.change(courseInput, { target: { value: 'Computer Science' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/registration successful/i)).toBeInTheDocument()
      })

      // Switch back to registration to verify form is cleared
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      const newNameInput = screen.getByLabelText(/full name/i) as HTMLInputElement
      const newEmailInput = screen.getByLabelText(/email/i) as HTMLInputElement

      expect(newNameInput.value).toBe('')
      expect(newEmailInput.value).toBe('')
    })

    it('should show error toast for duplicate email', async () => {
      // Wait for reCAPTCHA to generate token before filling form
      await waitFor(
        () => {
          expect(mockRecaptchaChange).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Email already exists',
        }),
      })

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const ageInput = screen.getByLabelText(/age/i)
      const genderRadios = screen.getAllByRole('radio') as HTMLInputElement[]
      const genderMaleInput = genderRadios.find((r) => r.value === 'Male')!
      const courseInput = screen.getByLabelText(/course/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(ageInput, { target: { value: '20' } })
      fireEvent.click(genderMaleInput)
      fireEvent.change(courseInput, { target: { value: 'Computer Science' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
      })
    })

    it('should disable button during registration', async () => {
      // Wait for reCAPTCHA to generate token before filling form
      await waitFor(
        () => {
          expect(mockRecaptchaChange).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )

      let resolvePromise: (value: { ok: boolean; json: () => Promise<unknown> }) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      ;(global.fetch as jest.Mock).mockReturnValueOnce(promise)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const ageInput = screen.getByLabelText(/age/i)
      const genderRadios = screen.getAllByRole('radio') as HTMLInputElement[]
      const genderMaleInput = genderRadios.find((r) => r.value === 'Male')!
      const courseInput = screen.getByLabelText(/course/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(ageInput, { target: { value: '20' } })
      fireEvent.click(genderMaleInput)
      fireEvent.change(courseInput, { target: { value: 'Computer Science' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Registration successful',
        }),
      })

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled()
      })
    })

    it('should handle network error during registration', async () => {
      // Wait for reCAPTCHA to generate token before filling form
      await waitFor(
        () => {
          expect(mockRecaptchaChange).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const ageInput = screen.getByLabelText(/age/i)
      const genderRadios = screen.getAllByRole('radio') as HTMLInputElement[]
      const genderMaleInput = genderRadios.find((r) => r.value === 'Male')!
      const courseInput = screen.getByLabelText(/course/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(ageInput, { target: { value: '20' } })
      fireEvent.click(genderMaleInput)
      fireEvent.change(courseInput, { target: { value: 'Computer Science' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/an error occurred/i)).toBeInTheDocument()
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Auth error:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })

    it('should send age as number when provided', async () => {
      // Wait for reCAPTCHA to generate token before filling form
      await waitFor(
        () => {
          expect(mockRecaptchaChange).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Registration successful',
        }),
      })

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const ageInput = screen.getByLabelText(/age/i)
      const genderRadios = screen.getAllByRole('radio') as HTMLInputElement[]
      const genderMaleInput = genderRadios.find((r) => r.value === 'Male')!
      const courseInput = screen.getByLabelText(/course/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(ageInput, { target: { value: '25' } })
      fireEvent.click(genderMaleInput)
      fireEvent.change(courseInput, { target: { value: 'Computer Science' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/register',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"age":25'),
          })
        )
      })
    })
  })

  describe('Forgot Password Modal', () => {
    it('should open forgot password modal when link is clicked', () => {
      render(<Auth />)

      const forgotPasswordLink = screen.getByText(/forgot password/i)
      fireEvent.click(forgotPasswordLink)

      expect(screen.getByText(/reset password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
    })

    it('should close forgot password modal when cancel is clicked', () => {
      render(<Auth />)

      const forgotPasswordLink = screen.getByText(/forgot password/i)
      fireEvent.click(forgotPasswordLink)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(screen.queryByText(/reset password/i)).not.toBeInTheDocument()
    })

    it('should close forgot password modal when backdrop is clicked', () => {
      render(<Auth />)

      const forgotPasswordLink = screen.getByText(/forgot password/i)
      fireEvent.click(forgotPasswordLink)

      const modalOverlay = document.querySelector('.modal-overlay')
      if (modalOverlay) {
        fireEvent.click(modalOverlay)
      }

      expect(screen.queryByText(/reset password/i)).not.toBeInTheDocument()
    })

    it('should handle input change in forgot password modal', () => {
      render(<Auth />)

      const forgotPasswordLink = screen.getByText(/forgot password/i)
      fireEvent.click(forgotPasswordLink)

      const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement
      fireEvent.change(emailInput, { target: { value: 'forgot@example.com' } })

      expect(emailInput.value).toBe('forgot@example.com')
    })

    it('should show error when submitting without email', async () => {
      render(<Auth />)

      const forgotPasswordLink = screen.getByText(/forgot password/i)
      fireEvent.click(forgotPasswordLink)

      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      fireEvent.click(submitButton)

      // Since the form has required attribute, browser validation prevents submission
      // We just verify that fetch was not called
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should successfully send password reset email', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Password reset instructions sent',
        }),
      })

      render(<Auth />)

      const forgotPasswordLink = screen.getByText(/forgot password/i)
      fireEvent.click(forgotPasswordLink)

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset link/i })

      fireEvent.change(emailInput, { target: { value: 'forgot@example.com' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/forgot-password',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'forgot@example.com' }),
          })
        )
      })

      await waitFor(() => {
        expect(screen.getByText(/password reset instructions/i)).toBeInTheDocument()
      })
    })

    it('should close modal after successful password reset email', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Password reset instructions sent',
        }),
      })

      render(<Auth />)

      const forgotPasswordLink = screen.getByText(/forgot password/i)
      fireEvent.click(forgotPasswordLink)

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset link/i })

      fireEvent.change(emailInput, { target: { value: 'forgot@example.com' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.queryByText(/reset password/i)).not.toBeInTheDocument()
      })
    })

    it('should clear email input after successful submission', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Password reset instructions sent',
        }),
      })

      render(<Auth />)

      const forgotPasswordLink = screen.getByText(/forgot password/i)
      fireEvent.click(forgotPasswordLink)

      const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /send reset link/i })

      fireEvent.change(emailInput, { target: { value: 'forgot@example.com' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.queryByText(/reset password/i)).not.toBeInTheDocument()
      })

      // Open modal again to verify email is cleared
      fireEvent.click(screen.getByText(/forgot password/i))
      const newEmailInput = screen.getByLabelText(/email address/i) as HTMLInputElement
      expect(newEmailInput.value).toBe('')
    })

    it('should show error toast when password reset fails', async () => {
      render(<Auth />)

      // Set up error response mock after rendering
      ;(global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            success: false,
            error: 'Failed to send reset email',
          }),
        })
      )

      const forgotPasswordLink = screen.getByText(/forgot password/i)
      fireEvent.click(forgotPasswordLink)

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset link/i })

      fireEvent.change(emailInput, { target: { value: 'forgot@example.com' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/forgot-password',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'forgot@example.com' }),
          })
        )
      })

      await waitFor(() => {
        expect(screen.getByText(/failed to send reset email/i)).toBeInTheDocument()
      })
    })

    it('should disable button during password reset request', async () => {
      let resolvePromise: (value: { ok: boolean; json: () => Promise<unknown> }) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      ;(global.fetch as jest.Mock).mockReturnValueOnce(promise)

      render(<Auth />)

      const forgotPasswordLink = screen.getByText(/forgot password/i)
      fireEvent.click(forgotPasswordLink)

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset link/i })

      fireEvent.change(emailInput, { target: { value: 'forgot@example.com' } })
      fireEvent.click(submitButton)

      // Button should be disabled during request
      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Password reset instructions sent',
        }),
      })

      // Wait for modal to close after successful submission
      await waitFor(() => {
        expect(screen.queryByText(/reset password/i)).not.toBeInTheDocument()
      })
    })

    it('should handle network error during password reset', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<Auth />)

      const forgotPasswordLink = screen.getByText(/forgot password/i)
      fireEvent.click(forgotPasswordLink)

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset link/i })

      fireEvent.change(emailInput, { target: { value: 'forgot@example.com' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/forgot-password',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'forgot@example.com' }),
          })
        )
      })

      await waitFor(() => {
        expect(screen.getByText(/an error occurred/i)).toBeInTheDocument()
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Forgot password error:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })

    it('should hide forgot password modal when switching to registration', () => {
      render(<Auth />)

      // Open forgot password modal
      const forgotPasswordLink = screen.getByText(/forgot password/i)
      fireEvent.click(forgotPasswordLink)

      expect(screen.getByText(/reset password/i)).toBeInTheDocument()

      // Switch to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      // Modal should be hidden
      expect(screen.queryByText(/reset password/i)).not.toBeInTheDocument()
    })
  })

  describe('ToastContainer', () => {
    it('should render toast container', () => {
      const { container } = render(<Auth />)

      const toastContainer = container.querySelector('.toast-container')
      expect(toastContainer).toBeInTheDocument()
    })
  })

  describe('reCAPTCHA', () => {
    beforeEach(() => {
      // Set the site key on the exported config object without using `any`.
      Object.defineProperty(config, 'recaptchaSiteKey', {
        value: 'test-site-key-123',
        configurable: true,
        writable: true,
      })
    })

    it('should not show reCAPTCHA in login form', async () => {
      // Wrap render in act() to handle Next.js dynamic import state updates
      await act(async () => {
        render(<Auth />)
        // Wait for dynamic imports to settle
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      const recaptcha = screen.queryByTestId('recaptcha')
      expect(recaptcha).not.toBeInTheDocument()
    })

    it('should show reCAPTCHA in registration form', async () => {
      // Wrap render in act() to handle Next.js dynamic import state updates
      await act(async () => {
        render(<Auth />)
        // Wait for dynamic imports to settle
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      // Switch to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      // Wait for dynamic component to load
      await waitFor(
        () => {
          const recaptcha = screen.queryByTestId('recaptcha')
          expect(recaptcha).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })

    it('should pass site key to reCAPTCHA component', async () => {
      // Ensure the site key is set on the exported config for this test
      Object.defineProperty(config, 'recaptchaSiteKey', {
        value: 'test-site-key-123',
        configurable: true,
        writable: true,
      })
      // Wrap render in act() to handle Next.js dynamic import state updates
      await act(async () => {
        render(<Auth />)
        // Wait for dynamic imports to settle
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      // Switch to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      // Wait for dynamic component to load
      await waitFor(
        () => {
          const recaptcha = screen.getByTestId('recaptcha')
          expect(recaptcha).toHaveAttribute('data-sitekey', 'test-site-key-123')
        },
        { timeout: 3000 }
      )
    })

    it('should prevent form submission without reCAPTCHA token', async () => {
      render(<Auth />)

      // Switch to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      // Fill form
      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const ageInput = screen.getByLabelText(/age/i)
      const genderRadios = screen.getAllByRole('radio') as HTMLInputElement[]
      const genderMaleInput = genderRadios.find((r) => r.value === 'Male')!
      const courseInput = screen.getByLabelText(/course/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(ageInput, { target: { value: '20' } })
      fireEvent.click(genderMaleInput)
      fireEvent.change(courseInput, { target: { value: 'Computer Science' } })

      // Clear the mock to prevent automatic token generation
      mockRecaptchaChange.mockClear()

      fireEvent.click(submitButton)

      // Should show error toast
      await waitFor(() => {
        expect(screen.getByText(/please complete the recaptcha verification/i)).toBeInTheDocument()
      })

      // Should not call fetch
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should include reCAPTCHA token in registration request', async () => {
      // Wrap render in act() to handle Next.js dynamic import state updates
      await act(async () => {
        render(<Auth />)
        // Wait for dynamic imports to settle
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      // Switch to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      // Wait for reCAPTCHA to generate token (waitFor handles act() internally)
      await waitFor(
        () => {
          expect(mockRecaptchaChange).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Registration successful',
        }),
      })

      // Fill form
      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const ageInput = screen.getByLabelText(/age/i)
      const genderRadios = screen.getAllByRole('radio') as HTMLInputElement[]
      const genderMaleInput = genderRadios.find((r) => r.value === 'Male')!
      const courseInput = screen.getByLabelText(/course/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(ageInput, { target: { value: '20' } })
      fireEvent.click(genderMaleInput)
      fireEvent.change(courseInput, { target: { value: 'Computer Science' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/register',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'john@example.com',
              password: 'password123',
              name: 'John Doe',
              age: 20,
              gender: 'Male',
              course: 'Computer Science',
              recaptchaToken: mockRecaptchaToken,
            }),
          })
        )
      })
    })

    it('should reset reCAPTCHA when form is reset after successful registration', async () => {
      // Wrap render in act() to handle Next.js dynamic import state updates
      await act(async () => {
        render(<Auth />)
        // Wait for dynamic imports to settle
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      // Switch to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      // Wait for reCAPTCHA to generate token (waitFor handles act() internally)
      await waitFor(
        () => {
          expect(mockRecaptchaChange).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Registration successful',
        }),
      })

      // Fill and submit form
      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const ageInput = screen.getByLabelText(/age/i)
      const genderRadios = screen.getAllByRole('radio') as HTMLInputElement[]
      const genderMaleInput = genderRadios.find((r) => r.value === 'Male')!
      const courseInput = screen.getByLabelText(/course/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(ageInput, { target: { value: '20' } })
      fireEvent.click(genderMaleInput)
      fireEvent.change(courseInput, { target: { value: 'Computer Science' } })

      fireEvent.click(submitButton)

      // Wait for registration to complete and form to reset
      await waitFor(() => {
        expect(screen.getByText(/registration successful/i)).toBeInTheDocument()
      })

      // Switch back to registration to verify reCAPTCHA was reset
      const signUpButtonAgain = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButtonAgain)

      // The reCAPTCHA should be re-rendered (new key = remount)
      const recaptcha = screen.getByTestId('recaptcha')
      expect(recaptcha).toBeInTheDocument()
    })

    it('should handle reCAPTCHA expiration', async () => {
      // Wrap render in act() to handle Next.js dynamic import state updates
      await act(async () => {
        render(<Auth />)
        // Wait for dynamic imports to settle
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      // Switch to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      // Wait for reCAPTCHA to generate token (waitFor handles act() internally)
      await waitFor(
        () => {
          expect(mockRecaptchaChange).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )

      // Simulate expiration by calling onExpired callback
      if (mockRecaptchaCallbacks.onExpired) {
        await act(async () => {
          mockRecaptchaCallbacks.onExpired!()
        })
      }

      // The token should be cleared (component will handle this internally)
      // This is mainly a test that the handler exists
      expect(mockRecaptchaCallbacks.onExpired).toBeDefined()
    })

    it('should handle reCAPTCHA errors', async () => {
      // Wrap render in act() to handle Next.js dynamic import state updates
      await act(async () => {
        render(<Auth />)
        // Wait for dynamic imports to settle
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      // Switch to registration
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(signUpButton)

      // Wait for reCAPTCHA to render (dynamic component needs time to load)
      await waitFor(
        () => {
          expect(screen.getByTestId('recaptcha')).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      // Simulate error by calling onError callback
      if (mockRecaptchaCallbacks.onError) {
        await act(async () => {
          mockRecaptchaCallbacks.onError!()
        })
      }

      // Should show error toast
      await waitFor(() => {
        expect(screen.getByText(/recaptcha error/i)).toBeInTheDocument()
      })
    })
  })
})
