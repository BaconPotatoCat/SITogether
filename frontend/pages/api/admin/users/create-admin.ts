import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const baseUrl = config.backendInternalUrl

    // Get token and CSRF token from cookies
    const token = req.cookies.token
    const csrfToken = req.headers['x-csrf-token']
    const sid = req.cookies.sid

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      })
    }

    // Build headers with CSRF token
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Forward CSRF token if present
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken as string
    }

    // Forward cookies (token and session cookie)
    let cookieHeader = ''
    if (token) cookieHeader += `token=${token}; `
    if (sid) cookieHeader += `sid=${sid}; `
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader.trim()
    }

    // Forward the request to the backend
    const response = await fetch(`${baseUrl}/api/admin/users/create-admin`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    return res.status(response.status).json(data)
  } catch (error) {
    console.error('Create admin API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create admin account',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
