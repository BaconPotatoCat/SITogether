import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const backendUrl = `${config.backendInternalUrl}/api/reports`

    // Get token from cookies
    const token = req.cookies.token

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { reportedId, reason, description } = req.body

    if (!reportedId || !reason) {
      return res.status(400).json({ success: false, error: 'reportedId and reason are required' })
    }

    // Read CSRF token header from client request (set by fetchWithAuth)
    const csrfTokenHeader = (req.headers['x-csrf-token'] || req.headers['X-CSRF-Token']) as
      | string
      | undefined

    // Gather cookies to forward to backend (JWT token + session id for CSRF validation)
    const sid = req.cookies.sid
    const cookieHeader = sid ? `token=${token}; sid=${sid}` : `token=${token}`

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        ...(csrfTokenHeader ? { 'x-csrf-token': csrfTokenHeader } : {}),
      },
      body: JSON.stringify({ reportedId, reason, description }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    return res.status(201).json(data)
  } catch (error) {
    console.error('Reports API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create report',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
