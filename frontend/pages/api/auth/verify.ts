import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { token } = req.query

  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Verification token is required',
    })
  }

  try {
    // Use internal Docker URL to communicate with backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_INTERNALURL

    const response = await fetch(`${backendUrl}/api/auth/verify?token=${encodeURIComponent(token)}`)

    const data = await response.json()

    // Forward the response from backend
    return res.status(response.status).json(data)
  } catch (error) {
    console.error('Verification proxy error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to verify email',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
