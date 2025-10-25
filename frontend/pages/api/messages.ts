import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_INTERNALURL || 'http://localhost:5000'

  if (req.method === 'GET') {
    try {
      const { conversationId } = req.query

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: 'conversationId query parameter is required'
        })
      }

      const response = await fetch(`${backendUrl}/api/conversations/${conversationId}/messages`, {
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
      console.error('Messages fetch failed:', error)
      res.status(500).json({
        success: false,
        error: `Failed to fetch messages: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  } else if (req.method === 'POST') {
    try {
      const { conversationId, senderId, receiverId, content } = req.body

      if (!conversationId || !senderId || !receiverId || !content) {
        return res.status(400).json({
          success: false,
          error: 'conversationId, senderId, receiverId, and content are required'
        })
      }

      const response = await fetch(`${backendUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationId, senderId, receiverId, content })
      })

      const data = await response.json()

      if (response.ok) {
        res.status(response.status).json(data)
      } else {
        res.status(response.status).json(data)
      }
    } catch (error) {
      console.error('Message send failed:', error)
      res.status(500).json({
        success: false,
        error: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}



