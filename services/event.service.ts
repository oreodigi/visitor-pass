import { createServerClient } from '@/lib/supabase/server';
import { sanitizeString, sanitizePhone } from '@/lib/utils';
import {
  ALLOWED_LOGO_TYPES,
  MAX_LOGO_SIZE_BYTES,
  LOGO_BUCKET,
} from '@/lib/constants';
import { uploadPublicFile } from '@/lib/storage';
import {
  DEFAULT_PASS_STYLE,
  normalizePassStyleConfig,
  savePassStyleConfig,
  loadPassStyleConfig,
} from '@/lib/pass-style-storage';
import type {
  CreateEventPayload,
  UpdateEventPayload,
  EventResponse,
} from '@/types';

// ── Validate Event Payload ────────────────────────────────

function validateEventPayload(
  payload: Partial<CreateEventPayload>,
  isUpdate = false
): string | null {
  if (!isUpdate) {
    if (!payload.title?.trim()) return 'Title is required';
    if (!payload.event_date) return 'Event date is required';
    if (!payload.venue_name?.trim()) return 'Venue name is required';
    if (!payload.venue_address?.trim()) return 'Venue address is required';
    if (!payload.start_time) return 'Start time is required';
    if (!payload.end_time) return 'End time is required';
  }

  if (payload.event_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(payload.event_date)) return 'Invalid date format (YYYY-MM-DD)';
  }

  if (payload.start_time && payload.end_time) {
    if (payload.start_time >= payload.end_time) {
      return 'End time must be after start time';
    }
  }

  if (payload.max_visitors != null) {
    const mv = Number(payload.max_visitors);
    if (!Number.isInteger(mv) || mv < 1) return 'Max visitors must be a positive number';
  }

  if (payload.vip_seats != null) {
    const vs = Number(payload.vip_seats);
    if (!Number.isInteger(vs) || vs < 0) return 'VIP seats must be 0 or more';
  }

  return null;
}

// ── Sanitize Event Data ───────────────────────────────────

function sanitizeEventData(payload: Partial<CreateEventPayload>) {
  const cleaned: Record<string, unknown> = {};

  if (payload.title !== undefined) cleaned.title = sanitizeString(payload.title);
  if (payload.event_date !== undefined) cleaned.event_date = payload.event_date;
  if (payload.start_time !== undefined) cleaned.start_time = payload.start_time;
  if (payload.end_time !== undefined) cleaned.end_time = payload.end_time;
  if (payload.venue_name !== undefined)
    cleaned.venue_name = sanitizeString(payload.venue_name);
  if (payload.venue_address !== undefined)
    cleaned.venue_address = sanitizeString(payload.venue_address);
  if (payload.venue_contact_number !== undefined)
    cleaned.venue_contact_number = sanitizePhone(payload.venue_contact_number);
  if (payload.organizer_contact_number !== undefined)
    cleaned.organizer_contact_number = sanitizePhone(
      payload.organizer_contact_number
    );
  if (payload.support_contact_number !== undefined)
    cleaned.support_contact_number = sanitizePhone(
      payload.support_contact_number
    );
  if (payload.footer_note !== undefined)
    cleaned.footer_note = sanitizeString(payload.footer_note);
  if (payload.logo_url !== undefined) cleaned.logo_url = payload.logo_url;
  // Message templates (stored as-is, no aggressive sanitization — they're admin-only)
  if ('invite_message_template' in payload)
    cleaned.invite_message_template = (payload as Record<string, unknown>).invite_message_template ?? null;
  if ('pass_message_template' in payload)
    cleaned.pass_message_template = (payload as Record<string, unknown>).pass_message_template ?? null;
  if ('pass_terms_conditions' in payload)
    cleaned.pass_terms_conditions = (payload as Record<string, unknown>).pass_terms_conditions ?? null;
  if ('seat_map_config' in payload)
    cleaned.seat_map_config = (payload as Record<string, unknown>).seat_map_config ?? null;
  if ('max_visitors' in payload) {
    const mv = (payload as Record<string, unknown>).max_visitors;
    cleaned.max_visitors = mv != null && mv !== '' ? parseInt(String(mv), 10) : null;
  }
  if ('vip_seats' in payload) {
    const vs = (payload as Record<string, unknown>).vip_seats;
    cleaned.vip_seats = vs != null && vs !== '' ? Math.max(0, parseInt(String(vs), 10)) : 0;
  }
  if ('partners' in payload) {
    const raw = (payload as Record<string, unknown>).partners;
    if (Array.isArray(raw)) {
      cleaned.partners = raw
        .map((p: unknown) => {
          const partner = p as Record<string, unknown>;
          return {
            name: String(partner.name || '').trim(),
            logo_url: partner.logo_url ? String(partner.logo_url) : null,
          };
        })
        .filter((p) => p.name.length > 0);
    } else {
      cleaned.partners = [];
    }
  }

  return cleaned;
}

