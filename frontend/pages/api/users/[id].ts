import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchWithAuthSSR } from '../../../utils/api'
import { config as appConfig } from '../../../utils/config'

// Disable body parsing for this route to handle large payloads (10MB+)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

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
    const backendUrl = appConfig.backendInternalUrl

    if (!backendUrl) {
      console.error('Backend internal URL is not configured')
      return res.status(500).json({
        success: false,
        error: 'An error occurred. Please try again later.',
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

        // Log detailed error for debugging
        const errorText = await response.text()
        console.error(`Backend API error (${response.status}):`, errorText)

        // Return generic error message to user
        return res.status(500).json({
          success: false,
          error: 'An error occurred while processing your request',
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
          error: 'Invalid request. Please check your input.',
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
        // Log detailed error for debugging
        const errorText = await response.text()
        console.error(`Backend API error (${response.status}):`, errorText)
        // Throw generic error
        throw new Error('Backend API request failed')
      }

      const result = await response.json()
      res.status(200).json(result)
    } else if (req.method === 'DELETE') {
      // Get token and CSRF token from cookies
      const token = req.cookies.token
      const csrfToken = req.headers['x-csrf-token']
      const sid = req.cookies.sid

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      // Add authorization header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Forward CSRF token if present
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken as string
      }

      // Forward cookies (including session cookie)
      let cookieHeader = ''
      if (token) cookieHeader += `token=${token}; `
      if (sid) cookieHeader += `sid=${sid}; `
      if (cookieHeader) {
        headers['Cookie'] = cookieHeader.trim()
      }

      // Call backend API to delete user (with authentication)
      const response = await fetch(`${backendUrl}/api/users/${id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      })

      let data
      try {
        data = await response.json()
      } catch {
        // If response is not JSON, return a generic error
        return res.status(response.status).json({
          success: false,
          error: 'Failed to parse backend response',
        })
      }

      if (!response.ok) {
        // Forward the backend's error response with the same status code
        return res.status(response.status).json(data)
      }

      res.status(200).json(data)
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
