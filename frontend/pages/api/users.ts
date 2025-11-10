import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const backendUrl = `${config.backendInternalUrl}/api/users`

    // Get token from cookie
    const token = req.cookies.token

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const data = await response.json()

    if (response.ok) {
      res.status(200).json(data)
    } else {
      res.status(response.status).json(data)
    }
  } catch (error: unknown) {
    console.error('Failed to fetch users:', error)

    // Handle timeout specifically
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Users API timeout - backend unreachable')
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable',
        message: 'Backend service is not responding',
      })
    }

    res.status(500).json({
      success: false,
      error: `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`,
      message: 'Backend container may not be running or accessible',
    })
  }
}
