import type { NextApiRequest } from 'next'

// ---- CSRF Helpers (client-side only) ----
// Read a cookie value by name
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie ? document.cookie.split('; ') : []
  for (const c of cookies) {
    const [k, ...v] = c.split('=')
    if (k === name) {
      return decodeURIComponent(v.join('='))
    }
  }
  return null
}

// Ensure a CSRF token cookie is present; fetches /api/auth/csrf if missing
export const ensureCsrfToken = async (): Promise<string | null> => {
  let token = getCookie('XSRF-TOKEN')
  console.log('[ensureCsrfToken] Current XSRF-TOKEN cookie:', token)

  // If token already exists, return it (sid is HttpOnly so we can't check it, but browser auto-sends it)
  if (token) {
    return token
  }

  console.log('[ensureCsrfToken] Fetching CSRF token from /api/auth/csrf')
  try {
    // Call our Next.js proxy route which forwards Set-Cookie from backend
    const res = await fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' })
    if (!res.ok) {
      console.warn('Failed to fetch CSRF token, status:', res.status)
      return null
    }
    console.log('[ensureCsrfToken] CSRF fetch response status:', res.status)
    console.log('[ensureCsrfToken] Response headers:', Object.fromEntries(res.headers.entries()))
    token = getCookie('XSRF-TOKEN')
    console.log('[ensureCsrfToken] XSRF-TOKEN after fetch:', token)
    return token
  } catch (e) {
    console.warn('Failed to fetch CSRF token', e)
    return null
  }
}

// Remove CR and LF characters for log safety
function sanitizeForLog(str: string): string {
  return typeof str === "string" ? str.replace(/[\r\n]/g, "") : str;
}

// Utility function to make authenticated API calls (client-side)
// @param redirectOn401 - If true (default), redirects to /auth on 401. If false, returns the response for custom handling.
export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {},
  redirectOn401: boolean = true
) => {
  const method = (options.method || 'GET').toUpperCase()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  // Attach CSRF token for mutating requests (lusca expects header 'x-csrf-token')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    let csrf = getCookie('XSRF-TOKEN')
    console.log('[fetchWithAuth] CSRF token from cookie:', csrf)
    if (!csrf) {
      console.log('[fetchWithAuth] CSRF token not found, fetching new one...')
      csrf = await ensureCsrfToken()
      console.log('[fetchWithAuth] CSRF token after fetch:', csrf)
    }
    if (csrf) {
      headers['x-csrf-token'] = csrf
      console.log('[fetchWithAuth] Added CSRF token to headers for:', sanitizeForLog(url))
    } else {
      console.warn('CSRF token unavailable for request:', sanitizeForLog(url))
    }
  }

  const defaultOptions: RequestInit = {
    ...options,
    method,
    credentials: 'include', // Include cookies in requests
    headers,
  }

  try {
    const response = await fetch(url, defaultOptions)
    if (response.status === 401 && redirectOn401) {
      window.location.href = '/auth'
      throw new Error('Unauthorized')
    }
    return response
  } catch (error) {
    throw error
  }
}

// Utility function to make authenticated API calls from server-side (SSR/API routes)
export const fetchWithAuthSSR = async (
  req: NextApiRequest,
  url: string,
  options: RequestInit = {}
) => {
  // Get token and CSRF token from request cookies/headers
  const token = req.cookies?.token
  const csrfToken = req.headers['x-csrf-token']
  const sid = req.cookies?.sid

  // Build headers with authentication
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  // Forward CSRF token if present
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken as string
  }

  // Forward cookies (token and session cookie)
  let cookieHeader = ''
  if (token) cookieHeader += `token=${token}; `
  if (sid) cookieHeader += `sid=${sid}; `
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader.trim()
  }

  const defaultOptions: RequestInit = {
    ...options,
    headers,
  }

  try {
    const response = await fetch(url, defaultOptions)
    return response
  } catch (error) {
    throw error
  }
}
