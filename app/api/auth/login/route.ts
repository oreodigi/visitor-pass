export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  createSessionToken,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth';
import { apiSuccess, apiError, sanitizeString } from '@/lib/utils';
import type { SessionUser } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = sanitizeString(body.email).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return apiError('Email and password are required', 400);
    }

    const db = createServerClient();

    // Fetch user by email
    const { data: user, error } = await db
      .from('users')
      .select('id, name, email, password_hash, role, active')
      .eq('email', email)
      .single();

    if (error || !user) {
      return apiError('Invalid email or password', 401);
    }

    if (!user.active) {
      return apiError('Account is deactivated', 403);
    }

    if (!user.password_hash) {
      return apiError('Invalid email or password', 401);
    }

    // Verify password via pgcrypto function
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return apiError('Invalid email or password', 401);
    }

    // Create session
    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);

    return apiSuccess({
      user: sessionUser,
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    return apiError('Internal server error', 500);
  }
}
