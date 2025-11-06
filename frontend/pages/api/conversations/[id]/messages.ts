import { NextApiRequest, NextApiResponse } from 'next'
import { config } from '../../../../utils/config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (!id || typeof id !== 'string')
    return res.status(400).json({ success: false, error: 'Invalid id' })

  try {
    const backendUrl = `${config.backendInternalUrl}/api/conversations/${id}/messages`
    const token = req.cookies.token

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    if (req.method === 'GET') {
      const response = await fetch(backendUrl, { method: 'GET', headers, credentials: 'include' })
      const data = await response.json()
      return res.status(response.status).json(data)
    }

    if (req.method === 'POST') {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body),
        credentials: 'include',
      })
      const data = await response.json()
      return res.status(response.status).json(data)
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (error) {
    console.error('Conversation messages proxy error:', error)
    res.status(500).json({ success: false, error: 'Failed to process request' })
  }
}
