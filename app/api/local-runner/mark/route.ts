export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';
import { authorizeLocalRunner } from '@/lib/local-runner-auth';

type RunnerMode = 'invites' | 'passes';

function parseMode(value: unknown): RunnerMode {
  return value === 'passes' ? 'passes' : 'invites';
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    id?: string;
    event_id?: string;
    mode?: RunnerMode;
    status?: 'sent' | 'failed';
    error?: string;
  } | null;

  if (!body?.id) return apiError('id is required', 400);
  if (!body?.event_id) return apiError('event_id is required', 400);
  const runnerAuth = await authorizeLocalRunner(request, body.event_id);
  if (!runnerAuth) {
    return apiError('Unauthorized local runner request', 401, 'RUNNER_UNAUTHORIZED');
  }

  const mode = parseMode(body.mode);
  const status = body.status === 'failed' ? 'failed' : 'sent';
  const db = createServerClient();

  if (mode === 'passes') {
    const now = new Date().toISOString();
    const { error } = await db
      .from('attendees')
      .update({
        whatsapp_status: status,
        whatsapp_sent_marked_at: status === 'sent' ? now : null,
      })
      .eq('id', body.id)
      .eq('event_id', body.event_id);

    if (error) return apiError('Failed to update attendee WhatsApp status', 500);

    const { data: attendee } = await db
      .from('attendees')
      .select('id,event_id,mobile,contact_id')
      .eq('id', body.id)
      .eq('event_id', body.event_id)
      .maybeSingle();

    if (attendee) {
      if (attendee.contact_id) {
        const contactUpdate: Record<string, string | null> = {
          attendee_id: attendee.id,
        };
        if (status === 'sent') {
          contactUpdate.whatsapp_invite_status = 'sent';
          contactUpdate.invited_at = now;
        }

        const { data: contact } = await db
          .from('contacts')
          .select('id,status')
          .eq('id', attendee.contact_id)
          .maybeSingle();

        if (status === 'sent' && contact?.status === 'uploaded') contactUpdate.status = 'invited';

        await db
          .from('contacts')
          .update(contactUpdate)
          .eq('id', attendee.contact_id);
      } else {
        const { data: contact } = await db
          .from('contacts')
          .select('id,status')
          .eq('event_id', body.event_id)
          .eq('mobile', attendee.mobile)
          .maybeSingle();

        if (contact) {
          const contactUpdate: Record<string, string | null> = {
            attendee_id: attendee.id,
          };
          if (status === 'sent') {
            contactUpdate.whatsapp_invite_status = 'sent';
            contactUpdate.invited_at = now;
          }
          if (status === 'sent' && contact.status === 'uploaded') contactUpdate.status = 'invited';

          await db.from('contacts').update(contactUpdate).eq('id', contact.id);
          await db.from('attendees').update({ contact_id: contact.id }).eq('id', attendee.id);
        }
      }

      await db.from('message_logs').insert({
        event_id: body.event_id,
        attendee_id: attendee.id,
        mobile: attendee.mobile,
        message_text: status === 'failed' ? body.error || 'Local WhatsApp runner failed to send pass.' : 'Pass sent by local WhatsApp runner.',
        whatsapp_link: 'whatsapp://local-runner',
        status,
      });
    }

    return apiSuccess({ updated: true });
  }

  const update = status === 'sent'
    ? { status: 'invited', whatsapp_invite_status: 'sent', invited_at: new Date().toISOString() }
    : { whatsapp_invite_status: 'pending' };

  const { error } = await db
    .from('contacts')
    .update(update)
    .eq('id', body.id)
    .eq('event_id', body.event_id);

  if (error) return apiError('Failed to update contact WhatsApp status', 500);
  return apiSuccess({ updated: true });
}
