export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/staff/attendees?event_id=uuid&status=checked_in|pending&page=1
// Lists confirmed attendees filtered by check-in status
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin', 'gate_staff');

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const status = searchParams.get('status') || 'pending'; // checked_in | pending
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = 25;
    const offset = (page - 1) * perPage;

    if (!eventId) return apiError('event_id is required', 400);

    const db = createServerClient();

    let query = db
      .from('attendees')
      .select('id, name, mobile, business_name, pass_number, seat_number, checked_in_at, qr_token', { count: 'exact' })
      .eq('event_id', eventId)
      .not('pass_generated_at', 'is', null)
      .range(offset, offset + perPage - 1);

    if (status === 'checked_in') {
      query = query.not('checked_in_at', 'is', null).order('checked_in_at', { ascending: false });
    } else {
      query = query.is('checked_in_at', null).order('name', { ascending: true });
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('staff/attendees error:', error);
      return apiError('Failed to fetch attendees', 500);
    }

    const total = count || 0;
    return apiSuccess({
      attendees: data || [],
      total,
      page,
      total_pages: Math.ceil(total / perPage),
    });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
