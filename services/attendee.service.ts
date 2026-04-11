import { createServerClient } from '@/lib/supabase/server';
import {
  sanitizeString,
  normalizeMobile,
  isValidMobile,
} from '@/lib/utils';
import { generatePassForAttendee } from '@/services/pass.service';
import type {
  CreateAttendeePayload,
  UpdateAttendeePayload,
  AttendeeResponse,
  AttendeeListResponse,
  ImportResult,
  SubmitInviteResult,
} from '@/types';

// ── Create Attendee ───────────────────────────────────────

export async function createAttendee(
  payload: CreateAttendeePayload
): Promise<{ data?: AttendeeResponse; error?: string }> {
  if (!payload.event_id) return { error: 'Event ID is required' };
  if (!payload.mobile) return { error: 'Mobile number is required' };

  const mobile = normalizeMobile(payload.mobile);
  if (!isValidMobile(mobile)) {
    return { error: 'Invalid mobile number. Must be a 10-digit Indian mobile number' };
  }

  const db = createServerClient();

  // Check if event exists
  const { data: event } = await db
    .from('events')
    .select('id')
    .eq('id', payload.event_id)
    .single();

  if (!event) return { error: 'Event not found' };

  // Check for existing duplicate
  const { data: existing } = await db
    .from('attendees')
    .select('id')
    .eq('event_id', payload.event_id)
    .eq('mobile', mobile)
    .single();

  if (existing) {
    return { error: 'Mobile number already registered for this event' };
  }

  const insertData = {
    event_id: payload.event_id,
    name: payload.name ? sanitizeString(payload.name) : null,
    mobile,
    business_name: payload.business_name
      ? sanitizeString(payload.business_name)
      : null,
    source: payload.source || 'manual',
  };

  const { data, error } = await db
    .from('attendees')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation gracefully
    if (error.code === '23505') {
      return { error: 'Mobile number already registered for this event' };
    }
    console.error('Create attendee DB error:', error);
    return { error: 'Failed to create attendee' };
  }

  return { data: data as AttendeeResponse };
}

// ── Update Attendee ───────────────────────────────────────

export async function updateAttendee(
  payload: UpdateAttendeePayload
): Promise<{ data?: AttendeeResponse; error?: string }> {
  if (!payload.id) return { error: 'Attendee ID is required' };

  const db = createServerClient();

  // Build update object only with provided fields
  const updateData: Record<string, unknown> = {};

  if (payload.name !== undefined) {
    updateData.name = payload.name ? sanitizeString(payload.name) : null;
  }

  if (payload.business_name !== undefined) {
    updateData.business_name = payload.business_name
      ? sanitizeString(payload.business_name)
      : null;
  }

  if (payload.email !== undefined) {
    updateData.email = payload.email ? sanitizeString(payload.email).toLowerCase() : null;
  }

  if (payload.mobile !== undefined) {
    const mobile = normalizeMobile(payload.mobile);
    if (!isValidMobile(mobile)) {
      return { error: 'Invalid mobile number' };
    }
    updateData.mobile = mobile;
  }

  if (Object.keys(updateData).length === 0) {
    return { error: 'No fields to update' };
  }

  const { data, error } = await db
    .from('attendees')
    .update(updateData)
    .eq('id', payload.id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'Mobile number already registered for this event' };
    }
    console.error('Update attendee DB error:', error);
    return { error: 'Failed to update attendee' };
  }

  return { data: data as AttendeeResponse };
}

