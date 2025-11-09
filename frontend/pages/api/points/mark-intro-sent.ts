import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const backendUrl = `${config.backendInternalUrl}/api/points/mark-intro-sent`

    // Get token and CSRF token from cookies
    const token = req.cookies.token
    const csrfToken = req.headers['x-csrf-token']
    const sid = req.cookies.sid

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Forward CSRF token if present
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken as string
    }

    // Forward cookies (including session cookie)
    let cookieHeader = ''
    if (token) cookieHeader += `token=${token}; `
    if (sid) cookieHeader += `sid=${sid}; `
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader.trim()
    }

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      credentials: 'include',
    })

    const data = await response.json()

    if (response.ok) {
      res.status(200).json(data)
    } else {
      res.status(response.status).json(data)
    }
  } catch (error) {
    console.error('Failed to mark intro as sent:', error)
    res.status(500).json({
      success: false,
      error: `Failed to mark intro as sent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      message: 'Backend container may not be running or accessible',
    })
  }
}
