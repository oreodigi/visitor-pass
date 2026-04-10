import { createServerClient } from '@/lib/supabase/server';
import { buildAppUrl } from '@/lib/app-url';
import {
  generateSecureToken,
  buildPassPrefix,
  formatPassNumber,
  formatSeatNumber,
  parsePassNumberSequence,
} from '@/lib/token';
import {
  getNextAvailableSeat,
  getAvailableSeats,
  type SeatMapConfig,
} from '@/lib/seat-map';

// ── Types ─────────────────────────────────────────────────

export interface GeneratePassResult {
  attendee_id: string;
  pass_number: string;
  seat_number: string;
  qr_token: string;
  pass_url: string;
}

export interface BulkGenerateResult {
  total_requested: number;
  generated: number;
  skipped_existing: number;
  failed: number;
  errors: Array<{ attendee_id: string; reason: string }>;
  passes: GeneratePassResult[];
}

interface PassEventContext {
  id: string;
  title: string;
  event_date: string;
  seat_map_config: SeatMapConfig | null;
}

// ── Constants ─────────────────────────────────────────────

const MAX_TOKEN_RETRIES = 5;

async function getPassEventContext(
  db: ReturnType<typeof createServerClient>,
  eventId: string
): Promise<{ data?: PassEventContext; error?: string }> {
  const primary = await db
    .from('events')
    .select('id, title, event_date, seat_map_config')
    .eq('id', eventId)
    .single();

  if (!primary.error && primary.data) {
    return { data: primary.data as PassEventContext };
  }

  if (primary.error?.code !== '42703') {
    return { error: primary.error?.message || 'Event not found' };
  }

  // Backward-compatible fallback for databases that have not run the
  // seat-map migration yet. Pass generation can still proceed without seat maps.
  const fallback = await db
    .from('events')
    .select('id, title, event_date')
    .eq('id', eventId)
    .single();

  if (fallback.error || !fallback.data) {
    return { error: fallback.error?.message || 'Event not found' };
  }

  return {
    data: {
      ...(fallback.data as { id: string; title: string; event_date: string }),
      seat_map_config: null,
    },
  };
}

// ── Generate Pass for Single Attendee ─────────────────────

export async function generatePassForAttendee(
  attendeeId: string,
  force = false,
  appOrigin?: string
): Promise<{ data?: GeneratePassResult; error?: string }> {
  const db = createServerClient();

  const { data: attendee, error: attendeeErr } = await db
    .from('attendees')
    .select('id, event_id, qr_token, pass_number, seat_number, pass_generated_at')
    .eq('id', attendeeId)
    .single();

  if (attendeeErr || !attendee) return { error: 'Attendee not found' };

  if (attendee.pass_generated_at && !force) {
    return { error: 'Pass already generated. Use force=true to regenerate.' };
  }

  const eventResult = await getPassEventContext(db, attendee.event_id);
  if (eventResult.error || !eventResult.data) return { error: 'Event not found' };
  const event = eventResult.data;

  // Generate QR token with uniqueness retry
  let qrToken: string | null = null;
  for (let attempt = 0; attempt < MAX_TOKEN_RETRIES; attempt++) {
    const candidate = generateSecureToken();
    const { data: conflict } = await db
      .from('attendees')
      .select('id')
      .eq('qr_token', candidate)
      .single();

    if (!conflict) {
      qrToken = candidate;
      break;
    }
    console.warn(`QR token collision on attempt ${attempt + 1}, retrying`);
  }

  if (!qrToken) return { error: 'Failed to generate unique QR token after retries' };

  // Generate pass number
  const prefix = buildPassPrefix(event.event_date, event.title);
  const sequence = await getNextSequence(db, event.id, prefix);

  if (sequence === null) return { error: 'Failed to generate unique pass number' };

  const passNumber = formatPassNumber(prefix, sequence);
  const passUrl = buildAppUrl(`/p/${qrToken}`, appOrigin);

  // Determine seat number: use seat map if configured, else sequential fallback
  let seatNumber: string;
  const seatMap = event.seat_map_config as SeatMapConfig | null;
  if (seatMap?.rows?.length) {
    const mapSeat = await getNextAvailableSeat(db, event.id, seatMap);
    if (!mapSeat) return { error: 'No seats available on the seat map' };
    seatNumber = mapSeat;
  } else {
    seatNumber = formatSeatNumber(sequence);
  }

  const { error: updateErr } = await db
    .from('attendees')
    .update({
      qr_token: qrToken,
      pass_number: passNumber,
      seat_number: seatNumber,
      pass_url: passUrl,
      pass_generated_at: new Date().toISOString(),
      whatsapp_status: 'ready',
    })
    .eq('id', attendeeId);

  if (updateErr) {
    if (updateErr.code === '23505') {
      return { error: 'Duplicate conflict. Please retry.' };
    }
    console.error('Pass generation DB error:', updateErr);
    return { error: 'Failed to save pass data' };
  }

  return { data: { attendee_id: attendeeId, pass_number: passNumber, seat_number: seatNumber, qr_token: qrToken, pass_url: passUrl } };
}

