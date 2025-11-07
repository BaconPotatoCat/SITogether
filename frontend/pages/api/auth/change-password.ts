import { NextApiRequest, NextApiResponse } from 'next'
import { fetchWithAuthSSR } from '../../../utils/api'
import { validatePasswordChange } from '../../../utils/passwordValidation'
import { config } from '../../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const backendUrl = `${config.backendInternalUrl}/api/auth/change-password`

    const { currentPassword, newPassword, recaptchaToken } = req.body

    // Basic validation (length, format) - full security check happens on backend
    const passwordValidation = validatePasswordChange(currentPassword, newPassword)
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: passwordValidation.errors.join('; '),
      })
    }

    // Call backend API to change password (with authentication)
    const response = await fetchWithAuthSSR(req, backendUrl, {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword,
        ...(recaptchaToken ? { recaptchaToken } : {}),
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
