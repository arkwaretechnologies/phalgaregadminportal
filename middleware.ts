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
        return NextResponse.redirect(url);
      }

      // Check role-based access for admin routes
      if (
        (pathname.startsWith('/dashboard/users') || 
         pathname.startsWith('/dashboard/download-participants') ||
         pathname.startsWith('/dashboard/conferences')) &&
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
      return NextResponse.redirect(url);
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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Check role-based access for admin-only API routes
      if (
        (pathname.startsWith('/api/users') || 
         pathname.startsWith('/api/participants/export') || 
         pathname.startsWith('/api/registrations/export') ||
         pathname.startsWith('/api/conferences')) &&
        payload.role !== 'admin'
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.next();
    } catch (error) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
