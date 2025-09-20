import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Only apply auth to the main app, not API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Check if user is authenticated
  const authCookie = request.cookies.get('aim-auth')

  if (!authCookie || authCookie.value !== 'authenticated') {
    // Redirect to login if not authenticated
    if (request.nextUrl.pathname !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } else {
    // Redirect to main app if already authenticated and trying to access login
    if (request.nextUrl.pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}