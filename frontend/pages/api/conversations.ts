import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_INTERNALURL || 'http://localhost:5000'
  
  if (req.method === 'GET') {
    try {
      const { userId } = req.query

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId query parameter is required'
        })
      }

      const response = await fetch(`${backendUrl}/api/conversations/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        res.status(200).json(data)
      } else {
        res.status(response.status).json(data)
      }
    } catch (error) {
      console.error('Conversations fetch failed:', error)
      res.status(500).json({
        success: false,
        error: `Failed to fetch conversations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  } else if (req.method === 'POST') {
    try {
      const { userId1, userId2 } = req.body

      if (!userId1 || !userId2) {
        return res.status(400).json({
          success: false,
          error: 'Both userId1 and userId2 are required'
        })
      }

      const response = await fetch(`${backendUrl}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId1, userId2 })
      })

      const data = await response.json()

      if (response.ok) {
        res.status(response.status).json(data)
      } else {
        res.status(response.status).json(data)
      }
    } catch (error) {
      console.error('Conversation creation failed:', error)
      res.status(500).json({
        success: false,
        error: `Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}



