import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  // Only allow in test environment
  if (!config.isTest) {
    return res.status(403).json({
      success: false,
      error: 'Test login endpoint is only available in test environment',
      debug: {
        NODE_ENV: process.env.NODE_ENV,
        isTest: config.isTest,
      },
    })
  }

  try {
    const backendUrl = `${config.backendInternalUrl}/api/auth/test-login`

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(req.body),
    })

    const data = await response.json()

    if (response.ok) {
      // Forward the Set-Cookie header from backend to client
      const setCookieHeader = response.headers.get('set-cookie')
      if (setCookieHeader) {
        res.setHeader('Set-Cookie', setCookieHeader)
      }

      res.status(200).json(data)
    } else {
      // Pass through the backend response directly
      res.status(response.status).json(data)
    }
  } catch (error) {
    console.error('Test login failed:', error)
    res.status(500).json({
      success: false,
      error: `Failed to login: ${error instanceof Error ? error.message : 'Unknown error'}`,
      message: 'Backend container may not be running or accessible',
    })
  }
}
