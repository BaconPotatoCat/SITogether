import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Select backend URL based on environment
    const baseUrl =
      process.env.NEXT_PUBLIC_BACKEND_EXTERNALURL ||
      process.env.NEXT_PUBLIC_BACKEND_INTERNALURL ||
      'http://localhost:5000'
    const backendUrl = `${baseUrl}/api/auth/reset-password`

    // Get authentication token from cookies (required for reset-password)
    const token = req.cookies.token

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Cookie: `token=${token}`,
    }

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
      credentials: 'include',
    })

    const data = await response.json()

    // Pass through the backend response
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Reset password request failed:', error)
    res.status(500).json({
      success: false,
      error: `Failed to reset password: ${error instanceof Error ? error.message : 'Unknown error'}`,
      message: 'Backend container may not be running or accessible',
    })
  }
}
