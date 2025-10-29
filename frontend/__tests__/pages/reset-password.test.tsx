import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useRouter } from 'next/router'
import ResetPassword from '../../pages/reset-password'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

// Mock useToast hook
const mockShowToast = jest.fn()
const mockRemoveToast = jest.fn()
jest.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    showToast: mockShowToast,
    removeToast: mockRemoveToast,
  }),
}))

// Mock fetch
global.fetch = jest.fn()

describe('Reset Password Page', () => {
  const mockPush = jest.fn()
  const mockRouter = {
    push: mockPush,
    query: {},
    isReady: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(global.fetch as jest.Mock).mockClear()
    mockShowToast.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Loading and Initial State', () => {
    it('should display loading state when router is not ready', () => {
      mockRouter.query = { token: 'test-token' }
      mockRouter.isReady = false

      render(<ResetPassword />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should transition from loading to form when router becomes ready', async () => {
      mockRouter.query = { token: 'test-token' }
      mockRouter.isReady = false

      const { rerender } = render(<ResetPassword />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()

      // Simulate router becoming ready
      mockRouter.isReady = true
      rerender(<ResetPassword />)

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
        expect(screen.getByText(/reset your password/i)).toBeInTheDocument()
      })
    })
  })

  describe('No Token Handling', () => {
    it('should show invalid link page when no token in URL', () => {
      mockRouter.query = {}
      mockRouter.isReady = true

      render(<ResetPassword />)

      expect(screen.getByText(/invalid link/i)).toBeInTheDocument()
      expect(screen.getByText(/password reset link is invalid or has expired/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /go to login/i })).toBeInTheDocument()
    })

    it('should show toast only once when no token (no spam)', async () => {
      mockRouter.query = {}
      mockRouter.isReady = true

      const { rerender } = render(<ResetPassword />)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledTimes(1)
        expect(mockShowToast).toHaveBeenCalledWith('Invalid password reset link', 'error')
      })

      // Rerender multiple times - toast should not be called again
      rerender(<ResetPassword />)
      rerender(<ResetPassword />)
      rerender(<ResetPassword />)

      expect(mockShowToast).toHaveBeenCalledTimes(1)
    })

    it('should not show reset form when no token', () => {
      mockRouter.query = {}
      mockRouter.isReady = true

      render(<ResetPassword />)

      expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /reset password/i })).not.toBeInTheDocument()
    })

    it('should redirect to login when Go to Login button clicked', async () => {
      mockRouter.query = {}
      mockRouter.isReady = true

      render(<ResetPassword />)

      const loginButton = screen.getByRole('button', { name: /go to login/i })
      fireEvent.click(loginButton)

      expect(mockPush).toHaveBeenCalledWith('/auth')
    })
  })

  describe('Form Rendering with Token', () => {
    it('should show reset form when token exists in URL', () => {
      mockRouter.query = { token: 'valid-token-abc123' }
      mockRouter.isReady = true

      render(<ResetPassword />)

      expect(screen.getByText(/reset your password/i)).toBeInTheDocument()
      expect(screen.getByLabelText('New Password')).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
    })

    it('should not show invalid link page when token exists', () => {
      mockRouter.query = { token: 'some-token' }
      mockRouter.isReady = true

      render(<ResetPassword />)

      expect(screen.queryByText(/invalid link/i)).not.toBeInTheDocument()
      expect(screen.getByText(/reset your password/i)).toBeInTheDocument()
    })

    it('should not show toast when token exists in URL', () => {
      mockRouter.query = { token: 'valid-token' }
      mockRouter.isReady = true

      render(<ResetPassword />)

      expect(mockShowToast).not.toHaveBeenCalled()
    })
  })

  describe('Password Validation', () => {
    it('should show error when passwords do not match', async () => {
      mockRouter.query = { token: 'test-token' }
      mockRouter.isReady = true

      render(<ResetPassword />)

      const newPasswordInput = screen.getByLabelText('New Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      fireEvent.change(newPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'differentpassword' } })

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
      })
    })

    it('should clear error when passwords match', async () => {
      mockRouter.query = { token: 'test-token' }
      mockRouter.isReady = true

      render(<ResetPassword />)

      const newPasswordInput = screen.getByLabelText('New Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      // First mismatch
      fireEvent.change(newPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'different' } })

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
      })

      // Fix mismatch
      fireEvent.change(confirmPasswordInput, { target: { value: '' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })

      await waitFor(() => {
        expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument()
      })
    })

    it('should disable submit button when passwords do not match', async () => {
      mockRouter.query = { token: 'test-token' }
      mockRouter.isReady = true

      render(<ResetPassword />)

      const newPasswordInput = screen.getByLabelText('New Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      fireEvent.change(newPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'different' } })

      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })
    })
  })

  describe('Password Reset Submission', () => {
    it('should successfully reset password with valid credentials', async () => {
      mockRouter.query = { token: 'valid-token-123' }
      mockRouter.isReady = true
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Password has been reset successfully.',
        }),
      })

      render(<ResetPassword />)

      const newPasswordInput = screen.getByLabelText('New Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpassword123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: 'valid-token-123',
            newPassword: 'newpassword123',
          }),
        })
      })

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.stringContaining('Password reset successful'),
          'success'
        )
      })

      // Should redirect after delay
      await waitFor(
        () => {
          expect(mockPush).toHaveBeenCalledWith('/auth')
        },
        { timeout: 2500 }
      )
    })

    it('should show error for expired token', async () => {
      mockRouter.query = { token: 'expired-token' }
      mockRouter.isReady = true
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Password reset token has expired. Please request a new one.',
        }),
      })

      render(<ResetPassword />)

      const newPasswordInput = screen.getByLabelText('New Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpassword123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          'Password reset token has expired. Please request a new one.',
          'error'
        )
      })

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should show error for invalid token', async () => {
      mockRouter.query = { token: 'invalid-token' }
      mockRouter.isReady = true
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Invalid or expired password reset token',
        }),
      })

      render(<ResetPassword />)

      const newPasswordInput = screen.getByLabelText('New Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpassword123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          'Invalid or expired password reset token',
          'error'
        )
      })
    })

    it('should prevent submission with password mismatch', async () => {
      mockRouter.query = { token: 'test-token' }
      mockRouter.isReady = true

      render(<ResetPassword />)

      const newPasswordInput = screen.getByLabelText('New Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      fireEvent.change(newPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'different' } })

      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })

      fireEvent.click(submitButton)

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should handle network errors gracefully', async () => {
      mockRouter.query = { token: 'test-token' }
      mockRouter.isReady = true
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      render(<ResetPassword />)

      const newPasswordInput = screen.getByLabelText('New Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpassword123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('An error occurred. Please try again.', 'error')
      })

      consoleErrorSpy.mockRestore()
    })

    it('should show loading state during submission', async () => {
      mockRouter.query = { token: 'test-token' }
      mockRouter.isReady = true

      let resolvePromise: (value: { ok: boolean; json: () => Promise<unknown> }) => void
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      ;(global.fetch as jest.Mock).mockReturnValueOnce(fetchPromise)

      render(<ResetPassword />)

      const newPasswordInput = screen.getByLabelText('New Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpassword123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/resetting password/i)).toBeInTheDocument()
        expect(submitButton).toBeDisabled()
      })

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true, message: 'Success' }),
      })

      await waitFor(() => {
        expect(screen.queryByText(/resetting password/i)).not.toBeInTheDocument()
      })
    })

    it('should clear form after successful reset', async () => {
      mockRouter.query = { token: 'valid-token' }
      mockRouter.isReady = true
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Password has been reset successfully.',
        }),
      })

      render(<ResetPassword />)

      const newPasswordInput = screen.getByLabelText('New Password') as HTMLInputElement
      const confirmPasswordInput = screen.getByLabelText(
        /confirm new password/i
      ) as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpassword123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(newPasswordInput.value).toBe('')
        expect(confirmPasswordInput.value).toBe('')
      })
    })
  })

  describe('Navigation', () => {
    it('should have Sign in link that redirects to auth page', () => {
      mockRouter.query = { token: 'test-token' }
      mockRouter.isReady = true

      render(<ResetPassword />)

      const signInButton = screen.getByRole('button', { name: /sign in/i })
      fireEvent.click(signInButton)

      expect(mockPush).toHaveBeenCalledWith('/auth')
    })
  })

  describe('Accessibility', () => {
    it('should have proper labels for form inputs', () => {
      mockRouter.query = { token: 'test-token' }
      mockRouter.isReady = true

      render(<ResetPassword />)

      expect(screen.getByLabelText('New Password')).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
    })

    it('should have proper ARIA attributes for error state', async () => {
      mockRouter.query = { token: 'test-token' }
      mockRouter.isReady = true

      render(<ResetPassword />)

      const newPasswordInput = screen.getByLabelText('New Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      fireEvent.change(newPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'different' } })

      await waitFor(() => {
        const errorMessage = screen.getByText(/passwords do not match/i)
        expect(errorMessage).toBeInTheDocument()
        expect(confirmPasswordInput).toHaveClass('input-error')
      })
    })
  })
})