export async function markAttendeePassSent(
  id: string
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Attendee ID is required' };

  const db = createServerClient();
  const now = new Date().toISOString();

  const { data: attendee, error: attendeeError } = await db
    .from('attendees')
    .select('id,event_id,mobile,contact_id')
    .eq('id', id)
    .single();

  if (attendeeError || !attendee) return { success: false, error: 'Attendee not found' };

  const { error: updateError } = await db
    .from('attendees')
    .update({
      whatsapp_status: 'sent',
      whatsapp_sent_marked_at: now,
    })
    .eq('id', attendee.id);

  if (updateError) {
    console.error('markAttendeePassSent attendee update error:', updateError);
    return { success: false, error: 'Failed to mark pass as sent' };
  }

  let contactId = attendee.contact_id;
  if (!contactId) {
    const { data: contact } = await db
      .from('contacts')
      .select('id')
      .eq('event_id', attendee.event_id)
      .eq('mobile', attendee.mobile)
      .maybeSingle();
    contactId = contact?.id || null;
  }

  if (contactId) {
    const { data: contact } = await db
      .from('contacts')
      .select('id,status,invited_at')
      .eq('id', contactId)
      .maybeSingle();

    const contactUpdate: Record<string, string | null> = {
      attendee_id: attendee.id,
      whatsapp_invite_status: 'sent',
      invited_at: contact?.invited_at || now,
    };
    if (contact?.status === 'uploaded') contactUpdate.status = 'invited';

    await db.from('contacts').update(contactUpdate).eq('id', contactId);
    if (!attendee.contact_id) {
      await db.from('attendees').update({ contact_id: contactId }).eq('id', attendee.id);
    }
  }

  await db.from('message_logs').insert({
    event_id: attendee.event_id,
    attendee_id: attendee.id,
    mobile: attendee.mobile,
    message_text: 'Pass sent manually from attendee desk.',
    whatsapp_link: 'manual-whatsapp://attendees',
    status: 'sent',
  });

  return { success: true };
}

// ── Delete Attendee (hard delete — justified below) ───────
// Hard delete chosen over soft delete because:
// 1. MVP scope — no audit trail requirement yet
// 2. Attendees are tied to mobile numbers; re-adding is trivial
// 3. Soft delete adds query complexity across every read
// 4. Deleting a checked-in attendee intentionally removes their check-in logs
// If soft delete is needed later, add a `deleted_at` column.

export async function deleteAttendee(
  id: string
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Attendee ID is required' };

  const db = createServerClient();

  const { data: attendee } = await db
    .from('attendees')
    .select('id, contact_id')
    .eq('id', id)
    .single();

  if (!attendee) {
    return { success: false, error: 'Attendee not found' };
  }

  // Remove scan audit rows first so checked-in visitors can also be deleted.
  // The seat becomes available immediately because occupancy is derived from
  // active attendee rows with a seat_number.
  const { error: logDeleteError } = await db.from('checkin_logs').delete().eq('attendee_id', id);
  if (logDeleteError) {
    console.error('Delete attendee check-in log error:', logDeleteError);
    return { success: false, error: 'Failed to remove check-in log' };
  }

  if (attendee.contact_id) {
    await db
      .from('contacts')
      .update({
        status: 'invited',
        attendee_id: null,
        responded_at: null,
      })
      .eq('id', attendee.contact_id);
  }

  const { error } = await db.from('attendees').delete().eq('id', id);

  if (error) {
    console.error('Delete attendee DB error:', error);
    return { success: false, error: 'Failed to delete attendee' };
  }

  return { success: true };
}

// ── Get Attendee by ID ────────────────────────────────────

export async function getAttendeeById(
  id: string
): Promise<{ data?: AttendeeResponse; error?: string }> {
  const db = createServerClient();

  const { data, error } = await db
    .from('attendees')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return { error: 'Attendee not found' };
  return { data: data as AttendeeResponse };
}

// ── List Attendees (paginated, searchable) ────────────────

