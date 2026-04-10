export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAuth, AuthError, hashPassword, verifyPassword, setSessionCookie, createSessionToken } from '@/lib/auth';
import { apiSuccess, apiError, sanitizeString, isValidMobile, normalizeMobile } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/profile — current user's full profile from DB
export async function GET() {
  try {
    const session = await requireAuth();
    const db = createServerClient();

    // Try with profile_picture_url (requires migrate-v9).
    // Fall back gracefully if the column doesn't exist yet.
    let { data, error } = await db
      .from('users')
      .select('id, name, email, mobile, role, designation, profile_picture_url, active, created_at')
      .eq('id', session.id)
      .single();

    if (error) {
      // Retry without the v9 column so the page still works pre-migration
      const fallback = await db
        .from('users')
        .select('id, name, email, mobile, role, designation, active, created_at')
        .eq('id', session.id)
        .single();
      if (fallback.error || !fallback.data) return apiError('Profile not found', 404);
      data = { ...fallback.data, profile_picture_url: null } as typeof data;
    }

    if (!data) return apiError('Profile not found', 404);
    return apiSuccess(data);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}

// PUT /api/profile — update name / email / mobile / password
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const db = createServerClient();

    const updates: Record<string, unknown> = {};

    if ('name' in body) {
      const name = sanitizeString(body.name || '');
      if (!name) return apiError('Name cannot be empty', 400);
      updates.name = name;
    }

    if ('email' in body) {
      const email = sanitizeString(body.email || '').toLowerCase();
      if (!email || !email.includes('@')) return apiError('Invalid email', 400);
      // Check uniqueness (excluding self)
      const { data: dup } = await db
        .from('users').select('id').eq('email', email).neq('id', session.id).single();
      if (dup) return apiError('Email already in use', 409);
      updates.email = email;
    }

    if ('mobile' in body) {
      const mobile = normalizeMobile(body.mobile || '');
      if (!isValidMobile(mobile)) return apiError('Invalid mobile number', 400);
      updates.mobile = mobile;
    }

    if ('designation' in body) {
      updates.designation = sanitizeString(body.designation || '') || null;
    }

    // Password change: requires current_password + new_password
    if ('new_password' in body) {
      const newPwd = typeof body.new_password === 'string' ? body.new_password : '';
      const curPwd = typeof body.current_password === 'string' ? body.current_password : '';
      if (newPwd.length < 6) return apiError('New password must be at least 6 characters', 400);
      if (!curPwd) return apiError('Current password is required', 400);

      // Fetch current hash
      const { data: user } = await db
        .from('users').select('password_hash').eq('id', session.id).single();
      if (!user?.password_hash) return apiError('Cannot verify current password', 400);

      const valid = await verifyPassword(curPwd, user.password_hash);
      if (!valid) return apiError('Current password is incorrect', 401);

      updates.password_hash = await hashPassword(newPwd);
    }

    if (Object.keys(updates).length === 0) return apiError('Nothing to update', 400);

    updates.updated_at = new Date().toISOString();

    let { data: updated, error: updateError } = await db
      .from('users')
      .update(updates)
      .eq('id', session.id)
      .select('id, name, email, mobile, role, designation, profile_picture_url, active')
      .single();

    if (updateError) {
      // Fallback: retry select without profile_picture_url (pre-migrate-v9)
      const fallback = await db
        .from('users')
        .update(updates)
        .eq('id', session.id)
        .select('id, name, email, mobile, role, designation, active')
        .single();
      if (fallback.error || !fallback.data) {
        console.error('profile update error:', fallback.error);
        return apiError('Failed to update profile', 500);
      }
      updated = { ...fallback.data, profile_picture_url: null } as typeof updated;
    }

    if (!updated) {
      return apiError('Failed to update profile', 500);
    }

    // Re-issue session cookie if name / email changed (so JWT stays fresh)
    if ('name' in updates || 'email' in updates) {
      const newToken = await createSessionToken({
        id: updated.id,
        name: updated.name,
        email: updated.email ?? null,
        role: updated.role as import('@/types').UserRole,
      });
      await setSessionCookie(newToken);
    }

    return apiSuccess(updated);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}

// POST /api/profile — upload avatar (multipart)
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const form = await request.formData();
    const file = form.get('avatar') as File | null;
    if (!file) return apiError('No file uploaded', 400);

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) return apiError('Only PNG, JPG, WEBP allowed', 400);
    if (file.size > 2 * 1024 * 1024) return apiError('File must be under 2MB', 400);

    const db = createServerClient();
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `avatars/${session.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadErr } = await db.storage
      .from('event-logos')
      .upload(fileName, file, { cacheControl: '3600', upsert: true, contentType: file.type });

    if (uploadErr) {
      console.error('avatar upload error:', uploadErr);
      return apiError('Failed to upload avatar', 500);
    }

    const { data: { publicUrl } } = db.storage.from('event-logos').getPublicUrl(fileName);

    const { error: saveErr } = await db
      .from('users')
      .update({ profile_picture_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', session.id);

    if (saveErr) return apiError('Avatar uploaded but failed to save URL', 500);

    return apiSuccess({ avatar_url: publicUrl });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
