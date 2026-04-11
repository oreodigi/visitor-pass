export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';
import { requireApiRole, ApiAuthError } from '@/lib/api-token-auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(request, 'admin', 'manager');
    const db = createServerClient();

    if (user.role === 'manager') {
      const { data, error } = await db
        .from('user_event_assignments')
        .select('events(id,title,event_date,start_time,end_time,venue_name,status)')
        .eq('user_id', user.id)
        .eq('assigned_role', 'manager');

      if (error) return apiError('Failed to load assigned events', 500);
      const events = (data || [])
        .map((row) => row.events)
        .filter(Boolean);
      return apiSuccess({ events });
    }

    const { data, error } = await db
      .from('events')
      .select('id,title,event_date,start_time,end_time,venue_name,status')
      .order('event_date', { ascending: false });

    if (error) return apiError('Failed to load events', 500);
    return apiSuccess({ events: data || [] });
  } catch (err) {
    if (err instanceof ApiAuthError) return apiError(err.message, err.status);
    console.error('GET /api/sms-runner/events error:', err);
    return apiError('Internal server error', 500);
  }
}
