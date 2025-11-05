import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    // Get authentication token from cookies
    const token = req.cookies.token

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    // Select backend URL based on environment
    const baseUrl =
      process.env.NEXT_PUBLIC_BACKEND_EXTERNALURL ||
      process.env.NEXT_PUBLIC_BACKEND_INTERNALURL ||
      'http://localhost:5000'
    const backendUrl = `${baseUrl}/api/auth/reset-password-request`

    // Forward request to backend
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${token}`,
      },
    })

    const data = await response.json()

    // Forward response from backend
    return res.status(response.status).json(data)
  } catch (error) {
    console.error('Reset password request error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to request password reset',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
