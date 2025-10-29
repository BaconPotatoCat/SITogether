import type { NextApiRequest } from 'next'

// Utility function to make authenticated API calls (client-side)
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const defaultOptions: RequestInit = {
    ...options,
    credentials: 'include', // Include cookies in requests
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, defaultOptions)

    // If unauthorized, redirect to login
    if (response.status === 401) {
      window.location.href = '/auth'
      throw new Error('Unauthorized')
    }

    return response
  } catch (error) {
    throw error
  }
}

// Utility function to make authenticated API calls from server-side (SSR/API routes)
export const fetchWithAuthSSR = async (
  req: NextApiRequest,
  url: string,
  options: RequestInit = {}
) => {
  // Get token from request cookies
  const token = req.cookies?.token

  // Build headers with authentication
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  // Forward authentication token if present
  if (token) {
    headers['Cookie'] = `token=${token}`
  }

  const defaultOptions: RequestInit = {
    ...options,
    headers,
  }

  try {
    const response = await fetch(url, defaultOptions)
    return response
  } catch (error) {
    throw error
  }
}
