import type { NextApiRequest, NextApiResponse } from 'next'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { id } = req.query

  try {
    const backendUrl = process.env.BACKEND_URL || 'http://sitogether-backend:5000'

    if (req.method === 'GET') {
      // Call backend API to get user by ID
      const response = await fetch(`${backendUrl}/api/users/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({
            success: false,
            error: 'User not found'
          })
        }
        throw new Error(`Backend API error: ${response.status}`)
      }

      const result = await response.json()
      res.status(200).json(result)
    } else if (req.method === 'PUT') {
      const { name, age, course, bio, interests } = req.body

      // Validate required fields
      if (!name || !age) {
        return res.status(400).json({
          success: false,
          error: 'Name and age are required'
        })
      }

      // Call backend API to update user
      const response = await fetch(`${backendUrl}/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          age: parseInt(age),
          course: course || null,
          bio: bio || null,
          interests: Array.isArray(interests) ? interests : []
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Backend API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      res.status(200).json(result)
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

export default handler
