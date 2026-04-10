export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { normalizePublicUrl } from '@/lib/app-url';
import { getWhatsAppProvider, getWhatsAppRuntimeBlockReason } from '@/lib/runtime';
import { apiSuccess, apiError } from '@/lib/utils';
import { startBulkSend, stopBulkSend, DEFAULT_CONFIG, sendInviteItem, type BulkSendConfig, type BulkSendItem } from '@/lib/wa-sender';
import { getPendingContacts, markInviteSent } from '@/services/contact.service';
import { createServerClient } from '@/lib/supabase/server';
import { type EventContext } from '@/lib/whatsapp';

// POST /api/whatsapp/send — start bulk send
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');
    const blockedReason = getWhatsAppRuntimeBlockReason();
    if (blockedReason) return apiError(blockedReason, 400, 'WHATSAPP_DISABLED');

    const body = await request.json().catch(() => ({}));
    const eventId = body.event_id as string;
    if (!eventId) return apiError('event_id is required', 400);

    const config: BulkSendConfig = {
      minDelayMs: body.min_delay_ms ?? DEFAULT_CONFIG.minDelayMs,
      maxDelayMs: body.max_delay_ms ?? DEFAULT_CONFIG.maxDelayMs,
      batchSize: body.batch_size ?? DEFAULT_CONFIG.batchSize,
      batchBreakMs: body.batch_break_ms ?? DEFAULT_CONFIG.batchBreakMs,
    };
    const provider = getWhatsAppProvider();
    const skipIds = new Set(Array.isArray(body.skip_ids) ? body.skip_ids.filter((id: unknown) => typeof id === 'string') : []);
    const stepLimit = Math.min(10, Math.max(1, Number(body.limit ?? 1) || 1));

    // Load pending contacts from DB (status = uploaded or invited but not confirmed)
    const result = await getPendingContacts(eventId);
    if (result.error || !result.data) {
      return apiError(result.error || 'Failed to load contacts', 500);
    }

    const contacts = result.data
      .filter((contact) => !skipIds.has(contact.id))
      .map((contact) => ({
        ...contact,
        invitation_link: normalizePublicUrl(contact.invitation_link, request.nextUrl.origin),
      }));
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

    if (provider === 'cloud_api') {
      const selected = contacts.slice(0, stepLimit);
      const errors: Array<{ id: string; mobile: string; reason: string }> = [];
      let sent = 0;
      let failed = 0;

      for (const contact of selected) {
        const item: BulkSendItem = {
          id: contact.id,
          mobile: contact.mobile,
          invitation_link: contact.invitation_link,
        };
        const sendResult = await sendInviteItem(item, ctx);
        if (sendResult.success) {
          sent++;
          await markInviteSent(contact.id);
        } else {
          failed++;
          errors.push({
            id: contact.id,
            mobile: contact.mobile,
            reason: sendResult.error || 'Failed to send invite',
          });
        }
      }

      const remaining = Math.max(0, contacts.length - selected.length);
      return apiSuccess({
        mode: 'cloud_api',
        total: contacts.length,
        processed: selected.length,
        sent,
        failed,
        remaining,
        errors,
        contacts: selected.map((contact) => ({ id: contact.id, mobile: contact.mobile })),
      });
    }

    startBulkSend(contacts, config, ctx);

    return apiSuccess({ mode: 'web', queued: contacts.length });
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
