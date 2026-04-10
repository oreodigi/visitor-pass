import { createServerClient } from '@/lib/supabase/server';
import type { SeatMapConfig } from '@/lib/seat-map';

type DbClient = ReturnType<typeof createServerClient>;

const FALLBACK_KEY_PREFIX = 'seat_map_config:';

function getFallbackKey(eventId: string) {
  return `${FALLBACK_KEY_PREFIX}${eventId}`;
}

async function getFallbackSeatMapConfig(
  db: DbClient,
  eventId: string
): Promise<{ data?: SeatMapConfig | null; error?: string }> {
  const { data, error } = await db
    .from('app_settings')
    .select('value')
    .eq('key', getFallbackKey(eventId))
    .maybeSingle();

  if (error) {
    console.error('Fallback seat map load error:', error);
    return { error: 'Failed to load seat map' };
  }

  if (!data?.value) return { data: null };

  try {
    return { data: JSON.parse(data.value) as SeatMapConfig | null };
  } catch (err) {
    console.error('Fallback seat map parse error:', err);
    return { data: null };
  }
}

export async function readFallbackSeatMapConfig(
  db: DbClient,
  eventId: string
): Promise<{ data?: SeatMapConfig | null; error?: string }> {
  return getFallbackSeatMapConfig(db, eventId);
}

async function saveFallbackSeatMapConfig(
  db: DbClient,
  eventId: string,
  config: SeatMapConfig | null
): Promise<{ error?: string }> {
  const { error } = await db
    .from('app_settings')
    .upsert(
      { key: getFallbackKey(eventId), value: JSON.stringify(config ?? null) },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('Fallback seat map save error:', error);
    return { error: 'Failed to save seat map' };
  }

  return {};
}

export async function loadSeatMapConfig(
  db: DbClient,
  eventId: string
): Promise<{ data?: SeatMapConfig | null; source?: 'events' | 'app_settings'; error?: string }> {
  const primary = await db
    .from('events')
    .select('seat_map_config')
    .eq('id', eventId)
    .single();

  if (!primary.error && primary.data) {
    return {
      data: (primary.data.seat_map_config as SeatMapConfig | null) ?? null,
      source: 'events',
    };
  }

  if (primary.error?.code === '42703') {
    const fallback = await getFallbackSeatMapConfig(db, eventId);
    return {
      data: fallback.data ?? null,
      source: 'app_settings',
      error: fallback.error,
    };
  }

  if (primary.error) {
    console.error('Seat map load error:', primary.error);
    return { error: primary.error.message || 'Failed to load seat map' };
  }

  return { data: null, source: 'events' };
}

export async function saveSeatMapConfig(
  db: DbClient,
  eventId: string,
  config: SeatMapConfig | null
): Promise<{ source?: 'events' | 'app_settings'; error?: string }> {
  const exists = await db
    .from('events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle();

  if (exists.error) {
    console.error('Seat map event lookup error:', exists.error);
    return { error: exists.error.message || 'Event not found' };
  }

  if (!exists.data) {
    return { error: 'Event not found' };
  }

  const primary = await db
    .from('events')
    .update({ seat_map_config: config ?? null })
    .eq('id', eventId);

  if (!primary.error) {
    return { source: 'events' };
  }

  if (primary.error.code !== '42703') {
    console.error('Seat map save error:', primary.error);
    return { error: primary.error.message || 'Failed to save seat map' };
  }

  const fallback = await saveFallbackSeatMapConfig(db, eventId, config);
  if (fallback.error) return fallback;

  return { source: 'app_settings' };
}
