import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE_NAME } from '@/lib/constants';

const PROTECTED_PREFIXES = ['/admin', '/staff', '/manager'];
const LOGIN_PATH = '/login';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) return new TextEncoder().encode('');
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const role = payload.role as string;

    // /admin → admin only
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }

    // /manager → manager or admin
    if (
      pathname.startsWith('/manager') &&
      role !== 'manager' &&
      role !== 'admin'
    ) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }

    // /staff → gate_staff or admin
    if (
      pathname.startsWith('/staff') &&
      role !== 'admin' &&
      role !== 'gate_staff'
    ) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    response.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return response;
  }
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*', '/manager/:path*'],
};
