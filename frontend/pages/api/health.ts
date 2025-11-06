import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Make request from frontend container to backend container
    // Using the config for backend URL
    const backendUrl = `${config.backendInternalUrl}/health`

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (response.ok) {
      res.status(200).json({
        success: true,
        data: data,
        message: 'Health check successful',
      })
    } else {
      res.status(response.status).json({
        success: false,
        error: `Backend responded with error: ${response.status} ${response.statusText}`,
        data: data,
      })
    }
  } catch (error) {
    console.error('Health check failed:', error)
    res.status(500).json({
      success: false,
      error: `Failed to connect to backend: ${error instanceof Error ? error.message : 'Unknown error'}`,
      message: 'Backend container may not be running or accessible',
    })
  }
}
