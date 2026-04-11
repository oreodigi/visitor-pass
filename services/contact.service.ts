import { createServerClient } from '@/lib/supabase/server';
import { buildAppUrl } from '@/lib/app-url';
import { generateInviteToken } from '@/lib/token';
import { normalizeMobile, isValidMobile, sanitizeString } from '@/lib/utils';
import type {
  ContactResponse,
  ContactListResponse,
  ImportContactsResult,
} from '@/types';

// ── Import Contacts from CSV ──────────────────────────────

export async function importContacts(
  eventId: string,
  rows: Array<{ mobile: string }>,
  appOrigin?: string
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
      invitation_link: buildAppUrl(`/i/${token}`, appOrigin),
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

type ContactPassDelivery = {
  id: string;
  contact_id: string | null;
  mobile: string;
  whatsapp_status: 'pending' | 'ready' | 'sent' | 'opened' | 'failed';
  whatsapp_sent_marked_at: string | null;
  pass_generated_at: string | null;
  pass_url: string | null;
};

function enrichContactsWithPassDelivery(
  contacts: ContactResponse[],
  attendees: ContactPassDelivery[]
): ContactResponse[] {
  const byAttendeeId = new Map(attendees.map((attendee) => [attendee.id, attendee]));
  const byContactId = new Map(
    attendees
      .filter((attendee) => attendee.contact_id)
      .map((attendee) => [attendee.contact_id as string, attendee])
  );
  const byMobile = new Map(attendees.map((attendee) => [attendee.mobile, attendee]));

  return contacts.map((contact) => {
    const attendee =
      byContactId.get(contact.id) ||
      (contact.attendee_id ? byAttendeeId.get(contact.attendee_id) : undefined) ||
      byMobile.get(contact.mobile);

    if (!attendee) return contact;

    return {
      ...contact,
      attendee_id: contact.attendee_id || attendee.id,
      pass_whatsapp_status: attendee.whatsapp_status,
      pass_whatsapp_sent_at: attendee.whatsapp_sent_marked_at,
      pass_generated_at: attendee.pass_generated_at,
      pass_url: attendee.pass_url,
    };
  });
}

export async function markContactPassSent(
  contactId: string
): Promise<{ success: boolean; error?: string }> {
  const db = createServerClient();
  const now = new Date().toISOString();

  const { data: contact, error: contactError } = await db
    .from('contacts')
    .select('id,event_id,mobile,status,attendee_id,invited_at')
    .eq('id', contactId)
    .single();

  if (contactError || !contact) return { success: false, error: 'Contact not found' };

  let attendeeQuery = db
    .from('attendees')
    .select('id,event_id,mobile,contact_id,pass_url')
    .eq('event_id', contact.event_id)
    .limit(1);

  attendeeQuery = contact.attendee_id
    ? attendeeQuery.eq('id', contact.attendee_id)
    : attendeeQuery.eq('mobile', contact.mobile);

  const { data: attendees, error: attendeeError } = await attendeeQuery;
  const attendee = attendees?.[0];

  if (attendeeError || !attendee) {
    return { success: false, error: 'No generated pass found for this contact yet' };
  }

  const { error: attendeeUpdateError } = await db
    .from('attendees')
    .update({
      whatsapp_status: 'sent',
      whatsapp_sent_marked_at: now,
      contact_id: attendee.contact_id || contact.id,
    })
    .eq('id', attendee.id)
    .eq('event_id', contact.event_id);

  if (attendeeUpdateError) {
    console.error('markContactPassSent attendee update error:', attendeeUpdateError);
    return { success: false, error: 'Failed to mark pass as sent' };
  }

  const contactUpdate: Record<string, string | null> = {
    attendee_id: attendee.id,
    whatsapp_invite_status: 'sent',
    invited_at: contact.invited_at || now,
  };
  if (contact.status === 'uploaded') contactUpdate.status = 'invited';

  const { error: contactUpdateError } = await db
    .from('contacts')
    .update(contactUpdate)
    .eq('id', contact.id);

  if (contactUpdateError) {
    console.error('markContactPassSent contact update error:', contactUpdateError);
    return { success: false, error: 'Pass marked, but contact sync failed' };
  }

  await db.from('message_logs').insert({
    event_id: contact.event_id,
    attendee_id: attendee.id,
    mobile: contact.mobile,
    message_text: 'Marked as pass sent manually from Contacts & Invites.',
    whatsapp_link: 'manual-whatsapp://contacts',
    status: 'sent',
  });

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

  const contacts = (data || []) as ContactResponse[];
  const attendeeIds = contacts
    .map((contact) => contact.attendee_id)
    .filter((id): id is string => Boolean(id));
  const mobiles = contacts.map((contact) => contact.mobile);
  const attendeeMap = new Map<string, ContactPassDelivery>();

  if (attendeeIds.length > 0) {
    const { data: attendeesById } = await db
      .from('attendees')
      .select('id,contact_id,mobile,whatsapp_status,whatsapp_sent_marked_at,pass_generated_at,pass_url')
      .eq('event_id', event_id)
      .in('id', attendeeIds);

    for (const attendee of (attendeesById || []) as ContactPassDelivery[]) {
      attendeeMap.set(attendee.id, attendee);
    }
  }

  if (mobiles.length > 0) {
    const { data: attendeesByMobile } = await db
      .from('attendees')
      .select('id,contact_id,mobile,whatsapp_status,whatsapp_sent_marked_at,pass_generated_at,pass_url')
      .eq('event_id', event_id)
      .in('mobile', mobiles);

    for (const attendee of (attendeesByMobile || []) as ContactPassDelivery[]) {
      attendeeMap.set(attendee.id, attendee);
    }
  }

  const total = count || 0;
  return {
    data: {
      contacts: enrichContactsWithPassDelivery(contacts, [...attendeeMap.values()]),
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
    .eq('status', 'uploaded')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getPendingContacts error:', error);
    return { error: 'Failed to fetch pending contacts' };
  }

  return { data: (data || []) as Array<{ id: string; mobile: string; invitation_link: string }> };
}

// ── Bulk Delete Contacts ──────────────────────────────────

export async function deleteContacts(
  ids: string[]
): Promise<{ success: boolean; deleted: number; error?: string }> {
  if (ids.length === 0) return { success: true, deleted: 0 };
  const db = createServerClient();
  const { error, count } = await db
    .from('contacts')
    .delete({ count: 'exact' })
    .in('id', ids);
  if (error) {
    console.error('deleteContacts error:', error);
    return { success: false, deleted: 0, error: 'Failed to delete contacts' };
  }
  return { success: true, deleted: count ?? ids.length };
}

// ── Bulk Mark Invited ─────────────────────────────────────

export async function bulkMarkInvited(
  ids: string[]
): Promise<{ success: boolean; updated: number; error?: string }> {
  if (ids.length === 0) return { success: true, updated: 0 };
  const db = createServerClient();
  const { error, count } = await db
    .from('contacts')
    .update(
      { status: 'invited', whatsapp_invite_status: 'sent', invited_at: new Date().toISOString() },
      { count: 'exact' }
    )
    .in('id', ids)
    .in('status', ['uploaded', 'invited']);
  if (error) {
    console.error('bulkMarkInvited error:', error);
    return { success: false, updated: 0, error: 'Failed to update contacts' };
  }
  return { success: true, updated: count ?? 0 };
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
