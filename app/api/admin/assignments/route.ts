export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/admin/assignments?event_id=&user_id=
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin');

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const userId = searchParams.get('user_id');

    const db = createServerClient();

    let query = db
      .from('user_event_assignments')
      .select(`
        id, user_id, event_id, assigned_role, created_at,
        users(id, name, email, role, designation, active),
        events(id, title, event_date, status)
      `)
      .order('created_at', { ascending: false });

    if (eventId) query = query.eq('event_id', eventId);
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) {
      console.error('assignments list error:', error);
      return apiError('Failed to fetch assignments', 500);
    }

    return apiSuccess({ assignments: data || [] });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}

// POST /api/admin/assignments — assign user to event
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');

    const body = await request.json();
    const user_id = body.user_id as string;
    const event_id = body.event_id as string;
    const assigned_role = body.assigned_role as string;

    if (!user_id) return apiError('user_id is required', 400);
    if (!event_id) return apiError('event_id is required', 400);
    if (assigned_role !== 'manager' && assigned_role !== 'gate_staff') {
      return apiError('assigned_role must be manager or gate_staff', 400);
    }

    const db = createServerClient();

    // Verify user exists and is not admin
    const { data: user } = await db
      .from('users')
      .select('id, role, active')
      .eq('id', user_id)
      .single();
    if (!user) return apiError('User not found', 404);
    if (user.role === 'admin') return apiError('Cannot assign admin to events', 400);
    if (!user.active) return apiError('Cannot assign inactive user', 400);

    // Verify event exists
    const { data: event } = await db
      .from('events')
      .select('id')
      .eq('id', event_id)
      .single();
    if (!event) return apiError('Event not found', 404);

    const { data: assignment, error } = await db
      .from('user_event_assignments')
      .upsert({ user_id, event_id, assigned_role }, { onConflict: 'user_id,event_id' })
      .select(`
        id, user_id, event_id, assigned_role, created_at,
        users(id, name, email, role, designation),
        events(id, title, event_date, status)
      `)
      .single();

    if (error) {
      console.error('assignment create error:', error);
      return apiError('Failed to create assignment', 500);
    }

    return apiSuccess({ assignment }, 201);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
