import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BACKEND_EXTERNALURL ||
      process.env.NEXT_PUBLIC_BACKEND_INTERNALURL ||
      'http://localhost:5000'
    
    // Get token from cookies
    const token = req.cookies.token

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { userId, action } = req.body

    if (!userId || !action) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and action are required' 
      })
    }

    let endpoint = ''
    switch (action) {
      case 'ban':
        endpoint = `/api/admin/users/${userId}/ban`
        break
      case 'unban':
        endpoint = `/api/admin/users/${userId}/unban`
        break
      case 'reset-password':
        endpoint = `/api/admin/users/${userId}/reset-password`
        break
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid action' 
        })
    }

    // Forward the request to the backend
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
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
    console.error('Admin user action API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to perform action',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}


