import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_INTERNALURL}/api/auth/login`
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(req.body)
    })

    const data = await response.json()

    if (response.ok) {
      // Forward the Set-Cookie header from backend to client
      const setCookieHeader = response.headers.get('set-cookie')
      if (setCookieHeader) {
        res.setHeader('Set-Cookie', setCookieHeader)
      }

      res.status(200).json({
        success: true,
        message: data.message || 'Login successful'
      })
    } else {
      // Pass through the backend response directly
      res.status(response.status).json(data)
    }
  } catch (error) {
    console.error('Login failed:', error)
    res.status(500).json({
      success: false,
      error: `Failed to login: ${error instanceof Error ? error.message : 'Unknown error'}`,
      message: 'Backend container may not be running or accessible'
    })
  }
}
