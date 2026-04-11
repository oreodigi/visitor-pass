export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { normalizePublicUrl } from '@/lib/app-url';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';
import { buildInviteMessage, buildPassMessage, type EventContext } from '@/lib/whatsapp';
import { authorizeLocalRunner } from '@/lib/local-runner-auth';

type RunnerMode = 'invites' | 'passes';

function parseMode(value: string | null): RunnerMode {
  return value === 'passes' ? 'passes' : 'invites';
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const eventId = searchParams.get('event_id');
  const mode = parseMode(searchParams.get('mode'));
  const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') || 100) || 100));

  if (!eventId) return apiError('event_id is required', 400);
  const runnerAuth = await authorizeLocalRunner(request, eventId);
  if (!runnerAuth) {
    return apiError('Unauthorized local runner request', 401, 'RUNNER_UNAUTHORIZED');
  }

  const db = createServerClient();
  const { data: eventRow, error: eventError } = await db
    .from('events')
    .select('id,title,event_date,start_time,end_time,venue_name,support_contact_number,invite_message_template,pass_message_template,pass_terms_conditions')
    .eq('id', eventId)
    .single();

  if (eventError || !eventRow) return apiError('Event not found', 404);

  const ctx: EventContext = {
    title: eventRow.title,
    event_date: eventRow.event_date,
    start_time: eventRow.start_time,
    end_time: eventRow.end_time,
    venue_name: eventRow.venue_name,
    support_contact_number: eventRow.support_contact_number ?? undefined,
    invite_message_template: eventRow.invite_message_template ?? null,
    pass_message_template: eventRow.pass_message_template ?? null,
    pass_terms_conditions: eventRow.pass_terms_conditions ?? null,
  };

  if (mode === 'passes') {
    const { data, error } = await db
      .from('attendees')
      .select('id,name,mobile,seat_number,pass_url,whatsapp_status')
      .eq('event_id', eventId)
      .not('pass_generated_at', 'is', null)
      .not('pass_url', 'is', null)
      .in('whatsapp_status', ['ready', 'failed', 'opened'])
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) return apiError('Failed to load generated passes', 500);

    return apiSuccess({
      event: { id: eventRow.id, title: eventRow.title },
      mode,
      recipients: (data || []).map((row) => ({
        id: row.id,
        mobile: row.mobile,
        message: buildPassMessage(
          row.name || '',
          normalizePublicUrl(row.pass_url, origin),
          row.seat_number || '',
          ctx,
        ),
      })),
    });
  }

  const { data, error } = await db
    .from('contacts')
    .select('id,mobile,invitation_link')
    .eq('event_id', eventId)
    .eq('status', 'uploaded')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) return apiError('Failed to load pending contacts', 500);

  return apiSuccess({
    event: { id: eventRow.id, title: eventRow.title },
    mode,
    recipients: (data || []).map((row) => ({
      id: row.id,
      mobile: row.mobile,
      message: buildInviteMessage(normalizePublicUrl(row.invitation_link, origin), ctx),
    })),
  });
}
