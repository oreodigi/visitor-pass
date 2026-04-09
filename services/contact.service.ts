import { createServerClient } from '@/lib/supabase/server';
import { generateInviteToken } from '@/lib/token';
import { normalizeMobile, isValidMobile, sanitizeString } from '@/lib/utils';
import type {
  ContactResponse,
  ContactListResponse,
  ImportContactsResult,
} from '@/types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ── Import Contacts from CSV ──────────────────────────────

export async function importContacts(
  eventId: string,
  rows: Array<{ mobile: string }>
): Promise<ImportContactsResult> {
  const result: ImportContactsResult = {
    total_rows: rows.length,
    valid_rows: 0,
    inserted: 0,
    duplicates_skipped: 0,
    invalid_rows: 0,
    errors: [],
  };

  if (rows.length === 0) return result;

  const db = createServerClient();

  const { data: event } = await db
    .from('events')
    .select('id')
    .eq('id', eventId)
    .single();

  if (!event) {
    result.errors.push({ row: 0, reason: 'Event not found' });
    return result;
  }

  // Phase 1: Validate + normalize
  const seenMobiles = new Set<string>();
  const validRows: Array<{
    event_id: string;
    mobile: string;
    invitation_token: string;
    invitation_link: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    if (!row.mobile?.trim()) {
      result.invalid_rows++;
      result.errors.push({ row: rowNum, reason: 'Mobile number is missing' });
      continue;
    }

    const mobile = normalizeMobile(row.mobile);

    if (!isValidMobile(mobile)) {
      result.invalid_rows++;
      result.errors.push({ row: rowNum, reason: `Invalid mobile number: ${row.mobile}` });
      continue;
    }

    if (seenMobiles.has(mobile)) {
      result.duplicates_skipped++;
      result.errors.push({ row: rowNum, reason: `Duplicate within CSV: ${mobile}` });
      continue;
    }

    seenMobiles.add(mobile);

    const token = generateInviteToken();
    validRows.push({
      event_id: eventId,
      mobile,
      invitation_token: token,
      invitation_link: `${APP_URL}/invite/${token}`,
    });
  }

  result.valid_rows = validRows.length;
  if (validRows.length === 0) return result;

  // Phase 2: Check existing mobiles in DB
  const mobileList = validRows.map((r) => r.mobile);
  const { data: existing } = await db
    .from('contacts')
    .select('mobile')
    .eq('event_id', eventId)
    .in('mobile', mobileList);

  const existingMobiles = new Set((existing || []).map((e) => e.mobile));

  const toInsert = validRows.filter((r) => {
    if (existingMobiles.has(r.mobile)) {
      result.duplicates_skipped++;
      return false;
    }
    return true;
  });

  if (toInsert.length === 0) return result;

  // Phase 3: Bulk insert in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { error, data: inserted } = await db
      .from('contacts')
      .insert(batch)
      .select('id');

    if (error) {
      console.error('Contacts bulk insert error:', error);
      result.errors.push({
        row: 0,
        reason: `Batch insert failed: ${error.message}`,
      });
      break;
    }
    result.inserted += (inserted || []).length;
  }

  return result;
}

// ── Get Contact by Invite Token (public) ─────────────────

export async function getContactByToken(
  token: string
): Promise<{ data?: ContactResponse & { event: { title: string; event_date: string; venue_name: string } }; error?: string }> {
  const db = createServerClient();

  const { data: contact, error } = await db
    .from('contacts')
    .select('*, events(title, event_date, venue_name)')
    .eq('invitation_token', token)
    .single();

  if (error || !contact) return { error: 'Invalid or expired invitation link' };

  const { events, ...rest } = contact as ContactResponse & { events: { title: string; event_date: string; venue_name: string } };
  return { data: { ...rest, event: events } };
}

// ── Mark Invite Sent ──────────────────────────────────────

export async function markInviteSent(
  contactId: string
): Promise<{ success: boolean; error?: string }> {
  const db = createServerClient();

  const { error } = await db
    .from('contacts')
    .update({
      status: 'invited',
      whatsapp_invite_status: 'sent',
      invited_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .in('status', ['uploaded']); // Only update if not already confirmed

  if (error) {
    console.error('markInviteSent error:', error);
    return { success: false, error: 'Failed to update invite status' };
  }

  return { success: true };
}

// ── List Contacts (paginated, filterable) ─────────────────

export async function listContacts(params: {
  event_id: string;
  page?: number;
  per_page?: number;
  search?: string;
  status_filter?: string;
}): Promise<{ data?: ContactListResponse; error?: string }> {
  const { event_id, page = 1, per_page = 20, search, status_filter } = params;

  if (!event_id) return { error: 'Event ID is required' };

  const db = createServerClient();
  const offset = (page - 1) * per_page;

  let query = db
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('event_id', event_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + per_page - 1);

  if (status_filter && status_filter !== 'all') {
    query = query.eq('status', status_filter);
  }

  if (search?.trim()) {
    const normalized = normalizeMobile(search.trim());
    if (/^\d+$/.test(normalized) && normalized.length >= 3) {
      query = query.like('mobile', `${normalized}%`);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('listContacts error:', error);
    return { error: 'Failed to fetch contacts' };
  }

  const total = count || 0;
  return {
    data: {
      contacts: (data || []) as ContactResponse[],
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page),
    },
  };
}

// ── Get Contact Stats ─────────────────────────────────────

export async function getContactStats(eventId: string): Promise<{
  total_contacts: number;
  invited: number;
  confirmed: number;
}> {
  const db = createServerClient();

  const { data, error } = await db
    .from('contacts')
    .select('status')
    .eq('event_id', eventId);

  if (error || !data) return { total_contacts: 0, invited: 0, confirmed: 0 };

  return {
    total_contacts: data.length,
    invited: data.filter((c) => c.status !== 'uploaded').length,
    confirmed: data.filter((c) => c.status === 'confirmed').length,
  };
}

// ── Get Pending Contacts for Bulk WA Send ────────────────

export async function getPendingContacts(
  eventId: string
): Promise<{ data?: Array<{ id: string; mobile: string; invitation_link: string }>; error?: string }> {
  const db = createServerClient();

  const { data, error } = await db
    .from('contacts')
    .select('id, mobile, invitation_link')
    .eq('event_id', eventId)
    .in('status', ['uploaded', 'invited'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getPendingContacts error:', error);
    return { error: 'Failed to fetch pending contacts' };
  }

  return { data: (data || []) as Array<{ id: string; mobile: string; invitation_link: string }> };
}

// ── Get Contact by ID ─────────────────────────────────────

export async function getContactById(
  id: string
): Promise<{ data?: ContactResponse; error?: string }> {
  const db = createServerClient();

  const { data, error } = await db
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return { error: 'Contact not found' };
  return { data: data as ContactResponse };
}
