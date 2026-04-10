export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { startBulkSend, stopBulkSend, DEFAULT_CONFIG, type BulkSendConfig } from '@/lib/wa-sender';
import { getPendingContacts } from '@/services/contact.service';
import { createServerClient } from '@/lib/supabase/server';
import { type EventContext } from '@/lib/whatsapp';

// POST /api/whatsapp/send — start bulk send
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');

    const body = await request.json().catch(() => ({}));
    const eventId = body.event_id as string;
    if (!eventId) return apiError('event_id is required', 400);

    const config: BulkSendConfig = {
      minDelayMs: body.min_delay_ms ?? DEFAULT_CONFIG.minDelayMs,
      maxDelayMs: body.max_delay_ms ?? DEFAULT_CONFIG.maxDelayMs,
      batchSize: body.batch_size ?? DEFAULT_CONFIG.batchSize,
      batchBreakMs: body.batch_break_ms ?? DEFAULT_CONFIG.batchBreakMs,
    };

    // Load pending contacts from DB (status = uploaded or invited but not confirmed)
    const result = await getPendingContacts(eventId);
    if (result.error || !result.data) {
      return apiError(result.error || 'Failed to load contacts', 500);
    }

    const contacts = result.data;
    if (contacts.length === 0) {
      return apiError('No pending contacts to send invites to', 400, 'NO_CONTACTS');
    }

    // Load event context for message template
    const db = createServerClient();
    const { data: eventRow } = await db
      .from('events')
      .select('title, event_date, venue_name, invite_message_template')
      .eq('id', eventId)
      .maybeSingle();

    const ctx: EventContext | undefined = eventRow
      ? {
          title: eventRow.title,
          event_date: eventRow.event_date,
          venue_name: eventRow.venue_name,
          invite_message_template: eventRow.invite_message_template ?? null,
        }
      : undefined;

    startBulkSend(contacts, config, ctx);

    return apiSuccess({ queued: contacts.length });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('POST /api/whatsapp/send error:', err);
    return apiError('Internal server error', 500);
  }
}

// DELETE /api/whatsapp/send — stop bulk send
export async function DELETE(_request: NextRequest) {
  try {
    await requireRole('admin');
    stopBulkSend();
    return apiSuccess({ message: 'Stop requested' });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
