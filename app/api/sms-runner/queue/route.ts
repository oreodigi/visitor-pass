export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { normalizePublicUrl } from '@/lib/app-url';
import { createServerClient } from '@/lib/supabase/server';
import { requireApiRole, ApiAuthError } from '@/lib/api-token-auth';
import { buildPassSmsMessage } from '@/lib/sms';

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

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(request, 'admin', 'manager');
    const { searchParams, origin } = request.nextUrl;
    const eventId = searchParams.get('event_id');
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') || 50) || 50));

    if (!eventId) return apiError('event_id is required', 400);

    const db = createServerClient();
    if (user.role === 'manager' && !(await canAccessEvent(db, user.id, eventId))) {
      return apiError('This event is not assigned to this manager', 403);
    }

    const { data: event, error: eventError } = await db
      .from('events')
      .select('id,title,event_date,venue_name')
      .eq('id', eventId)
      .single();

    if (eventError || !event) return apiError('Event not found', 404);

    const { data: attendees, error: attendeeError } = await db
      .from('attendees')
      .select('id,name,mobile,pass_url,pass_generated_at')
      .eq('event_id', eventId)
      .not('pass_generated_at', 'is', null)
      .not('pass_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(500);

    if (attendeeError) return apiError('Failed to load pass SMS queue', 500);

    const attendeeIds = (attendees || []).map((attendee) => attendee.id);
    const sentIds = new Set<string>();
    if (attendeeIds.length > 0) {
      const { data: sentLogs } = await db
        .from('message_logs')
        .select('attendee_id')
        .eq('event_id', eventId)
        .eq('whatsapp_link', SMS_CHANNEL)
        .eq('status', 'sent')
        .in('attendee_id', attendeeIds);

      for (const log of sentLogs || []) {
        if (log.attendee_id) sentIds.add(log.attendee_id);
      }
    }

    const recipients = (attendees || [])
      .filter((attendee) => !sentIds.has(attendee.id))
      .slice(0, limit)
      .map((attendee) => {
        const passUrl = normalizePublicUrl(attendee.pass_url, origin);
        return {
          id: attendee.id,
          mobile: attendee.mobile,
          name: attendee.name,
          message: buildPassSmsMessage({ event, passUrl }),
        };
      });

    return apiSuccess({
      event,
      total_passes: attendees?.length || 0,
      already_sent: sentIds.size,
      pending: Math.max(0, (attendees?.length || 0) - sentIds.size),
      recipients,
    });
  } catch (err) {
    if (err instanceof ApiAuthError) return apiError(err.message, err.status);
    console.error('GET /api/sms-runner/queue error:', err);
    return apiError('Internal server error', 500);
  }
}
