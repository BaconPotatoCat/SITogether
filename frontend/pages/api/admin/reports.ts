import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BACKEND_EXTERNALURL ||
      process.env.NEXT_PUBLIC_BACKEND_INTERNALURL ||
      'http://localhost:5000'
    const backendUrl = `${baseUrl}/api/admin/reports`
    
    // Get token from cookies
    const token = req.cookies.token

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { status } = req.query
    const queryParams = status ? `?status=${status}` : ''

    // Forward the request to the backend
    const response = await fetch(`${backendUrl}${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    return res.status(200).json(data)
  } catch (error) {
    console.error('Admin reports API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}


