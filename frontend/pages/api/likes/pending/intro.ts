import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[pending-intro] Route hit:', req.method, req.url)

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const backendUrl = `${config.backendInternalUrl}/api/likes/pending-intro`
    console.log('[pending-intro] Backend URL:', backendUrl)

    // Get token from cookie
    const token = req.cookies.token

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
    })

    const data = await response.json()

    if (response.ok) {
      res.status(200).json(data)
    } else {
      res.status(response.status).json(data)
    }
  } catch (error) {
    console.error('Failed to get pending intro likes:', error)
    res.status(500).json({
      success: false,
      error: `Failed to get pending intro likes: ${error instanceof Error ? error.message : 'Unknown error'}`,
      message: 'Backend container may not be running or accessible',
    })
  }
}