export async function listAttendees(params: {
  event_id: string;
  page?: number;
  per_page?: number;
  search?: string;
  pass_filter?: 'has_pass' | 'no_pass';
}): Promise<{ data?: AttendeeListResponse; error?: string }> {
  const { event_id, page = 1, per_page = 20, search, pass_filter } = params;

  if (!event_id) return { error: 'Event ID is required' };

  const db = createServerClient();
  const offset = (page - 1) * per_page;

  // Build query
  let query = db
    .from('attendees')
    .select('*', { count: 'exact' })
    .eq('event_id', event_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + per_page - 1);

  // Apply pass filter
  if (pass_filter === 'has_pass') {
    query = query.not('pass_generated_at', 'is', null);
  } else if (pass_filter === 'no_pass') {
    query = query.is('pass_generated_at', null);
  }

  // Apply search filter
  if (search && search.trim()) {
    const term = search.trim();
    // Search by mobile (exact prefix) or name (ilike)
    const normalizedTerm = normalizeMobile(term);
    if (/^\d+$/.test(normalizedTerm) && normalizedTerm.length >= 3) {
      // Numeric search → match mobile prefix
      query = query.like('mobile', `${normalizedTerm}%`);
    } else {
      // Text search → match name
      query = query.ilike('name', `%${term}%`);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('List attendees DB error:', error);
    return { error: 'Failed to fetch attendees' };
  }

  const total = count || 0;

  return {
    data: {
      attendees: (data || []) as AttendeeResponse[],
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page),
    },
  };
}

// ── Create Confirmed Attendee (from invite form submission) ──
// Called after a contact fills the form. Creates the attendee,
// generates pass + seat number, and marks the contact as confirmed.

export async function createConfirmedAttendee(params: {
  event_id: string;
  contact_id: string;
  name: string;
  mobile: string;
  email?: string;
  company_name?: string;
  app_origin?: string;
}): Promise<{ data?: SubmitInviteResult; error?: string }> {
  const { event_id, contact_id, name, mobile, email, company_name, app_origin } = params;

  const normalizedMobile = normalizeMobile(mobile);
  if (!isValidMobile(normalizedMobile)) {
    return { error: 'Invalid mobile number' };
  }

  const db = createServerClient();

  // Re-resolve the contact at submit time so pass generation never depends on
  // stale client state or a partially-shaped relation payload.
  const { data: contactRow, error: contactErr } = await db
    .from('contacts')
    .select('id, event_id, status')
    .eq('id', contact_id)
    .single();

  if (contactErr || !contactRow) {
    return { error: 'Invitation contact not found' };
  }

  if (contactRow.status === 'cancelled') {
    return { error: 'This invitation has been cancelled' };
  }

  const resolvedEventId = contactRow.event_id || event_id;
  if (!resolvedEventId) {
    return { error: 'Event not found' };
  }

  const { data: eventRow, error: eventErr } = await db
    .from('events')
    .select('id')
    .eq('id', resolvedEventId)
    .single();

  if (eventErr || !eventRow) {
    return { error: 'Event not found' };
  }

  // Check no existing confirmed attendee with same mobile for this event
  const { data: existing } = await db
    .from('attendees')
    .select('id, pass_url, pass_number, seat_number')
    .eq('event_id', resolvedEventId)
    .eq('mobile', normalizedMobile)
    .single();

  if (existing) {
    // Already confirmed — return the existing pass
    if (existing.pass_url && existing.pass_number && existing.seat_number) {
      return {
        data: {
          attendee_id: existing.id,
          pass_url: existing.pass_url,
          pass_number: existing.pass_number,
          seat_number: existing.seat_number,
        },
      };
    }
    return { error: 'Mobile number already registered for this event' };
  }

  // Create attendee record
  const { data: attendee, error: createErr } = await db
    .from('attendees')
    .insert({
      event_id: resolvedEventId,
      name: sanitizeString(name),
      mobile: normalizedMobile,
      email: email ? sanitizeString(email) : null,
      business_name: company_name ? sanitizeString(company_name) : null,
      source: 'registration',
      contact_id,
    })
    .select('id')
    .single();

  if (createErr || !attendee) {
    if (createErr?.code === '23505') {
      return { error: 'Mobile number already registered for this event' };
    }
    console.error('createConfirmedAttendee insert error:', createErr);
    return { error: 'Failed to register attendee' };
  }

  // Generate pass (assigns seat_number + pass_number + qr_token)
  const passResult = await generatePassForAttendee(attendee.id, false, app_origin);

  if (passResult.error || !passResult.data) {
    // Roll back attendee record to keep DB clean
    await db.from('attendees').delete().eq('id', attendee.id);
    return { error: passResult.error || 'Failed to generate pass' };
  }

  // Mark contact as confirmed
  await db
    .from('contacts')
    .update({
      status: 'confirmed',
      attendee_id: attendee.id,
      responded_at: new Date().toISOString(),
    })
    .eq('id', contact_id);

  return {
    data: {
      attendee_id: attendee.id,
      pass_url: passResult.data.pass_url,
      pass_number: passResult.data.pass_number,
      seat_number: passResult.data.seat_number,
    },
  };
}

