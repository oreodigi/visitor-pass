export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError, hashPassword } from '@/lib/auth';
import { apiSuccess, apiError, sanitizeString, isValidMobile, normalizeMobile } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/admin/staff?role=manager|gate_staff&active=true|false&page=1
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin');

    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role');
    const activeFilter = searchParams.get('active');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = 25;
    const offset = (page - 1) * perPage;

    const db = createServerClient();

    let query = db
      .from('users')
      .select('id, name, email, mobile, role, active, designation, created_at, updated_at', { count: 'exact' })
      .range(offset, offset + perPage - 1)
      .order('role', { ascending: true })
      .order('created_at', { ascending: false });

    if (roleFilter === 'admin' || roleFilter === 'manager' || roleFilter === 'gate_staff') {
      query = query.eq('role', roleFilter);
    }
    if (activeFilter === 'true') query = query.eq('active', true);
    if (activeFilter === 'false') query = query.eq('active', false);

    const { data: users, error, count } = await query;
    if (error) {
      console.error('staff list error:', error);
      return apiError('Failed to fetch staff', 500);
    }

    // Fetch assignment counts for each user
    const userIds = (users || []).map((u) => u.id);
    let assignmentCounts: Record<string, number> = {};
    if (userIds.length > 0) {
      const { data: asgData } = await db
        .from('user_event_assignments')
        .select('user_id')
        .in('user_id', userIds);
      (asgData || []).forEach((a) => {
        assignmentCounts[a.user_id] = (assignmentCounts[a.user_id] || 0) + 1;
      });
    }

    const staff = (users || []).map((u) => ({
      ...u,
      assignment_count: assignmentCounts[u.id] || 0,
    }));

    const total = count || 0;
    return apiSuccess({
      staff,
      total,
      page,
      total_pages: Math.ceil(total / perPage),
    });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}

// POST /api/admin/staff — create new staff user
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');

    const body = await request.json();
    const name = sanitizeString(body.name || '');
    const email = sanitizeString(body.email || '').toLowerCase();
    const mobile = normalizeMobile(body.mobile || '');
    const password = typeof body.password === 'string' ? body.password : '';
    const role = body.role as string;
    const designation = sanitizeString(body.designation || '') || null;

    if (!name) return apiError('Name is required', 400);
    if (!email) return apiError('Email is required', 400);
    if (!isValidMobile(mobile)) return apiError('Invalid mobile number', 400);
    if (!password || password.length < 6) return apiError('Password must be at least 6 characters', 400);
    if (role !== 'admin' && role !== 'manager' && role !== 'gate_staff') {
      return apiError('Role must be admin, manager, or gate_staff', 400);
    }

    const db = createServerClient();

    // Check for duplicate email
    const { data: existing } = await db
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    if (existing) return apiError('Email already in use', 409);

    const password_hash = await hashPassword(password);

    const { data: user, error } = await db
      .from('users')
      .insert({ name, email, mobile, password_hash, role, active: true, designation })
      .select('id, name, email, mobile, role, active, designation, created_at, updated_at')
      .single();

    if (error) {
      console.error('create staff error:', error);
      return apiError('Failed to create staff user', 500);
    }

    return apiSuccess({ user: { ...user, assignment_count: 0 } }, 201);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
