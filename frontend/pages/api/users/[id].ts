import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchWithAuthSSR } from '../../../utils/api'

interface UpdateUserPayload {
  name: string
  age: number
  course: string | null
  bio: string | null
  interests: string[]
  avatarUrl?: string
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { id } = req.query

  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_INTERNALURL

    if (!backendUrl) {
      console.error('NEXT_PUBLIC_BACKEND_INTERNALURL environment variable is not set')
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
      })
    }

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
            error: 'User not found',
          })
        }

        // Try to get error details from backend
        const errorText = await response.text()
        console.error(`Backend API error (${response.status}):`, errorText)

        return res.status(response.status).json({
          success: false,
          error: `Backend API error: ${response.status}`,
          details: errorText,
        })
      }

      const result = await response.json()
      res.status(200).json(result)
    } else if (req.method === 'PUT') {
      const { name, age, course, bio, interests, avatarUrl } = req.body

      // Validate required fields
      if (!name || !age) {
        return res.status(400).json({
          success: false,
          error: 'Name and age are required',
        })
      }

      // Prepare update payload
      const updatePayload: UpdateUserPayload = {
        name,
        age: parseInt(age),
        course: course || null,
        bio: bio || null,
        interests: Array.isArray(interests) ? interests : [],
      }

      // Only include avatarUrl if provided
      if (avatarUrl !== undefined) {
        updatePayload.avatarUrl = avatarUrl
      }

      // Call backend API to update user (with authentication)
      const response = await fetchWithAuthSSR(req, `${backendUrl}/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
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
      error: 'Internal server error',
    })
  }
}

export default handler
