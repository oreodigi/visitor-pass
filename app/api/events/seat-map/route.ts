export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';
import { loadSeatMapConfig, saveSeatMapConfig } from '@/lib/seat-map-storage';

// GET /api/events/seat-map?event_id=xxx
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin');

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    if (!eventId) return apiError('event_id is required', 400);

    const db = createServerClient();

    const seatMapResult = await loadSeatMapConfig(db, eventId);
    if (seatMapResult.error) return apiError(seatMapResult.error, 404);

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
      seat_map_config: seatMapResult.data ?? null,
      occupied,
      source: seatMapResult.source || 'events',
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

    const result = await saveSeatMapConfig(db, event_id, (seat_map_config ?? null) as import('@/lib/seat-map').SeatMapConfig | null);
    if (result.error) {
      return apiError(result.error, result.error === 'Event not found' ? 404 : 500);
    }

    return apiSuccess({ saved: true, source: result.source || 'events' });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('PUT /api/events/seat-map error:', err);
    return apiError('Internal server error', 500);
  }
}
