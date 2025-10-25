import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/router'
import Auth from '../../pages/auth'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

describe('Resend Verification Feature', () => {
  const mockPush = jest.fn()
  const mockRouter = {
    push: mockPush,
    query: {},
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('Unverified User Login', () => {
    it('should show resend verification option when unverified user tries to login', async () => {
      // Mock login response for unverified user
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          error:
            'Account not verified. Please check your email and verify your account before logging in.',
          requiresVerification: true,
          email: 'test@example.com',
        }),
      })

      render(<Auth />)

      // Fill in login form
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      // Wait for resend verification UI to appear
      await waitFor(() => {
        expect(screen.getByText(/email not verified/i)).toBeInTheDocument()
        expect(screen.getByText(/resend verification email/i)).toBeInTheDocument()
      })
    })

    it('should call resend verification API when button is clicked', async () => {
      // Mock login response for unverified user
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: 'Account not verified.',
            requiresVerification: true,
            email: 'test@example.com',
          }),
        })
        // Mock resend verification response
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Verification email sent successfully.',
          }),
        })

      render(<Auth />)

      // Fill in and submit login form
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      // Wait for resend button to appear and click it
      await waitFor(() => {
        const resendButton = screen.getByText(/resend verification email/i)
        expect(resendButton).toBeInTheDocument()
        fireEvent.click(resendButton)
      })

      // Verify resend API was called
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/resend-verification',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com' }),
          })
        )
      })
    })

    it('should show success toast when resend is successful', async () => {
      // Mock responses
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            requiresVerification: true,
            email: 'test@example.com',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Verification email sent! Please check your inbox.',
          }),
        })

      render(<Auth />)

      // Trigger unverified login
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      // Click resend button
      await waitFor(() => {
        const resendButton = screen.getByText(/resend verification email/i)
        fireEvent.click(resendButton)
      })

      // Check for success toast
      await waitFor(() => {
        expect(screen.getByText(/verification email sent/i)).toBeInTheDocument()
      })
    })

    it('should hide resend verification UI after successful resend', async () => {
      // Mock responses
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            requiresVerification: true,
            email: 'test@example.com',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Verification email sent!',
          }),
        })

      render(<Auth />)

      // Trigger unverified login
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      // Wait for resend UI and click button
      const resendButton = await screen.findByText(/resend verification email/i)
      fireEvent.click(resendButton)

      // UI should disappear after successful resend
      await waitFor(() => {
        expect(screen.queryByText(/email not verified/i)).not.toBeInTheDocument()
      })
    })

    it('should show error toast when resend fails', async () => {
      // Mock responses
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            requiresVerification: true,
            email: 'test@example.com',
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            success: false,
            error: 'Failed to send email',
          }),
        })

      render(<Auth />)

      // Trigger unverified login
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      // Click resend button
      await waitFor(() => {
        const resendButton = screen.getByText(/resend verification email/i)
        fireEvent.click(resendButton)
      })

      // Check for error toast
      await waitFor(() => {
        expect(screen.getByText(/failed to send email/i)).toBeInTheDocument()
      })
    })

    it('should disable button while resending', async () => {
      // Mock responses with delay
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            requiresVerification: true,
            email: 'test@example.com',
          }),
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    json: async () => ({
                      success: true,
                      message: 'Verification email sent!',
                    }),
                  }),
                100
              )
            )
        )

      render(<Auth />)

      // Trigger unverified login
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      // Click resend button
      const resendButton = await screen.findByText(/resend verification email/i)
      fireEvent.click(resendButton)

      // Button should be disabled during request
      expect(resendButton).toBeDisabled()

      // After successful resend, the verification reminder should disappear
      await waitFor(() => {
        expect(screen.queryByText(/email not verified/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Verification Reminder UI', () => {
    it('should have proper styling for verification reminder box', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          requiresVerification: true,
          email: 'test@example.com',
        }),
      })

      render(<Auth />)

      // Trigger unverified login
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      // Check for verification reminder div
      await waitFor(() => {
        const reminderBox = screen.getByText(/email not verified/i).closest('div')
        expect(reminderBox).toHaveClass('verification-reminder')
      })
    })

    it('should not show verification reminder for verified users', async () => {
      // Mock successful login
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Login successful',
        }),
      })

      render(<Auth />)

      // Fill in login form
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'verified@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(loginButton)

      // Verification reminder should not appear
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled()
      })

      expect(screen.queryByText(/email not verified/i)).not.toBeInTheDocument()
    })
  })
})
