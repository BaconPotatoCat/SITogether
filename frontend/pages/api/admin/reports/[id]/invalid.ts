import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../../../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const baseUrl = config.backendInternalUrl
    const { id } = req.query

    // Strict validation for report ID: allow only UUID or alphanumeric (adjust if needed)
    const safeIdPattern = /^[a-zA-Z0-9-]+$/
    if (!id || typeof id !== 'string' || !safeIdPattern.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Report ID',
      })
    }

    // Get token and CSRF token from cookies
    const token = req.cookies.token
    const csrfToken = req.headers['x-csrf-token']
    const sid = req.cookies.sid

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
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

    // Forward the request to the backend
    const response = await fetch(`${baseUrl}/api/admin/reports/${id}/invalid`, {
      method: 'POST',
      headers,
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    return res.status(200).json(data)
  } catch (error) {
    console.error('Admin invalid report API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to mark report as invalid',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
