import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { userId } = req.query
    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_INTERNALURL}/api/likes/check/${userId}`

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
    console.error('Failed to check like status:', error)
    res.status(500).json({
      success: false,
      error: `Failed to check like status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      message: 'Backend container may not be running or accessible',
    })
  }
}
