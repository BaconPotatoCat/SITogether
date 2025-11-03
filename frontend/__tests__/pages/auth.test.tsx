import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/router'
import Auth from '../../pages/auth'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

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

      // Fast-forward time to trigger redirect
      jest.advanceTimersByTime(500)

      expect(mockPush).toHaveBeenCalledWith('/')

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

      await waitFor(() => {
        expect(
          screen.getByText(/please fix the password mismatch before submitting/i)
        ).toBeInTheDocument()
      })

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should successfully register with valid data', async () => {
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
            }),
          })
        )
      })

      await waitFor(() => {
        expect(screen.getByText(/registration successful/i)).toBeInTheDocument()
      })
    })

    it('should switch to login form after successful registration', async () => {
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
})
