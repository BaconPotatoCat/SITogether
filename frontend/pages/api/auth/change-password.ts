import { NextApiRequest, NextApiResponse } from 'next'
import { fetchWithAuthSSR } from '../../../utils/api'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_INTERNALURL}/api/auth/change-password`

    const { currentPassword, newPassword } = req.body

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
      })
    }

    // Validate password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long',
      })
    }

    // Call backend API to change password (with authentication)
    const response = await fetchWithAuthSSR(req, backendUrl, {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    })

    const data = await response.json()

    if (response.ok) {
      res.status(200).json(data)
    } else {
      res.status(response.status).json(data)
    }
  } catch (error) {
    console.error('Change password failed:', error)
    res.status(500).json({
      success: false,
      error: `Failed to change password: ${error instanceof Error ? error.message : 'Unknown error'}`,
      message: 'Backend container may not be running or accessible',
    })
  }
}
