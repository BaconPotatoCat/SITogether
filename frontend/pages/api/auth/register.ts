import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BACKEND_EXTERNALURL ||
      process.env.NEXT_PUBLIC_BACKEND_INTERNALURL ||
      'http://localhost:5000'
    const backendUrl = `${baseUrl}/api/auth/register`

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    })

    const data = await response.json()

    if (response.ok) {
      res.status(201).json({
        success: true,
        data: data.data,
        message: data.message || 'Registration successful',
      })
    } else {
      // Pass through the backend response directly
      res.status(response.status).json(data)
    }
  } catch (error) {
    console.error('Registration failed:', error)
    res.status(500).json({
      success: false,
      error: `Failed to register: ${error instanceof Error ? error.message : 'Unknown error'}`,
      message: 'Backend container may not be running or accessible',
    })
  }
}
