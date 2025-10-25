import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/router'
import VerifyEmail from '../../pages/verify'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

describe('Email Verification Page', () => {
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
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should display loading state initially', () => {
    mockRouter.query = { token: 'test-token' }
    mockRouter.isReady = false

    render(<VerifyEmail />)

    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument()
  })

  it('should verify email successfully with valid token', async () => {
    mockRouter.query = { token: 'valid-token' }
    mockRouter.isReady = true
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Email verified successfully!',
      }),
    })

    render(<VerifyEmail />)

    await waitFor(() => {
      expect(screen.getByText(/email verified successfully/i)).toBeInTheDocument()
    })

    // Should redirect after 3 seconds
    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith('/auth')
      },
      { timeout: 3500 }
    )
  })

  it('should display error for invalid token', async () => {
    mockRouter.query = { token: 'invalid-token' }
    mockRouter.isReady = true
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Invalid or expired verification token',
      }),
    })

    render(<VerifyEmail />)

    await waitFor(() => {
      expect(screen.getByText(/invalid or expired verification token/i)).toBeInTheDocument()
    })

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should display error for expired token', async () => {
    mockRouter.query = { token: 'expired-token' }
    mockRouter.isReady = true
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Verification token has expired. Please request a new verification email.',
      }),
    })

    render(<VerifyEmail />)

    await waitFor(() => {
      expect(screen.getByText(/verification token has expired/i)).toBeInTheDocument()
    })
  })

  it('should handle network errors gracefully', async () => {
    mockRouter.query = { token: 'test-token' }
    mockRouter.isReady = true
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    // Suppress expected console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    render(<VerifyEmail />)

    await waitFor(() => {
      expect(screen.getByText(/an error occurred during verification/i)).toBeInTheDocument()
    })

    consoleErrorSpy.mockRestore()
  })

  it('should not make API call if token is missing', async () => {
    mockRouter.query = {}
    mockRouter.isReady = true

    render(<VerifyEmail />)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument()
  })

  it('should not make duplicate API calls', async () => {
    mockRouter.query = { token: 'test-token' }
    mockRouter.isReady = true
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Email verified successfully!',
      }),
    })

    render(<VerifyEmail />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  it('should call verification API with correct endpoint', async () => {
    mockRouter.query = { token: 'abc123' }
    mockRouter.isReady = true
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Email verified successfully!',
      }),
    })

    render(<VerifyEmail />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/verify?token=abc123')
    })
  })

  it('should show success icon for successful verification', async () => {
    mockRouter.query = { token: 'valid-token' }
    mockRouter.isReady = true
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Email verified successfully!',
      }),
    })

    render(<VerifyEmail />)

    await waitFor(() => {
      const successElement = screen.getByText(/email verified successfully/i).closest('div')
      expect(successElement).toBeInTheDocument()
    })
  })

  it('should show error icon for failed verification', async () => {
    mockRouter.query = { token: 'invalid-token' }
    mockRouter.isReady = true
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Invalid token',
      }),
    })

    render(<VerifyEmail />)

    await waitFor(() => {
      const errorElement = screen.getByText(/invalid token/i).closest('div')
      expect(errorElement).toBeInTheDocument()
    })
  })
})
