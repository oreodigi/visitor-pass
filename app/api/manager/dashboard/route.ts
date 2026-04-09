export const dynamic = 'force-dynamic';

import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/manager/dashboard — manager view of assigned events + operational data
export async function GET() {
  try {
    const session = await requireRole('manager', 'admin');
    const db = createServerClient();

    // Get events assigned to this manager
    const { data: assignments } = await db
      .from('user_event_assignments')
      .select('event_id, events(id, title, event_date, start_time, end_time, venue_name, venue_address, status)')
      .eq('user_id', session.id)
      .eq('assigned_role', 'manager');

    const assignedEventIds = (assignments || []).map((a) => a.event_id);

    if (assignedEventIds.length === 0) {
      return apiSuccess({
        assigned_events: [],
        recent_checkins: [],
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Per-event stats + assigned staff
    const assignedEvents = await Promise.all(
      (assignments || []).map(async (a) => {
        const eventData = a.events as unknown as {
          id: string; title: string; event_date: string;
          start_time: string; end_time: string;
          venue_name: string; venue_address: string; status: string;
        } | null;
        if (!eventData) return null;

        const [attendeesRes, staffRes] = await Promise.all([
          db
            .from('attendees')
            .select('id, pass_generated_at, checked_in_at')
            .eq('event_id', eventData.id),
          db
            .from('user_event_assignments')
            .select('users(id, name, role, designation, active)')
            .eq('event_id', eventData.id),
        ]);

        const attendees = attendeesRes.data || [];
        const passGenerated = attendees.filter((x) => x.pass_generated_at !== null);
        const checkedIn = attendees.filter((x) => x.checked_in_at !== null);
        const todayCheckins = checkedIn.filter((x) => new Date(x.checked_in_at!) >= todayStart);

        const staff = (staffRes.data || [])
          .map((s) => s.users as unknown as { id: string; name: string; role: string; designation: string | null; active: boolean } | null)
          .filter(Boolean);

        return {
          id: eventData.id,
          title: eventData.title,
          event_date: eventData.event_date,
          start_time: eventData.start_time,
          end_time: eventData.end_time,
          venue_name: eventData.venue_name,
          status: eventData.status,
          stats: {
            total_attendees: passGenerated.length,
            checked_in: checkedIn.length,
            pending: passGenerated.length - checkedIn.length,
            today: todayCheckins.length,
          },
          staff,
        };
      })
    );

    const filteredEvents = assignedEvents.filter(Boolean);

    // Recent check-ins across all assigned events (last 20)
    const { data: recentRaw } = await db
      .from('checkin_logs')
      .select('id, status, gate_name, created_at, event_id, attendees(name), events(title)')
      .in('event_id', assignedEventIds)
      .in('status', ['valid', 'duplicate'])
      .order('created_at', { ascending: false })
      .limit(20);

    const recentCheckins = (recentRaw || []).map((log) => {
      const att = log.attendees as unknown as { name: string | null } | null;
      const evt = log.events as unknown as { title: string } | null;
      return {
        id: log.id,
        status: log.status,
        gate_name: log.gate_name,
        created_at: log.created_at,
        attendee_name: att?.name ?? null,
        event_title: evt?.title ?? '',
      };
    });

    return apiSuccess({
      assigned_events: filteredEvents,
      recent_checkins: recentCheckins,
    });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
