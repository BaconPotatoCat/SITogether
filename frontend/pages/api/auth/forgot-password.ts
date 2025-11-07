import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const backendUrl = `${config.backendInternalUrl}/api/auth/forgot-password`

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    })

    const data = await response.json()

    // Pass through the backend response
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Forgot password request failed:', error)
    res.status(500).json({
      success: false,
      error: `Failed to process request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      message: 'Backend container may not be running or accessible',
    })
  }
}
