// ── Seat Map Utilities ─────────────────────────────────────

export interface SeatRowConfig {
  label: string;          // "A", "B", "AA", etc.
  count: number;          // number of seats in this row
  start_from: number;     // first seat number (default 1 → seats go start_from … start_from+count-1)
  category: 'Gold' | 'Silver' | 'Platinum';
  aisle_after?: number | null; // visual gap after seat N (optional)
}

export interface SeatMapConfig {
  rows: SeatRowConfig[];
  blocked: string[]; // e.g. ["A-5", "B-10"]
}

/** Returns ordered list of all seat IDs in the map (e.g. ["A-1","A-2",...,"B-1",...]) */
export function generateSeatList(rows: SeatRowConfig[]): string[] {
  const seats: string[] = [];
  for (const row of rows) {
    const from = row.start_from ?? 1;
    for (let i = from; i < from + row.count; i++) {
      seats.push(`${row.label}-${i}`);
    }
  }
  return seats;
}

/** Returns total seat count across all rows */
export function totalSeatCount(rows: SeatRowConfig[]): number {
  return rows.reduce((sum, r) => sum + r.count, 0);
}

/**
 * Find the next available seat from the map.
 * Excludes blocked seats and already-occupied seats.
 */
export async function getNextAvailableSeat(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  eventId: string,
  config: SeatMapConfig
): Promise<string | null> {
  const allSeats = generateSeatList(config.rows);
  const blockedSet = new Set(config.blocked || []);
  const available = allSeats.filter((s) => !blockedSet.has(s));

  if (available.length === 0) return null;

  const { data } = await db
    .from('attendees')
    .select('seat_number')
    .eq('event_id', eventId)
    .not('seat_number', 'is', null)
    .not('pass_generated_at', 'is', null);

  const occupied = new Set<string>(
    (data || []).map((r: { seat_number: string }) => r.seat_number).filter(Boolean)
  );

  return available.find((s) => !occupied.has(s)) ?? null;
}

/**
 * Returns ordered list of seats that are still available (not blocked, not occupied).
 * Used for bulk seat assignment.
 */
export async function getAvailableSeats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  eventId: string,
  config: SeatMapConfig
): Promise<string[]> {
  const allSeats = generateSeatList(config.rows);
  const blockedSet = new Set(config.blocked || []);
  const available = allSeats.filter((s) => !blockedSet.has(s));

  if (available.length === 0) return [];

  const { data } = await db
    .from('attendees')
    .select('seat_number')
    .eq('event_id', eventId)
    .not('seat_number', 'is', null)
    .not('pass_generated_at', 'is', null);

  const occupied = new Set<string>(
    (data || []).map((r: { seat_number: string }) => r.seat_number).filter(Boolean)
  );

  return available.filter((s) => !occupied.has(s));
}
