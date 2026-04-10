export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth';

// GET — validate token (used to check before showing form)
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return apiError('Token is required', 400);

  const db = createServerClient();
  const { data } = await db
    .from('password_reset_tokens')
    .select('id, expires_at, used_at')
    .eq('token', token)
    .single();

  if (!data) return apiError('Invalid or expired reset link', 400);
  if (data.used_at) return apiError('This reset link has already been used', 400);
  if (new Date(data.expires_at) < new Date()) return apiError('This reset link has expired', 400);

  return apiSuccess({ valid: true });
}

// POST — apply the new password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token) return apiError('Token is required', 400);
    if (!password || password.length < 6) return apiError('Password must be at least 6 characters', 400);

    const db = createServerClient();

    const { data: resetToken } = await db
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .single();

    if (!resetToken) return apiError('Invalid or expired reset link', 400);
    if (resetToken.used_at) return apiError('This reset link has already been used', 400);
    if (new Date(resetToken.expires_at) < new Date()) return apiError('This reset link has expired', 400);

    const password_hash = await hashPassword(password);

    // Update password
    const { error: updateErr } = await db
      .from('users')
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq('id', resetToken.user_id);

    if (updateErr) {
      console.error('reset password update error:', updateErr);
      return apiError('Failed to update password', 500);
    }

    // Mark token as used
    await db
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetToken.id);

    return apiSuccess({ message: 'Password updated successfully. You can now sign in.' });
  } catch (err) {
    console.error('reset-password error:', err);
    return apiError('Internal server error', 500);
  }
}
