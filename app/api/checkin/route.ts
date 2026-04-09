export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { isValidToken } from '@/lib/token';
import { createServerClient } from '@/lib/supabase/server';

// POST /api/checkin
// Body: { token: string, gate_name?: string }
// Auth: admin or gate_staff
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole('admin', 'gate_staff');

    const body = await request.json().catch(() => ({}));
    const rawToken = (body.token as string)?.trim();
    const gateName = (body.gate_name as string) || 'Main Gate';

    if (!rawToken) return apiError('token is required', 400);

    // Accept full pass URL or bare token
    const token = rawToken.includes('/p/') ? rawToken.split('/p/').pop()! : rawToken;

    if (!isValidToken(token)) {
      return apiSuccess({ status: 'invalid', reason: 'Unrecognised QR code' });
    }

    const db = createServerClient();

    // Look up attendee by QR token
    const { data: attendee, error: lookupErr } = await db
      .from('attendees')
      .select('id, event_id, name, mobile, business_name, pass_number, seat_number, checked_in_at')
      .eq('qr_token', token)
      .single();

    if (lookupErr || !attendee) {
      return apiSuccess({ status: 'invalid', reason: 'Pass not found' });
    }

    if (attendee.checked_in_at) {
      // Already checked in — log as duplicate
      await db.from('checkin_logs').insert({
        event_id: attendee.event_id,
        attendee_id: attendee.id,
        scanned_token: token,
        status: 'duplicate',
        scanned_by: session.id,
        gate_name: gateName,
      });

      return apiSuccess({
        status: 'duplicate',
        attendee: {
          name: attendee.name,
          mobile: attendee.mobile,
          business_name: attendee.business_name,
          pass_number: attendee.pass_number,
          seat_number: attendee.seat_number,
          checked_in_at: attendee.checked_in_at,
        },
      });
    }

    // First-time check-in
    const checkedInAt = new Date().toISOString();

    const { error: updateErr } = await db
      .from('attendees')
      .update({ checked_in_at: checkedInAt, checked_in_by: session.id })
      .eq('id', attendee.id);

    if (updateErr) {
      console.error('checkin update error:', updateErr);
      return apiError('Failed to record check-in', 500);
    }

    await db.from('checkin_logs').insert({
      event_id: attendee.event_id,
      attendee_id: attendee.id,
      scanned_token: token,
      status: 'valid',
      scanned_by: session.id,
      gate_name: gateName,
    });

    return apiSuccess({
      status: 'valid',
      attendee: {
        name: attendee.name,
        mobile: attendee.mobile,
        business_name: attendee.business_name,
        pass_number: attendee.pass_number,
        seat_number: attendee.seat_number,
        checked_in_at: checkedInAt,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('POST /api/checkin error:', err);
    return apiError('Internal server error', 500);
  }
}
