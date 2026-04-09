export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/staff/search?q=text&event_id=uuid
// Searches confirmed attendees by name, mobile, pass_number, or seat_number
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin', 'gate_staff');

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const eventId = searchParams.get('event_id');

    if (!eventId) return apiError('event_id is required', 400);
    if (q.length < 2) return apiSuccess({ attendees: [] });

    const db = createServerClient();

    const { data, error } = await db
      .from('attendees')
      .select('id, name, mobile, business_name, pass_number, seat_number, checked_in_at, qr_token')
      .eq('event_id', eventId)
      .not('pass_generated_at', 'is', null)
      .or(
        `mobile.like.${q}%,` +
        `name.ilike.%${q}%,` +
        `pass_number.ilike.%${q}%,` +
        `seat_number.ilike.%${q}%`
      )
      .order('name', { ascending: true })
      .limit(20);

    if (error) {
      console.error('search error:', error);
      return apiError('Search failed', 500);
    }

    return apiSuccess({ attendees: data || [] });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
