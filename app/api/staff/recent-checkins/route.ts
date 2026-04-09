export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/staff/recent-checkins?event_id=uuid
// Returns the 30 most recent check-in log entries with attendee details
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin', 'gate_staff');

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    if (!eventId) return apiError('event_id is required', 400);

    const db = createServerClient();

    const { data, error } = await db
      .from('checkin_logs')
      .select(`
        id,
        status,
        gate_name,
        created_at,
        attendees (
          name,
          mobile,
          pass_number,
          seat_number
        )
      `)
      .eq('event_id', eventId)
      .in('status', ['valid', 'duplicate'])
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('recent-checkins error:', error);
      return apiError('Failed to fetch recent check-ins', 500);
    }

    return apiSuccess({ logs: data || [] });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
