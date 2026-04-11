import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/constants';
import { verifySessionToken } from '@/lib/auth';
import type { SessionUser, UserRole } from '@/types';

export class ApiAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiAuthError';
    this.status = status;
  }
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
}

export async function getApiUser(request: NextRequest): Promise<SessionUser | null> {
  const bearer = getBearerToken(request);
  if (bearer) return verifySessionToken(bearer);

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return cookieToken ? verifySessionToken(cookieToken) : null;
}

export async function requireApiRole(
  request: NextRequest,
  ...allowedRoles: UserRole[]
): Promise<SessionUser> {
  const user = await getApiUser(request);
  if (!user) throw new ApiAuthError('Unauthorized', 401);
  if (!allowedRoles.includes(user.role)) {
    throw new ApiAuthError('Forbidden: insufficient permissions', 403);
  }
  return user;
}
