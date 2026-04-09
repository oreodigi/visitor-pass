import { cookies } from 'next/headers';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { createServerClient } from '@/lib/supabase/server';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/constants';
import type { SessionUser, UserRole } from '@/types';

// ── JWT Secret ────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

// ── Token Payload ─────────────────────────────────────────

interface TokenPayload extends JWTPayload {
  uid: string;
  name: string;
  email: string | null;
  role: UserRole;
}

// ── Create Session Token ──────────────────────────────────

export async function createSessionToken(user: SessionUser): Promise<string> {
  const token = await new SignJWT({
    uid: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  } as TokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getJwtSecret());

  return token;
}

// ── Verify Session Token ──────────────────────────────────

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const p = payload as TokenPayload;

    if (!p.uid || !p.role) return null;

    return {
      id: p.uid,
      name: p.name || '',
      email: p.email || null,
      role: p.role,
    };
  } catch {
    return null;
  }
}

// ── Set Session Cookie ────────────────────────────────────

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

// ── Clear Session Cookie ──────────────────────────────────

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

// ── Get Current User from Cookie ──────────────────────────

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// ── Require Auth (throw-safe for route handlers) ──────────

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError('Unauthorized', 401);
  }
  return user;
}

// ── Require Specific Role ─────────────────────────────────

export async function requireRole(
  ...allowedRoles: UserRole[]
): Promise<SessionUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError('Forbidden: insufficient permissions', 403);
  }
  return user;
}

// ── Hash Password (bcrypt via pgcrypto in DB) ─────────────

export async function hashPassword(password: string): Promise<string> {
  const db = createServerClient();
  const { data, error } = await db.rpc('crypt_password', {
    plain_password: password,
  });
  if (error) throw new Error('Failed to hash password');
  return data as string;
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const db = createServerClient();
  const { data, error } = await db.rpc('verify_password', {
    plain_password: password,
    hashed_password: hash,
  });
  if (error) return false;
  return data === true;
}

// ── Custom Auth Error ─────────────────────────────────────

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}
