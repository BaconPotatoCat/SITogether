import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Get token from cookie
    const token = req.cookies.token

    if (!token) {
      return res.status(200).json({ session: null })
    }

    // Verify token with backend
    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_INTERNALURL}/api/auth/session`
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    })

    const data = await response.json()

    if (response.ok && data.success) {
      // Calculate token expiration (1 hour from now)
      const expires = new Date()
      expires.setTime(expires.getTime() + (60 * 60 * 1000))

      res.status(200).json({
        session: {
          user: data.user,
          expires: expires.toISOString()
        }
      })
    } else {
      res.status(200).json({ session: null })
    }
  } catch (error) {
    console.error('Session check failed:', error)
    res.status(200).json({ session: null })
  }
}

