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

    // Clear the cookie on the frontend
    res.setHeader('Set-Cookie', 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;')

    res.status(200).json(data)
  } catch (error) {
    console.error('Logout failed:', error)
    res.status(500).json({
      success: false,
      error: `Failed to logout: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  }
}
