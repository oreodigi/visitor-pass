export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/events/seat-map?event_id=xxx
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin');

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    if (!eventId) return apiError('event_id is required', 400);

    const db = createServerClient();

    const { data: event, error: evErr } = await db
      .from('events')
      .select('seat_map_config')
      .eq('id', eventId)
      .single();

    if (evErr || !event) return apiError('Event not found', 404);

    // Occupied seats = attendees that already have a seat_number assigned
    const { data: occupiedRows } = await db
      .from('attendees')
      .select('seat_number')
      .eq('event_id', eventId)
      .not('seat_number', 'is', null)
      .not('pass_generated_at', 'is', null);

    const occupied = (occupiedRows || [])
      .map((r) => r.seat_number as string)
      .filter(Boolean);

    return apiSuccess({
      seat_map_config: event.seat_map_config ?? null,
      occupied,
    });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('GET /api/events/seat-map error:', err);
    return apiError('Internal server error', 500);
  }
}

// PUT /api/events/seat-map — save seat map config
export async function PUT(request: NextRequest) {
  try {
    await requireRole('admin');

    const body = await request.json().catch(() => ({}));
    const { event_id, seat_map_config } = body as {
      event_id: string;
      seat_map_config: unknown;
    };

    if (!event_id) return apiError('event_id is required', 400);

    const db = createServerClient();

    const { error } = await db
      .from('events')
      .update({ seat_map_config: seat_map_config ?? null })
      .eq('id', event_id);

    if (error) {
      console.error('Save seat map DB error:', error);
      return apiError('Failed to save seat map', 500);
    }

    return apiSuccess({ saved: true });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('PUT /api/events/seat-map error:', err);
    return apiError('Internal server error', 500);
  }
}
