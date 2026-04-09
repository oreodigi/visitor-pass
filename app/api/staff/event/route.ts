export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/staff/event
// Returns the current event details + live attendance stats
export async function GET(_request: NextRequest) {
  try {
    await requireRole('admin', 'gate_staff');
    const db = createServerClient();

    // Get the most recent event
    const { data: event, error: eventErr } = await db
      .from('events')
      .select('id, title, event_date, start_time, end_time, venue_name, venue_address, venue_contact_number')
      .order('event_date', { ascending: false })
      .limit(1)
      .single();

    if (eventErr || !event) return apiError('No event found', 404);

    // Fetch all attendees with passes for stats (single query)
    const { data: rows, error: statsErr } = await db
      .from('attendees')
      .select('checked_in_at, pass_generated_at')
      .eq('event_id', event.id)
      .not('pass_generated_at', 'is', null);

    if (statsErr) return apiError('Failed to load stats', 500);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const all = rows || [];
    const total = all.length;
    const checked_in = all.filter((r) => r.checked_in_at !== null).length;
    const today = all.filter(
      (r) => r.checked_in_at && new Date(r.checked_in_at) >= todayStart
    ).length;

    return apiSuccess({
      event,
      stats: {
        total,
        checked_in,
        pending: total - checked_in,
        today,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('GET /api/staff/event error:', err);
    return apiError('Internal server error', 500);
  }
}