// ── Bulk Import Attendees ─────────────────────────────────

export async function importAttendees(
  eventId: string,
  rows: Array<{ name?: string; mobile: string; business_name?: string }>
): Promise<ImportResult> {
  const result: ImportResult = {
    total_rows: rows.length,
    valid_rows: 0,
    inserted: 0,
    duplicates_skipped: 0,
    invalid_rows: 0,
    errors: [],
  };

  if (rows.length === 0) {
    return result;
  }

  const db = createServerClient();

  // Verify event exists
  const { data: event } = await db
    .from('events')
    .select('id')
    .eq('id', eventId)
    .single();

  if (!event) {
    result.errors.push({ row: 0, reason: 'Event not found' });
    return result;
  }

  // Phase 1: Validate and normalize all rows
  const seenMobiles = new Set<string>();
  const validRows: Array<{
    event_id: string;
    name: string | null;
    mobile: string;
    business_name: string | null;
    source: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1; // 1-indexed for human readability

    // Validate mobile exists
    if (!row.mobile || !row.mobile.trim()) {
      result.invalid_rows++;
      result.errors.push({ row: rowNum, reason: 'Mobile number is missing' });
      continue;
    }

    const mobile = normalizeMobile(row.mobile);

    if (!isValidMobile(mobile)) {
      result.invalid_rows++;
      result.errors.push({
        row: rowNum,
        reason: `Invalid mobile number: ${row.mobile}`,
      });
      continue;
    }

    // Check for duplicates within CSV itself
    if (seenMobiles.has(mobile)) {
      result.duplicates_skipped++;
      result.errors.push({
        row: rowNum,
        reason: `Duplicate within CSV: ${mobile}`,
      });
      continue;
    }

    seenMobiles.add(mobile);

    validRows.push({
      event_id: eventId,
      name: row.name ? sanitizeString(row.name) : null,
      mobile,
      business_name: row.business_name
        ? sanitizeString(row.business_name)
        : null,
      source: 'import',
    });
  }

  result.valid_rows = validRows.length;

  if (validRows.length === 0) {
    return result;
  }

  // Phase 2: Check existing mobiles in DB for this event
  const mobileList = validRows.map((r) => r.mobile);

  const { data: existing } = await db
    .from('attendees')
    .select('mobile')
    .eq('event_id', eventId)
    .in('mobile', mobileList);

  const existingMobiles = new Set((existing || []).map((e) => e.mobile));

  // Phase 3: Filter out DB duplicates
  const toInsert = validRows.filter((r) => {
    if (existingMobiles.has(r.mobile)) {
      result.duplicates_skipped++;
      return false;
    }
    return true;
  });

  if (toInsert.length === 0) {
    return result;
  }

  // Phase 4: Bulk insert
  // Supabase handles parameterized inserts safely.
  // Insert in batches of 100 to avoid payload limits.
  const BATCH_SIZE = 100;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);

    const { error, data: inserted } = await db
      .from('attendees')
      .insert(batch)
      .select('id');

    if (error) {
      console.error('Bulk insert error (batch):', error);
      // Count remaining as errors
      const failedCount = toInsert.length - result.inserted;
      result.errors.push({
        row: 0,
        reason: `Batch insert failed: ${error.message}. ${failedCount} rows affected.`,
      });
      break;
    }

    result.inserted += (inserted || []).length;
  }

  return result;
}
