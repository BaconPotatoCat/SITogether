import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Call the backend API to get all users and return the first one
    const backendUrl = process.env.BACKEND_URL || 'http://sitogether-backend:5000'
    const response = await fetch(`${backendUrl}/api/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`)
    }

    const result = await response.json()

    if (result.success && result.data && result.data.length > 0) {
      // Return the first user from the list
      const firstUser = result.data[0]
      res.status(200).json({
        success: true,
        data: firstUser
      })
    } else {
      res.status(404).json({
        success: false,
        error: 'No confirmed users found'
      })
    }
  } catch (error) {
    console.error('Error fetching first user:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user from database'
    })
  }
}
