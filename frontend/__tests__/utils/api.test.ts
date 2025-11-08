import { fetchWithAuth, fetchWithAuthSSR } from '../../utils/api'
import type { NextApiRequest } from 'next'

// Mock window.location
Object.defineProperty(window, 'location', {
  writable: true,
  value: { href: '' },
})

describe('fetchWithAuth', () => {
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(() => {
    global.fetch = jest.fn()
    window.location.href = ''
    document.cookie = ''
    // Suppress console.warn during tests
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    consoleWarnSpy.mockRestore()
  })

  it('should make a fetch request with credentials included', async () => {
    const mockResponse = {
      status: 200,
      json: async () => ({ data: 'test' }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await fetchWithAuth('/api/test')

    expect(global.fetch).toHaveBeenCalledWith('/api/test', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  })

  it('should merge custom headers with default headers', async () => {
    const mockResponse = {
      status: 200,
      json: async () => ({ data: 'test' }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await fetchWithAuth('/api/test', {
      headers: {
        'Custom-Header': 'value',
      },
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/test', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Custom-Header': 'value',
      },
    })
  })

  it('should redirect to /auth on 401 status', async () => {
    const mockResponse = {
      status: 401,
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await expect(fetchWithAuth('/api/test')).rejects.toThrow('Unauthorized')
    expect(window.location.href).toBe('/auth')
  })

  it('should return response for successful requests', async () => {
    const mockResponse = {
      status: 200,
      json: async () => ({ data: 'test' }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const response = await fetchWithAuth('/api/test')

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({ data: 'test' })
  })

  it('should pass through custom request options', async () => {
    const mockResponse = {
      status: 200,
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await fetchWithAuth('/api/test', {
      method: 'POST',
      body: JSON.stringify({ test: 'data' }),
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      body: JSON.stringify({ test: 'data' }),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  })

  it('should throw error on network failure', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    await expect(fetchWithAuth('/api/test')).rejects.toThrow('Network error')
  })

  describe('redirectOn401 option', () => {
    it('should not redirect on 401 when redirectOn401 is false', async () => {
      const mockResponse = {
        status: 401,
        json: async () => ({ error: 'Current password is incorrect' }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const response = await fetchWithAuth('/api/test', {}, false)

      expect(response.status).toBe(401)
      expect(window.location.href).toBe('') // Should not redirect
    })

    it('should redirect on 401 when redirectOn401 is true (default)', async () => {
      const mockResponse = {
        status: 401,
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      await expect(fetchWithAuth('/api/test')).rejects.toThrow('Unauthorized')
      expect(window.location.href).toBe('/auth')
    })

    it('should redirect on 401 when redirectOn401 is explicitly true', async () => {
      const mockResponse = {
        status: 401,
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      await expect(fetchWithAuth('/api/test', {}, true)).rejects.toThrow('Unauthorized')
      expect(window.location.href).toBe('/auth')
    })

    it('should return 401 response without redirect when redirectOn401 is false', async () => {
      const mockResponse = {
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const response = await fetchWithAuth('/api/test', { method: 'POST' }, false)

      expect(response.status).toBe(401)
      expect(window.location.href).toBe('')
      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })
  })
})

describe('fetchWithAuthSSR', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should make a fetch request with authentication cookie when token exists', async () => {
    const mockResponse = {
      status: 200,
      json: async () => ({ data: 'test' }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const mockReq = {
      cookies: {
        token: 'test-token-123',
      },
      headers: {},
    } as unknown as NextApiRequest

    await fetchWithAuthSSR(mockReq, 'http://localhost:5000/api/test', {
      method: 'POST',
      body: JSON.stringify({ test: 'data' }),
    })

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/api/test', {
      method: 'POST',
      body: JSON.stringify({ test: 'data' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'token=test-token-123;',
      },
    })
  })

  it('should make a fetch request without authentication cookie when token is missing', async () => {
    const mockResponse = {
      status: 200,
      json: async () => ({ data: 'test' }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const mockReq = {
      cookies: {},
      headers: {},
    } as unknown as NextApiRequest

    await fetchWithAuthSSR(mockReq, 'http://localhost:5000/api/test', {
      method: 'GET',
    })

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/api/test', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(callArgs.headers).not.toHaveProperty('Cookie')
  })

  it('should merge custom headers with default headers', async () => {
    const mockResponse = {
      status: 200,
      json: async () => ({ data: 'test' }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const mockReq = {
      cookies: {
        token: 'test-token',
      },
      headers: {},
    } as unknown as NextApiRequest

    await fetchWithAuthSSR(mockReq, 'http://localhost:5000/api/test', {
      headers: {
        'Custom-Header': 'value',
      },
    })

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/api/test', {
      headers: {
        'Content-Type': 'application/json',
        'Custom-Header': 'value',
        Cookie: 'token=test-token;',
      },
    })
  })

  it('should return response for successful requests', async () => {
    const mockResponse = {
      status: 200,
      json: async () => ({ data: 'test' }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const mockReq = {
      cookies: {},
      headers: {},
    } as unknown as NextApiRequest

    const response = await fetchWithAuthSSR(mockReq, 'http://localhost:5000/api/test')

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({ data: 'test' })
  })

  it('should handle fetch errors and rethrow them', async () => {
    const fetchError = new Error('Network error')
    ;(global.fetch as jest.Mock).mockRejectedValue(fetchError)

    const mockReq = {
      cookies: {
        token: 'test-token',
      },
      headers: {},
    } as unknown as NextApiRequest

    await expect(fetchWithAuthSSR(mockReq, 'http://localhost:5000/api/test')).rejects.toThrow(
      'Network error'
    )
  })

  it('should handle case when cookies object is undefined', async () => {
    const mockResponse = {
      status: 200,
      json: async () => ({ data: 'test' }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const mockReq = {
      cookies: undefined,
      headers: {},
    } as unknown as NextApiRequest

    await fetchWithAuthSSR(mockReq, 'http://localhost:5000/api/test')

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/api/test', {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(callArgs.headers).not.toHaveProperty('Cookie')
  })
})