// ── Bulk Generate Passes ──────────────────────────────────

export async function bulkGeneratePasses(
  eventId: string,
  attendeeIds?: string[],
  force = false,
  appOrigin?: string
): Promise<BulkGenerateResult> {
  const result: BulkGenerateResult = {
    total_requested: 0,
    generated: 0,
    skipped_existing: 0,
    failed: 0,
    errors: [],
    passes: [],
  };

  const db = createServerClient();

  const eventResult = await getPassEventContext(db, eventId);
  if (eventResult.error || !eventResult.data) {
    result.errors.push({ attendee_id: '', reason: 'Event not found' });
    return result;
  }
  const event = eventResult.data;

  let query = db
    .from('attendees')
    .select('id, qr_token, pass_number, pass_generated_at')
    .eq('event_id', eventId);

  if (attendeeIds && attendeeIds.length > 0) {
    query = query.in('id', attendeeIds);
  }

  const { data: attendees, error: fetchErr } = await query;
  if (fetchErr || !attendees) {
    result.errors.push({ attendee_id: '', reason: 'Failed to fetch attendees' });
    return result;
  }

  result.total_requested = attendees.length;
  if (attendees.length === 0) return result;

  const toGenerate: string[] = [];
  for (const a of attendees) {
    if (a.pass_generated_at && !force) {
      result.skipped_existing++;
    } else {
      toGenerate.push(a.id);
    }
  }

  if (toGenerate.length === 0) return result;

  const prefix = buildPassPrefix(event.event_date, event.title);
  const currentMax = await getCurrentMaxSequence(db, eventId, prefix);
  let nextSeq = currentMax + 1;

  // Seat assignment: use seat map if configured, else sequential
  const seatMap = event.seat_map_config as SeatMapConfig | null;
  let availableMapSeats: string[] = [];
  if (seatMap?.rows?.length) {
    availableMapSeats = await getAvailableSeats(db, eventId, seatMap);
  }
  let mapSeatIdx = 0;

  const updates: Array<{
    attendee_id: string;
    qr_token: string;
    pass_number: string;
    seat_number: string;
    pass_url: string;
  }> = [];

  const usedTokens = new Set<string>();
  for (const attendeeId of toGenerate) {
    // Seat map check before generating token
    let seatNumber: string;
    if (seatMap?.rows?.length) {
      if (mapSeatIdx >= availableMapSeats.length) {
        result.failed++;
        result.errors.push({ attendee_id: attendeeId, reason: 'No seats available on the seat map' });
        continue;
      }
      seatNumber = availableMapSeats[mapSeatIdx++];
    } else {
      seatNumber = formatSeatNumber(nextSeq);
    }

    let token: string | null = null;
    for (let attempt = 0; attempt < MAX_TOKEN_RETRIES; attempt++) {
      const candidate = generateSecureToken();
      if (!usedTokens.has(candidate)) {
        token = candidate;
        usedTokens.add(candidate);
        break;
      }
    }

    if (!token) {
      result.failed++;
      result.errors.push({ attendee_id: attendeeId, reason: 'Failed to generate unique token' });
      continue;
    }

    updates.push({
      attendee_id: attendeeId,
      qr_token: token,
      pass_number: formatPassNumber(prefix, nextSeq),
      seat_number: seatNumber,
      pass_url: buildAppUrl(`/p/${token}`, appOrigin),
    });
    nextSeq++;
  }

  // Check token collisions against DB
  const allTokens = updates.map((u) => u.qr_token);
  const { data: existingTokens } = await db
    .from('attendees')
    .select('qr_token')
    .in('qr_token', allTokens);

  const collidedTokens = new Set((existingTokens || []).map((e) => e.qr_token));

  for (const update of updates) {
    if (collidedTokens.has(update.qr_token)) {
      let newToken: string | null = null;
      for (let attempt = 0; attempt < MAX_TOKEN_RETRIES; attempt++) {
        const candidate = generateSecureToken();
        const { data: conflict } = await db
          .from('attendees')
          .select('id')
          .eq('qr_token', candidate)
          .single();
        if (!conflict) { newToken = candidate; break; }
      }
      if (!newToken) {
        result.failed++;
        result.errors.push({ attendee_id: update.attendee_id, reason: 'Token collision could not be resolved' });
        continue;
      }
      update.qr_token = newToken;
      update.pass_url = buildAppUrl(`/p/${newToken}`, appOrigin);
    }

    const { error: updateErr } = await db
      .from('attendees')
      .update({
        qr_token: update.qr_token,
        pass_number: update.pass_number,
        seat_number: update.seat_number,
        pass_url: update.pass_url,
        pass_generated_at: new Date().toISOString(),
        whatsapp_status: 'ready',
      })
      .eq('id', update.attendee_id);

    if (updateErr) {
      result.failed++;
      result.errors.push({
        attendee_id: update.attendee_id,
        reason: updateErr.code === '23505' ? `Duplicate conflict: ${updateErr.message}` : `DB error: ${updateErr.message}`,
      });
    } else {
      result.generated++;
      result.passes.push({
        attendee_id: update.attendee_id,
        pass_number: update.pass_number,
        seat_number: update.seat_number,
        qr_token: update.qr_token,
        pass_url: update.pass_url,
      });
    }
  }

  return result;
}