// ── Create Event ──────────────────────────────────────────

export async function createEvent(
  payload: CreateEventPayload
): Promise<{ data?: EventResponse; error?: string }> {
  const validationError = validateEventPayload(payload);
  if (validationError) return { error: validationError };

  const db = createServerClient();
  const cleaned = sanitizeEventData(payload);
  const passStyle = 'pass_style' in payload ? normalizePassStyleConfig(payload.pass_style) : DEFAULT_PASS_STYLE;

  const { data, error } = await db
    .from('events')
    .insert({ ...cleaned, status: 'draft' })
    .select()
    .single();

  if (error) {
    console.error('Create event DB error:', error);
    return { error: 'Failed to create event' };
  }

  const saveStyle = await savePassStyleConfig(db, data.id, passStyle);
  if (saveStyle.error) return { error: saveStyle.error };

  return { data: { ...(data as EventResponse), pass_style: passStyle } };
}

// ── Update Event ──────────────────────────────────────────

export async function updateEvent(
  payload: UpdateEventPayload
): Promise<{ data?: EventResponse; error?: string }> {
  const hasPassStyle = 'pass_style' in payload;
  const { id, status, pass_style, ...rest } = payload;
  if (!id) return { error: 'Event ID is required' };

  const validationError = validateEventPayload(rest, true);
  if (validationError) return { error: validationError };

  const db = createServerClient();
  const cleaned = sanitizeEventData(rest);

  if (status) cleaned.status = status;

  const { data, error } = await db
    .from('events')
    .update(cleaned)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Update event DB error:', error);
    return { error: 'Failed to update event' };
  }

  let passStyle = DEFAULT_PASS_STYLE;
  if (hasPassStyle) {
    passStyle = normalizePassStyleConfig(pass_style);
    const saveStyle = await savePassStyleConfig(db, id, passStyle);
    if (saveStyle.error) return { error: saveStyle.error };
  } else {
    const loadedStyle = await loadPassStyleConfig(db, id);
    if (loadedStyle.error) return { error: loadedStyle.error };
    passStyle = loadedStyle.data ?? DEFAULT_PASS_STYLE;
  }

  return { data: { ...(data as EventResponse), pass_style: passStyle } };
}

// ── Get Event by ID ───────────────────────────────────────

export async function getEventById(
  id: string
): Promise<{ data?: EventResponse; error?: string }> {
  const db = createServerClient();

  const { data: event, error } = await db
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !event) {
    return { error: 'Event not found' };
  }

  const passStyleResult = await loadPassStyleConfig(db, id);
  if (passStyleResult.error) return { error: passStyleResult.error };

  // Get counts
  const { count: attendeeCount } = await db
    .from('attendees')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', id);

  const { count: checkedInCount } = await db
    .from('attendees')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', id)
    .not('checked_in_at', 'is', null);

  return {
    data: {
      ...event,
      pass_style: passStyleResult.data ?? DEFAULT_PASS_STYLE,
      attendee_count: attendeeCount || 0,
      checked_in_count: checkedInCount || 0,
    } as EventResponse,
  };
}

