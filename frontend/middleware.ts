import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
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
