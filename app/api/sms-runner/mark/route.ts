export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';
import { requireApiRole, ApiAuthError } from '@/lib/api-token-auth';

const SMS_CHANNEL = 'sms://local-device';

async function canAccessEvent(db: ReturnType<typeof createServerClient>, userId: string, eventId: string) {
  const { data } = await db
    .from('user_event_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .eq('assigned_role', 'manager')
    .maybeSingle();

  return Boolean(data);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiRole(request, 'admin', 'manager');
    const body = await request.json().catch(() => null) as {
      event_id?: string;
      attendee_id?: string;
      mobile?: string;
      message?: string;
      status?: 'sent' | 'failed';
      error?: string;
    } | null;

    if (!body?.event_id) return apiError('event_id is required', 400);
    if (!body?.attendee_id) return apiError('attendee_id is required', 400);
    if (!body?.mobile) return apiError('mobile is required', 400);

    const db = createServerClient();
    if (user.role === 'manager' && !(await canAccessEvent(db, user.id, body.event_id))) {
      return apiError('This event is not assigned to this manager', 403);
    }

    const status = body.status === 'failed' ? 'failed' : 'sent';
    const { error } = await db.from('message_logs').insert({
      event_id: body.event_id,
      attendee_id: body.attendee_id,
      mobile: body.mobile,
      message_text: status === 'failed'
        ? `${body.message || ''}\n\nSMS_ERROR: ${body.error || 'Unknown error'}`.trim()
        : body.message || null,
      whatsapp_link: SMS_CHANNEL,
      status,
      opened_by: user.id,
    });

    if (error) {
      console.error('POST /api/sms-runner/mark insert error:', error);
      return apiError('Failed to save SMS status', 500);
    }

    return apiSuccess({ updated: true });
  } catch (err) {
    if (err instanceof ApiAuthError) return apiError(err.message, err.status);
    console.error('POST /api/sms-runner/mark error:', err);
    return apiError('Internal server error', 500);
  }
}
