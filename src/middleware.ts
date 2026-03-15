// src/middleware.ts
// Protects /prism routes by checking for an auth session cookie.
// The cookie (`prism_auth_session`) is set by the client on login and cleared on logout.
// NOTE: This is a belt-and-suspenders check. True security comes from Firebase Auth and
// Firestore security rules. For full server-side verification, replace this with a
// Firebase Admin SDK token check.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/prism'];
const AUTH_COOKIE_NAME = 'prism_auth_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);

  if (!authCookie?.value) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware only on /prism paths; skip static files and API routes.
  matcher: ['/prism/:path*'],
};