// ── List Events ───────────────────────────────────────────

export async function listEvents(): Promise<{
  data?: EventResponse[];
  error?: string;
}> {
  const db = createServerClient();

  const { data, error } = await db
    .from('events')
    .select('*')
    .order('event_date', { ascending: false });

  if (error) {
    console.error('List events DB error:', error);
    return { error: 'Failed to fetch events' };
  }

  return { data: (data || []) as EventResponse[] };
}

// ── Delete Event (cascade) ────────────────────────────────

export async function deleteEvent(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  if (!id) return { error: 'Event ID is required' };

  const db = createServerClient();

  // Verify event exists
  const { data: event } = await db.from('events').select('id').eq('id', id).single();
  if (!event) return { error: 'Event not found' };

  // 1. Delete checkin_logs for all attendees of this event
  const { data: attendeeRows } = await db
    .from('attendees')
    .select('id')
    .eq('event_id', id);

  const attendeeIds = (attendeeRows || []).map((a: { id: string }) => a.id);

  if (attendeeIds.length > 0) {
    const { error: logsError } = await db
      .from('checkin_logs')
      .delete()
      .in('attendee_id', attendeeIds);
    if (logsError) {
      console.error('Delete checkin_logs error:', logsError);
      return { error: 'Failed to delete check-in logs' };
    }
  }

  // 2. Delete attendees for this event
  const { error: attendeesError } = await db
    .from('attendees')
    .delete()
    .eq('event_id', id);
  if (attendeesError) {
    console.error('Delete attendees error:', attendeesError);
    return { error: 'Failed to delete attendees' };
  }

  // 3. Delete contacts for this event
  const { error: contactsError } = await db
    .from('contacts')
    .delete()
    .eq('event_id', id);
  if (contactsError) {
    console.error('Delete contacts error:', contactsError);
    return { error: 'Failed to delete contacts' };
  }

  // 4. Delete the event itself
  const { error: eventError } = await db.from('events').delete().eq('id', id);
  if (eventError) {
    console.error('Delete event error:', eventError);
    return { error: 'Failed to delete event' };
  }

  return { success: true };
}

// ── Upload Partner Logo ───────────────────────────────────

export async function uploadPartnerLogo(
  eventId: string,
  file: File
): Promise<{ url?: string; error?: string }> {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: 'Invalid file type. Allowed: PNG, JPG, JPEG' };
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return { error: 'File too large. Maximum: 2MB' };
  }

  const db = createServerClient();
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${eventId}/partners/partner-${Date.now()}.${ext}`;
  const uploadResult = await uploadPublicFile(db, {
    bucket: LOGO_BUCKET,
    path: fileName,
    file,
  });

  if (uploadResult.error || !uploadResult.url) {
    return { error: uploadResult.error || 'Failed to upload logo' };
  }

  return { url: uploadResult.url };
}

// ── Upload Logo ───────────────────────────────────────────

export async function uploadLogo(
  eventId: string,
  file: File
): Promise<{ url?: string; error?: string }> {
  // Validate file type
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: 'Invalid file type. Allowed: PNG, JPG, JPEG' };
  }

  // Validate file size
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return { error: 'File too large. Maximum: 2MB' };
  }

  const db = createServerClient();
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${eventId}/logo-${Date.now()}.${ext}`;
  const uploadResult = await uploadPublicFile(db, {
    bucket: LOGO_BUCKET,
    path: fileName,
    file,
  });

  if (uploadResult.error || !uploadResult.url) {
    return { error: uploadResult.error || 'Failed to upload logo' };
  }

  // Update event record
  const { error: updateError } = await db
    .from('events')
    .update({ logo_url: uploadResult.url })
    .eq('id', eventId);

  if (updateError) {
    console.error('Logo URL update error:', updateError);
    return { error: 'Logo uploaded but failed to update event' };
  }

  return { url: uploadResult.url };
}
