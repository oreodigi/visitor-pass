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
      .single();

    if (error || !user) return apiError('User not found', 404);

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
    const session = await requireRole('admin');

    const body = await request.json();
    const db = createServerClient();

    const { data: existing } = await db
      .from('users')
      .select('id, role')
      .eq('id', params.id)
      .single();
    if (!existing) return apiError('User not found', 404);

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = sanitizeString(body.name);
      if (!name) return apiError('Name cannot be empty', 400);
      updates.name = name;
    }
    if (body.email !== undefined) {
      const email = sanitizeString(body.email).toLowerCase();
      if (!email || !email.includes('@')) return apiError('Invalid email', 400);
      // Check uniqueness (excluding self)
      const { data: dup } = await db
        .from('users').select('id').eq('email', email).neq('id', params.id).single();
      if (dup) return apiError('Email already in use', 409);
      updates.email = email;
    }
    if (body.mobile !== undefined) {
      const mobile = normalizeMobile(body.mobile);
      if (!isValidMobile(mobile)) return apiError('Invalid mobile number', 400);
      updates.mobile = mobile;
    }
    if (body.role !== undefined) {
      const newRole = body.role as string;
      if (newRole !== 'admin' && newRole !== 'manager' && newRole !== 'gate_staff') {
        return apiError('Role must be admin, manager, or gate_staff', 400);
      }
      // Cannot remove your own admin role
      if (params.id === session.id && newRole !== 'admin') {
        return apiError('You cannot change your own role', 403);
      }
      // Cannot demote the last admin
      if (existing.role === 'admin' && newRole !== 'admin') {
        const { count } = await db
          .from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true);
        if ((count ?? 0) <= 1) return apiError('Cannot change role of the only active admin', 403);
      }
      updates.role = newRole;
    }
    if (body.active !== undefined) {
      // Cannot deactivate yourself
      if (params.id === session.id) return apiError('You cannot deactivate your own account', 403);
      // Cannot deactivate last admin
      if (existing.role === 'admin' && !body.active) {
        const { count } = await db
          .from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true);
        if ((count ?? 0) <= 1) return apiError('Cannot deactivate the only active admin', 403);
      }
      updates.active = Boolean(body.active);
    }
    if (body.designation !== undefined) {
      updates.designation = sanitizeString(body.designation) || null;
    }
    if (body.password !== undefined && body.password !== '') {
      if (body.password.length < 6) return apiError('Password must be at least 6 characters', 400);
      updates.password_hash = await hashPassword(body.password);
    }

    if (Object.keys(updates).length === 0) return apiError('No fields to update', 400);
    updates.updated_at = new Date().toISOString();

    const { data: user, error } = await db
      .from('users')
      .update(updates)
      .eq('id', params.id)
      .select('id, name, email, mobile, role, active, designation, created_at, updated_at')
      .single();

    if (error) {
      console.error('update user error:', error);
      return apiError('Failed to update user', 500);
    }

    return apiSuccess({ user });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}

// DELETE /api/admin/staff/:id — hard delete user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole('admin');
    const db = createServerClient();

    const { data: existing } = await db
      .from('users')
      .select('id, role, name')
      .eq('id', params.id)
      .single();
    if (!existing) return apiError('User not found', 404);

    // Cannot delete yourself
    if (params.id === session.id) return apiError('You cannot delete your own account', 403);

    // Cannot delete the last active admin
    if (existing.role === 'admin') {
      const { count } = await db
        .from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true);
      if ((count ?? 0) <= 1) return apiError('Cannot delete the only active admin account', 403);
    }

    const { error } = await db.from('users').delete().eq('id', params.id);
    if (error) {
      console.error('delete user error:', error);
      return apiError('Failed to delete user', 500);
    }

    return apiSuccess({ message: `${existing.name} has been deleted` });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
