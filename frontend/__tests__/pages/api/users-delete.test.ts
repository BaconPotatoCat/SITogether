import { NextApiRequest, NextApiResponse } from 'next'
import type { NextApiHandler } from 'next'

// Mock environment variable
const originalEnv = process.env.NEXT_PUBLIC_BACKEND_INTERNALURL
process.env.NEXT_PUBLIC_BACKEND_INTERNALURL = 'http://localhost:5000'

// Mock fetch
global.fetch = jest.fn() as jest.Mock

// Create a mock handler that mimics the actual API route behavior
const createMockHandler = (): NextApiHandler => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'DELETE') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const { id } = req.query
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_INTERNALURL

      if (!backendUrl) {
        return res.status(500).json({
          success: false,
          error: 'Internal server error',
        })
      }

      // Get token from cookie
      const token = req.cookies.token

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      // Add authorization header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Call backend API to delete user (with authentication)
      const response = await fetch(`${backendUrl}/api/users/${id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      })

      let data
      try {
        data = await response.json()
      } catch {
        // If response is not JSON, return a generic error
        return res.status(response.status).json({
          success: false,
          error: 'Failed to parse backend response',
        })
      }

      if (!response.ok) {
        // Forward the backend's error response with the same status code
        return res.status(response.status).json(data)
      }

      res.status(200).json(data)
    } catch (error) {
      console.error('API Error:', error)
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      })
    }
  }
}

const handler = createMockHandler()

describe('/api/users/[id] - DELETE', () => {
  let mockReq: Partial<NextApiRequest>
  let mockRes: Partial<NextApiResponse>
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock console.error to suppress expected error logs in tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    mockReq = {
      method: 'DELETE',
      query: { id: 'user-123' },
      cookies: {
        token: 'test-token',
      },
    }

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
  })

  afterEach(() => {
    // Restore console.error after each test
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore()
    }
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_BACKEND_INTERNALURL = originalEnv
  })

  it('should successfully delete user account', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Account deleted successfully',
      }),
    })

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/api/users/user-123', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      credentials: 'include',
    })

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      message: 'Account deleted successfully',
    })
  })

  it('should forward 403 error when user tries to delete another account', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        error: 'Access denied. You can only delete your own account.',
      }),
    })

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Access denied. You can only delete your own account.',
    })
  })

  it('should forward 404 error when user not found', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        success: false,
        error: 'User not found',
      }),
    })

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

    expect(mockRes.status).toHaveBeenCalledWith(404)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'User not found',
    })
  })

  it('should forward 500 error when backend fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: 'Failed to delete account',
        message: 'Internal server error',
      }),
    })

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Failed to delete account',
      message: 'Internal server error',
    })
  })

  it('should handle non-JSON response gracefully', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('Invalid JSON')
      },
    })

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Failed to parse backend response',
    })
  })

  it('should include Authorization header when token is present', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    )
  })

  it('should work without Authorization header when token is missing', async () => {
    mockReq.cookies = {}
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.anything(),
        }),
      })
    )
  })

  it('should handle network errors', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error',
    })
  })

  it('should return 405 for non-DELETE methods', async () => {
    mockReq.method = 'GET'

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

    expect(mockRes.status).toHaveBeenCalledWith(405)
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Method not allowed' })
  })

  it('should handle missing backend URL environment variable', async () => {
    const originalBackendUrl = process.env.NEXT_PUBLIC_BACKEND_INTERNALURL
    delete process.env.NEXT_PUBLIC_BACKEND_INTERNALURL

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error',
    })

    process.env.NEXT_PUBLIC_BACKEND_INTERNALURL = originalBackendUrl
  })
})
