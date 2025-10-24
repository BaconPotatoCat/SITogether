import { fetchWithAuth } from '../../utils/api'

// Mock window.location
delete (window as any).location
window.location = { href: '' } as any

describe('fetchWithAuth', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
    window.location.href = ''
    document.cookie = ''
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should make a fetch request with credentials included', async () => {
    const mockResponse = {
      status: 200,
      json: async () => ({ data: 'test' }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    await fetchWithAuth('/api/test')

    expect(global.fetch).toHaveBeenCalledWith('/api/test', {
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
})
