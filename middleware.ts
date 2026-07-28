import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function verifyToken(token: string): Promise<any | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload;
  } catch (error) {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (pathname === '/login' || pathname.startsWith('/api/auth/login')) {
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard') || pathname === '/') {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    try {
      const payload = await verifyToken(token);
      if (!payload) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        const res = NextResponse.redirect(url);
        // If the token is invalid/expired (common after deploys if JWT_SECRET changes),
        // clear it so users don't have to manually delete site data.
        res.cookies.delete('auth-token');
        return res;
      }

      // Check role-based access for admin routes
      if (
        (pathname.startsWith('/dashboard/users') || 
         pathname.startsWith('/dashboard/conferences') ||
         pathname.startsWith('/dashboard/configuration')) &&
        payload.role !== 'admin'
      ) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }

      return NextResponse.next();
    } catch (error) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      const res = NextResponse.redirect(url);
      res.cookies.delete('auth-token');
      return res;
    }
  }

  // Protect API routes (except auth/login and debug endpoints)
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth/login') && !pathname.startsWith('/api/debug')) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const payload = await verifyToken(token);
      if (!payload) {
        const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        res.cookies.delete('auth-token');
        return res;
      }

      // Check role-based access for admin-only API routes
      // Note: /api/conferences and /api/positions GET allow reviewers; writes are admin-only (handled in API routes)
      if (pathname.startsWith('/api/users') && payload.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (
        pathname.startsWith('/api/positions') &&
        request.method !== 'GET' &&
        payload.role !== 'admin'
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.next();
    } catch (error) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      res.cookies.delete('auth-token');
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

// Note: In Next.js middleware, we cannot use Next.js-specific imports like cookies()
// So we access cookies directly from the request object
