import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect admin routes: check st_auth cookie or auth query parameter
  if (pathname.startsWith('/admin')) {
    const authCookie = request.cookies.get('st_auth')?.value;
    const authParam = request.nextUrl.searchParams.get('auth');

    const isAuthorized = authCookie === 'admin' || authParam === 'admin';

    if (!isAuthorized) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    const response = NextResponse.next();

    // If authorized via auth query parameter and cookie isn't set, persist cookie in response header
    if (authParam === 'admin' && authCookie !== 'admin') {
      response.cookies.set('st_auth', 'admin', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
