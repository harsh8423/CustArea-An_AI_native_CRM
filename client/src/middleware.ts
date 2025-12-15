import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value
    const { pathname } = request.nextUrl

    // List of protected paths
    const protectedPaths = [
        '/dashboard',
        '/sales',
        '/campaign',
        '/conversation',
        '/workflow',
        '/ai-agent',
        '/report'
    ]

    // Check if the current path starts with any of the protected paths
    const isProtected = protectedPaths.some(path => pathname.startsWith(path))

    if (isProtected) {
        if (!token) {
            return NextResponse.redirect(new URL('/login', request.url))
        }
    }

    // Auth routes (redirect to dashboard if logged in)
    if (pathname === '/login' || pathname === '/register') {
        if (token) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/sales/:path*',
        '/campaign/:path*',
        '/conversation/:path*',
        '/workflow/:path*',
        '/ai-agent/:path*',
        '/report/:path*',
        '/login',
        '/register'
    ],
}
