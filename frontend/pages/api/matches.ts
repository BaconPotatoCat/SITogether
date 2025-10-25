import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_INTERNALURL || 'http://localhost:5000'

  if (req.method === 'GET') {
    try {
      const { userId, status, check, userId1, userId2 } = req.query

      // Check match status endpoint
      if (check === 'true' && userId1 && userId2) {
        const response = await fetch(`${backendUrl}/api/matches/check?userId1=${userId1}&userId2=${userId2}`, {
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
        return
      }

      // Get matches for a user
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId query parameter is required'
        })
      }

      const statusParam = status ? `?status=${status}` : ''
      const response = await fetch(`${backendUrl}/api/matches/${userId}${statusParam}`, {
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
      console.error('Matches fetch failed:', error)
      res.status(500).json({
        success: false,
        error: `Failed to fetch matches: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  } else if (req.method === 'POST') {
    try {
      const { userId1, userId2, action } = req.body

      if (!userId1 || !userId2 || !action) {
        return res.status(400).json({
          success: false,
          error: 'userId1, userId2, and action are required'
        })
      }

      const response = await fetch(`${backendUrl}/api/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId1, userId2, action })
      })

      const data = await response.json()

      if (response.ok) {
        res.status(response.status).json(data)
      } else {
        res.status(response.status).json(data)
      }
    } catch (error) {
      console.error('Match creation failed:', error)
      res.status(500).json({
        success: false,
        error: `Failed to create match: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}

