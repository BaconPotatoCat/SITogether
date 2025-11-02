import handler from '../../../../pages/api/auth/change-password'
import { fetchWithAuthSSR } from '../../../../utils/api'
import type { NextApiRequest, NextApiResponse } from 'next'

// Mock the API utility
jest.mock('../../../../utils/api', () => ({
  fetchWithAuthSSR: jest.fn(),
}))

// Mock environment variable
const originalEnv = process.env

describe('/api/auth/change-password', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_BACKEND_INTERNALURL: 'http://localhost:5000',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // Helper function to create mock request/response
  const createMockReqRes = (overrides: Partial<NextApiRequest> = {}) => {
    const req = {
      method: 'POST',
      body: {},
      cookies: {},
      query: {},
      ...overrides,
    } as NextApiRequest

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    } as unknown as NextApiResponse

    return { req, res }
  }

  it('should return 405 for non-POST requests', async () => {
    const { req, res } = createMockReqRes({ method: 'GET' })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.json).toHaveBeenCalledWith({ message: 'Method not allowed' })
  })

  it('should return 400 when current password is missing', async () => {
    const { req, res } = createMockReqRes({
      body: {
        newPassword: 'newpass123',
      },
    })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Current password and new password are required',
    })
  })

  it('should return 400 when new password is missing', async () => {
    const { req, res } = createMockReqRes({
      body: {
        currentPassword: 'oldpass123',
      },
    })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Current password and new password are required',
    })
  })

  it('should return 400 when new password is too short', async () => {
    const { req, res } = createMockReqRes({
      body: {
        currentPassword: 'oldpass123',
        newPassword: '12345', // Less than 6 characters
      },
    })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'New password must be at least 6 characters long',
    })
  })

  it('should successfully change password', async () => {
    const mockBackendResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Password changed successfully',
      }),
    }

    ;(fetchWithAuthSSR as jest.Mock).mockResolvedValue(mockBackendResponse)

    const { req, res } = createMockReqRes({
      body: {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
      },
      cookies: {
        token: 'test-token',
      },
    })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Password changed successfully',
    })

    expect(fetchWithAuthSSR).toHaveBeenCalledWith(
      req,
      'http://localhost:5000/api/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'oldpass123',
          newPassword: 'newpass123',
        }),
      }
    )
  })

  it('should handle backend 401 error (wrong current password)', async () => {
    const mockBackendResponse = {
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: 'Current password is incorrect',
      }),
    }

    ;(fetchWithAuthSSR as jest.Mock).mockResolvedValue(mockBackendResponse)

    const { req, res } = createMockReqRes({
      body: {
        currentPassword: 'wrongpass',
        newPassword: 'newpass123',
      },
      cookies: {
        token: 'test-token',
      },
    })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Current password is incorrect',
    })
  })

  it('should handle backend 400 error (validation)', async () => {
    const mockBackendResponse = {
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: 'New password must be at least 6 characters long',
      }),
    }

    ;(fetchWithAuthSSR as jest.Mock).mockResolvedValue(mockBackendResponse)

    const { req, res } = createMockReqRes({
      body: {
        currentPassword: 'oldpass123',
        newPassword: 'short', // Will be caught by backend validation
      },
      cookies: {
        token: 'test-token',
      },
    })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'New password must be at least 6 characters long',
    })
  })

  it('should handle backend 500 error', async () => {
    const mockBackendResponse = {
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: 'Internal server error',
      }),
    }

    ;(fetchWithAuthSSR as jest.Mock).mockResolvedValue(mockBackendResponse)

    const { req, res } = createMockReqRes({
      body: {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
      },
      cookies: {
        token: 'test-token',
      },
    })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error',
    })
  })

  it('should handle fetch errors gracefully', async () => {
    // Mock console.error to avoid noise in test output
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    ;(fetchWithAuthSSR as jest.Mock).mockRejectedValue(
      new Error('Backend container may not be running')
    )

    const { req, res } = createMockReqRes({
      body: {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
      },
      cookies: {
        token: 'test-token',
      },
    })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('Failed to change password'),
      message: 'Backend container may not be running or accessible',
    })

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Change password failed:', expect.any(Error))

    consoleErrorSpy.mockRestore()
  })

  it('should forward authentication cookie to backend', async () => {
    const mockBackendResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Password changed successfully',
      }),
    }

    ;(fetchWithAuthSSR as jest.Mock).mockResolvedValue(mockBackendResponse)

    const { req, res } = createMockReqRes({
      body: {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
      },
      cookies: {
        token: 'my-auth-token',
      },
    })

    await handler(req, res)

    expect(fetchWithAuthSSR).toHaveBeenCalledWith(req, expect.any(String), expect.any(Object))
    // Verify the request object (with cookie) is passed to fetchWithAuthSSR
    expect(req.cookies.token).toBe('my-auth-token')
  })
})
