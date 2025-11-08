import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { config as appConfig } from './utils/config'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const tokenCookie = request.cookies.get('token')
  const token = tokenCookie?.value

  // Public paths that don't require authentication
  const publicPaths = ['/auth', '/verify', '/verify-2fa', '/reset-password']

  // Check if the current path is public
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path))

  // Skip middleware for API routes (except auth which is already public)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // If trying to access a protected path without a token, redirect to auth
  if (!isPublicPath && !token) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  // If trying to access auth page while logged in, redirect to home
  if (isPublicPath && token && pathname === '/auth') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Check admin access for /admin routes
  if (pathname.startsWith('/admin')) {
    if (!token) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth'
      return NextResponse.redirect(url)
    }

    // Check admin status via backend API
    try {
      // Get backend URL from config
      const backendUrl = appConfig.backendInternalUrl
      const adminCheckUrl = `${backendUrl}/api/auth/admin-check`

      const response = await fetch(adminCheckUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `token=${token}`,
        },
      })

      // If not admin (403), redirect to home with error message
      if (response.status === 403) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        url.searchParams.set('error', '403')
        url.searchParams.set('message', 'Access denied. Admin privileges required.')
        return NextResponse.redirect(url)
      }

      // If unauthorized (401), redirect to auth
      if (response.status === 401) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth'
        return NextResponse.redirect(url)
      }

      // If admin check passes, allow access
      if (response.ok) {
        return NextResponse.next()
      }
    } catch (error) {
      console.error('Admin check error in middleware:', error)
      // On error, redirect to home
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // Allow access to all other paths if token exists or path is public
  return NextResponse.next()
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
