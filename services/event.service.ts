import { createServerClient } from '@/lib/supabase/server';
import { sanitizeString, sanitizePhone } from '@/lib/utils';
import {
  ALLOWED_LOGO_TYPES,
  MAX_LOGO_SIZE_BYTES,
  LOGO_BUCKET,
} from '@/lib/constants';
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

  const { data, error } = await db
    .from('events')
    .insert({ ...cleaned, status: 'draft' })
    .select()
    .single();

  if (error) {
    console.error('Create event DB error:', error);
    return { error: 'Failed to create event' };
  }

  return { data: data as EventResponse };
}

// ── Update Event ──────────────────────────────────────────

export async function updateEvent(
  payload: UpdateEventPayload
): Promise<{ data?: EventResponse; error?: string }> {
  const { id, status, ...rest } = payload;
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

  return { data: data as EventResponse };
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

  // Upload to Supabase Storage
  const { error: uploadError } = await db.storage
    .from(LOGO_BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error('Logo upload error:', uploadError);
    return { error: 'Failed to upload logo' };
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = db.storage.from(LOGO_BUCKET).getPublicUrl(fileName);

  // Update event record
  const { error: updateError } = await db
    .from('events')
    .update({ logo_url: publicUrl })
    .eq('id', eventId);

  if (updateError) {
    console.error('Logo URL update error:', updateError);
    return { error: 'Logo uploaded but failed to update event' };
  }

  return { url: publicUrl };
}
