import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const backendUrl = `${config.backendInternalUrl}/api/auth/logout`

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    const data = await response.json()

    // Forward all Set-Cookie headers from backend (clears token, sid, XSRF-TOKEN)
    const setCookies =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie')].filter(Boolean)

    // Also explicitly clear any cookies that might not have been cleared by backend
    const cookiesToClear = [
      'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly; SameSite=Lax',
      'XSRF-TOKEN=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax',
      'sid=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly; SameSite=Lax',
    ]

    const allCookies = [...setCookies, ...cookiesToClear]
    res.setHeader('Set-Cookie', allCookies as string[])

    res.status(200).json(data)
  } catch (error) {
    console.error('Logout failed:', error)
    res.status(500).json({
      success: false,
      error: `Failed to logout: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  }
}