// ── Get Public Pass Data ──────────────────────────────────

export interface PublicPassData {
  attendee: {
    name: string | null;
    mobile: string;
    email: string | null;
    business_name: string | null;
    seat_number: string | null;
    pass_number: string;
    checked_in_at: string | null;
  };
  event: {
    title: string;
    event_date: string;
    start_time: string;
    end_time: string;
    venue_name: string;
    venue_address: string;
    venue_contact_number: string | null;
    organizer_contact_number: string | null;
    support_contact_number: string | null;
    footer_note: string | null;
    logo_url: string | null;
    pass_terms_conditions: string | null;
    partners: Array<{ name: string; logo_url: string | null }> | null;
  };
  pass_url: string;
}

export async function getPublicPassByToken(
  token: string
): Promise<{ data?: PublicPassData; error?: string }> {
  const db = createServerClient();

  const { data: attendee, error: attendeeErr } = await db
    .from('attendees')
    .select('name, mobile, email, business_name, seat_number, pass_number, checked_in_at, pass_url, event_id')
    .eq('qr_token', token)
    .single();

  if (attendeeErr || !attendee) return { error: 'Invalid pass' };
  if (!attendee.pass_number) return { error: 'Pass not generated' };

  const { data: event, error: eventErr } = await db
    .from('events')
    .select('title, event_date, start_time, end_time, venue_name, venue_address, venue_contact_number, organizer_contact_number, support_contact_number, footer_note, logo_url, pass_terms_conditions, partners')
    .eq('id', attendee.event_id)
    .single();

  if (eventErr || !event) return { error: 'Event not found' };

  return {
    data: {
      attendee: {
        name: attendee.name,
        mobile: attendee.mobile,
        email: attendee.email,
        business_name: attendee.business_name,
        seat_number: attendee.seat_number,
        pass_number: attendee.pass_number,
        checked_in_at: attendee.checked_in_at,
      },
      event,
      pass_url: attendee.pass_url || buildAppUrl(`/p/${token}`),
    },
  };
}

// ── Internal Helpers ──────────────────────────────────────

async function getCurrentMaxSequence(
  db: ReturnType<typeof createServerClient>,
  eventId: string,
  prefix: string
): Promise<number> {
  const { data } = await db
    .from('attendees')
    .select('pass_number')
    .eq('event_id', eventId)
    .like('pass_number', `${prefix}-%`)
    .order('pass_number', { ascending: false })
    .limit(1)
    .single();

  if (!data?.pass_number) return 0;
  return parsePassNumberSequence(data.pass_number);
}

async function getNextSequence(
  db: ReturnType<typeof createServerClient>,
  eventId: string,
  prefix: string
): Promise<number | null> {
  const maxSeq = await getCurrentMaxSequence(db, eventId, prefix);
  const nextSeq = maxSeq + 1;
  const candidate = formatPassNumber(prefix, nextSeq);

  // Belt-and-suspenders check (DB unique constraint is the real guard)
  const { data: existing } = await db
    .from('attendees')
    .select('id')
    .eq('pass_number', candidate)
    .single();

  if (existing) {
    const fallback = nextSeq + 1;
    const fallbackPass = formatPassNumber(prefix, fallback);
    const { data: existing2 } = await db
      .from('attendees')
      .select('id')
      .eq('pass_number', fallbackPass)
      .single();

    if (existing2) {
      console.error('Pass number collision persisted after retry');
      return null;
    }
    return fallback;
  }

  return nextSeq;
}
