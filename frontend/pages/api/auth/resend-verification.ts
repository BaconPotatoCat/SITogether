import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { email } = req.body

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required',
    })
  }

  try {
    // Use internal Docker URL to communicate with backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_INTERNALURL
    const response = await fetch(`${backendUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    const data = await response.json()

    // Forward the response from backend
    return res.status(response.status).json(data)
  } catch (error) {
    console.error('Resend verification proxy error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to resend verification email',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
