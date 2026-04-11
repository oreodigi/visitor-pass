export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

type RunnerMode = 'invites' | 'passes';

function getRunnerToken() {
  return process.env.WHATSAPP_RUNNER_TOKEN || process.env.LOCAL_WHATSAPP_RUNNER_TOKEN || '';
}

function isAuthorized(request: NextRequest) {
  const expected = getRunnerToken();
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${expected}`;
}

function parseMode(value: unknown): RunnerMode {
  return value === 'passes' ? 'passes' : 'invites';
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return apiError('Unauthorized local runner request', 401, 'RUNNER_UNAUTHORIZED');
  }

  const body = await request.json().catch(() => null) as {
    id?: string;
    mode?: RunnerMode;
    status?: 'sent' | 'failed';
    error?: string;
  } | null;

  if (!body?.id) return apiError('id is required', 400);
  const mode = parseMode(body.mode);
  const status = body.status === 'failed' ? 'failed' : 'sent';
  const db = createServerClient();

  if (mode === 'passes') {
    const { error } = await db
      .from('attendees')
      .update({
        whatsapp_status: status,
        whatsapp_sent_marked_at: status === 'sent' ? new Date().toISOString() : null,
      })
      .eq('id', body.id);

    if (error) return apiError('Failed to update attendee WhatsApp status', 500);
    return apiSuccess({ updated: true });
  }

  const update = status === 'sent'
    ? { status: 'invited', whatsapp_invite_status: 'sent', invited_at: new Date().toISOString() }
    : { whatsapp_invite_status: 'pending' };

  const { error } = await db
    .from('contacts')
    .update(update)
    .eq('id', body.id);

  if (error) return apiError('Failed to update contact WhatsApp status', 500);
  return apiSuccess({ updated: true });
}
