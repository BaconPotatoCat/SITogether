import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const backendUrl = `${config.backendInternalUrl}/api/auth/admin-check`

    // Get token from cookie
    const token = req.cookies.token

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    // Forward request to backend with cookie
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${token}`,
      },
    })

    const data = await response.json()

    // Return the same status code from backend
    return res.status(response.status).json(data)
  } catch (error) {
    console.error('Admin check failed:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to check admin status',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
