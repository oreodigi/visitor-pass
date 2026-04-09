export const dynamic = 'force-dynamic';

import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/admin/dashboard — full system metrics overview
export async function GET() {
  try {
    await requireRole('admin');
    const db = createServerClient();

    // Run independent queries in parallel
    const [
      eventsRes,
      contactsRes,
      attendeesRes,
      staffRes,
      activeEventRes,
      recentCheckinsRes,
      recentConfRes,
    ] = await Promise.all([
      // Events breakdown
      db.from('events').select('id, status'),

      // Contacts (invite funnel)
      db.from('contacts').select('id, status, whatsapp_invite_status'),

      // Attendees (pass/checkin funnel)
      db.from('attendees').select('id, pass_generated_at, checked_in_at, created_at'),

      // Staff (non-admin users)
      db.from('users').select('id, role, active').neq('role', 'admin'),

      // Active/most-recent event details
      db
        .from('events')
        .select('id, title, event_date, start_time, end_time, venue_name, venue_address, venue_contact_number, organizer_contact_number, support_contact_number, status')
        .in('status', ['active', 'draft'])
        .order('event_date', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Recent check-ins (last 10)
      db
        .from('checkin_logs')
        .select('id, status, gate_name, created_at, attendees(name, pass_number)')
        .in('status', ['valid', 'duplicate'])
        .order('created_at', { ascending: false })
        .limit(10),

      // Recent confirmations (last 10 attendees with pass)
      db
        .from('attendees')
        .select('id, name, mobile, pass_number, created_at')
        .not('pass_generated_at', 'is', null)
        .order('pass_generated_at', { ascending: false })
        .limit(10),
    ]);

    const events = eventsRes.data || [];
    const contacts = contactsRes.data || [];
    const attendees = attendeesRes.data || [];
    const staffUsers = staffRes.data || [];

    // Today midnight
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Events stats
    const eventsStats = {
      total: events.length,
      active: events.filter((e) => e.status === 'active').length,
      completed: events.filter((e) => e.status === 'completed').length,
    };

    // Contacts stats
    const contactsStats = {
      total: contacts.length,
      invited: contacts.filter((c) => c.status === 'invited' || c.status === 'confirmed').length,
      confirmed: contacts.filter((c) => c.status === 'confirmed').length,
    };

    // Attendees stats
    const passGenerated = attendees.filter((a) => a.pass_generated_at !== null);
    const checkedIn = attendees.filter((a) => a.checked_in_at !== null);
    const todayCheckins = checkedIn.filter((a) => new Date(a.checked_in_at!) >= todayStart);

    const attendeesStats = {
      total: attendees.length,
      pass_generated: passGenerated.length,
      checked_in: checkedIn.length,
      pending: passGenerated.length - checkedIn.length,
      today: todayCheckins.length,
    };

    // Staff stats
    const staffStats = {
      total: staffUsers.length,
      managers: staffUsers.filter((u) => u.role === 'manager').length,
      event_staff: staffUsers.filter((u) => u.role === 'gate_staff').length,
      active: staffUsers.filter((u) => u.active).length,
    };

    // Visitor funnel
    const funnel = {
      uploaded: contacts.length,
      invited: contacts.filter((c) => c.whatsapp_invite_status === 'sent').length,
      form_submitted: contacts.filter((c) => c.status === 'confirmed').length,
      confirmed: attendees.length,
      pass_generated: passGenerated.length,
      checked_in: checkedIn.length,
    };

    // Recent check-ins — flatten Supabase nested object
    const recentCheckins = (recentCheckinsRes.data || []).map((log) => {
      const att = log.attendees as unknown as { name: string | null; pass_number: string | null } | null;
      return {
        id: log.id,
        status: log.status,
        gate_name: log.gate_name,
        created_at: log.created_at,
        attendee_name: att?.name ?? null,
        attendee_pass: att?.pass_number ?? null,
      };
    });

    return apiSuccess({
      events: eventsStats,
      contacts: contactsStats,
      attendees: attendeesStats,
      staff: staffStats,
      active_event: activeEventRes.data || null,
      funnel,
      recent_checkins: recentCheckins,
      recent_confirmations: recentConfRes.data || [],
    });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
