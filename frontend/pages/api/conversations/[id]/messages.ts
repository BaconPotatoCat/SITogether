import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (!id || typeof id !== 'string')
    return res.status(400).json({ success: false, error: 'Invalid id' })

  try {
    const backendUrl = `${config.backendInternalUrl}/api/conversations/${id}/messages`
    const token = req.cookies.token
    const csrfToken = req.headers['x-csrf-token']
    const sid = req.cookies.sid

    const headers: HeadersInit = {
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

    if (req.method === 'GET') {
      const response = await fetch(backendUrl, { method: 'GET', headers })
      const data = await response.json()
      return res.status(response.status).json(data)
    }

    if (req.method === 'POST') {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body),
      })
      const data = await response.json()
      return res.status(response.status).json(data)
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (error) {
    console.error('Conversation messages proxy error:', error)
    res.status(500).json({ success: false, error: 'Failed to process request' })
  }
}
