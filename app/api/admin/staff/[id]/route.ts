export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError, hashPassword } from '@/lib/auth';
import { apiSuccess, apiError, sanitizeString, isValidMobile, normalizeMobile } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/admin/staff/:id — fetch user + their event assignments
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole('admin');
    const db = createServerClient();

    const { data: user, error } = await db
      .from('users')
      .select('id, name, email, mobile, role, active, designation, created_at, updated_at')
      .eq('id', params.id)
      .neq('role', 'admin')
      .single();

    if (error || !user) return apiError('Staff user not found', 404);

    const { data: assignments } = await db
      .from('user_event_assignments')
      .select('id, event_id, assigned_role, created_at, events(id, title, event_date, status)')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false });

    return apiSuccess({
      user: { ...user, assignment_count: (assignments || []).length },
      assignments: assignments || [],
    });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}

// PATCH /api/admin/staff/:id — update user fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole('admin');

    const body = await request.json();
    const db = createServerClient();

    // Verify target is not an admin
    const { data: existing } = await db
      .from('users')
      .select('id, role')
      .eq('id', params.id)
      .single();
    if (!existing) return apiError('Staff user not found', 404);
    if (existing.role === 'admin') return apiError('Cannot modify admin users', 403);

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = sanitizeString(body.name);
      if (!name) return apiError('Name cannot be empty', 400);
      updates.name = name;
    }
    if (body.email !== undefined) {
      updates.email = sanitizeString(body.email).toLowerCase();
    }
    if (body.mobile !== undefined) {
      const mobile = normalizeMobile(body.mobile);
      if (!isValidMobile(mobile)) return apiError('Invalid mobile number', 400);
      updates.mobile = mobile;
    }
    if (body.role !== undefined) {
      if (body.role !== 'manager' && body.role !== 'gate_staff') {
        return apiError('Role must be manager or gate_staff', 400);
      }
      updates.role = body.role;
    }
    if (body.active !== undefined) updates.active = Boolean(body.active);
    if (body.designation !== undefined) {
      updates.designation = sanitizeString(body.designation) || null;
    }
    if (body.password !== undefined) {
      if (body.password.length < 6) return apiError('Password must be at least 6 characters', 400);
      updates.password_hash = await hashPassword(body.password);
    }

    if (Object.keys(updates).length === 0) return apiError('No fields to update', 400);

    const { data: user, error } = await db
      .from('users')
      .update(updates)
      .eq('id', params.id)
      .select('id, name, email, mobile, role, active, designation, created_at, updated_at')
      .single();

    if (error) {
      console.error('update staff error:', error);
      return apiError('Failed to update staff user', 500);
    }

    return apiSuccess({ user });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}

// DELETE /api/admin/staff/:id — deactivate (soft delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole('admin');
    const db = createServerClient();

    const { data: existing } = await db
      .from('users')
      .select('id, role')
      .eq('id', params.id)
      .single();
    if (!existing) return apiError('Staff user not found', 404);
    if (existing.role === 'admin') return apiError('Cannot delete admin users', 403);

    const { error } = await db
      .from('users')
      .update({ active: false })
      .eq('id', params.id);

    if (error) return apiError('Failed to deactivate staff user', 500);

    return apiSuccess({ message: 'Staff user deactivated' });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
