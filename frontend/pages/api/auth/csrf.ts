import type { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const backendUrl = `${config.backendInternalUrl}/api/auth/csrf`

    // Call backend to generate a CSRF token and session
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Forward Set-Cookie headers from backend to client (sid, XSRF-TOKEN)
    // Node 18+ fetch returns Headers object; use getSetCookie() for multiple Set-Cookie
    const setCookies =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie')].filter(Boolean)

    if (setCookies.length > 0) {
      res.setHeader('Set-Cookie', setCookies as string[])
    }

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (error) {
    console.error('CSRF proxy error:', error)
    return res.status(500).json({ success: false, error: 'Failed to obtain CSRF token' })
  }
}
