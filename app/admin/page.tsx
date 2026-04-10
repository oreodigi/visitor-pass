'use client';

import { useEffect, useState } from 'react';

interface DashboardData {
  events: { total: number; active: number; completed: number };
  contacts: { total: number; invited: number; confirmed: number };
  attendees: { total: number; pass_generated: number; checked_in: number; pending: number; today: number };
  staff: { total: number; managers: number; event_staff: number; active: number };
  active_event: {
    id: string; title: string; event_date: string; start_time: string; end_time: string;
    venue_name: string; venue_address: string; venue_contact_number: string | null;
    organizer_contact_number: string | null; support_contact_number: string | null; status: string;
  } | null;
  funnel: { uploaded: number; invited: number; form_submitted: number; confirmed: number; pass_generated: number; checked_in: number };
  recent_checkins: Array<{ id: string; status: string; gate_name: string | null; created_at: string; attendee_name: string | null; attendee_pass: string | null }>;
  recent_confirmations: Array<{ id: string; name: string | null; mobile: string; pass_number: string | null; created_at: string }>;
}

function fmt12h(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function fmtDate(d: string) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function fmtDateLong(d: string) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

function fmtRelative(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function pct(a: number, b: number) {
  return !b ? 0 : Math.round((a / b) * 100);
}

function Skel({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-3xl bg-slate-200 ${className}`} />;
}

function SectionHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{title}</h2>
        {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  sub,
  href,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  tone: string;
  icon: React.ReactNode;
}) {
  const inner = (
    <div className={`group relative overflow-hidden rounded-[28px] border border-white/60 p-4 shadow-sm transition-transform duration-150 active:scale-[.985] sm:p-5 ${tone}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/30 to-transparent" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/60 text-slate-900 shadow-sm backdrop-blur-sm">
          {icon}
        </div>
        {href && (
          <div className="rounded-full bg-white/55 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Open
          </div>
        )}
      </div>
      <div className="relative mt-7">
        <div className="text-3xl font-black leading-none tracking-tight text-slate-950">{value}</div>
        {sub && <div className="mt-2 text-sm font-medium text-slate-600">{sub}</div>}
        <div className="mt-4 text-sm font-semibold text-slate-800">{label}</div>
      </div>
    </div>
  );

  return href ? <a href={href} className="block">{inner}</a> : inner;
}

function SnapshotCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string | number;
  detail: string;
  accent: string;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`h-1.5 w-16 rounded-full ${accent}`} />
      <div className="mt-5 text-3xl font-black tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-sm font-semibold text-slate-700">{label}</div>
      <div className="mt-3 text-xs leading-relaxed text-slate-500">{detail}</div>
    </div>
  );
}

function FunnelMeter({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
}) {
  const width = pct(value, max);
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <div className="mt-1 text-xs text-slate-500">{width}% of uploaded audience</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black tracking-tight text-slate-950">{value}</div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Count</div>
        </div>
      </div>
      <div className="mt-4 h-2.5 rounded-full bg-slate-100">
        <div className={`h-2.5 rounded-full transition-all duration-700 ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ActionTile({
  label,
  href,
  icon,
  tone,
  note,
}: {
  label: string;
  href: string;
  icon: string;
  tone: string;
  note: string;
}) {
  return (
    <a
      href={href}
      className={`group flex min-h-[124px] flex-col justify-between rounded-[28px] p-4 text-white shadow-sm transition-transform duration-150 active:scale-[.98] ${tone}`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">
        {icon}
      </div>
      <div>
        <div className="text-base font-bold">{label}</div>
        <div className="mt-1 text-xs leading-relaxed text-white/75">{note}</div>
      </div>
    </a>
  );
}

function ActivityPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition-colors ${
        active ? 'bg-slate-950 text-white shadow-sm' : 'bg-white text-slate-500 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activityTab, setActivityTab] = useState<'checkins' | 'passes'>('checkins');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/dashboard');
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error?.message || 'Failed to load');
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const desktopToday = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const primaryStats = data ? [
    {
      label: 'Live Events',
      value: data.events.active,
      sub: `${data.events.total} total events in system`,
      href: '/admin/event-settings',
      tone: 'bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,.35),_rgba(255,255,255,.92)_45%,_rgba(224,231,255,.95)_100%)]',
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" /></svg>,
    },
    {
      label: 'Contacts Ready',
      value: data.contacts.total.toLocaleString(),
      sub: `${data.contacts.invited} already invited`,
      href: '/admin/contacts',
      tone: 'bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,.34),_rgba(255,255,255,.92)_45%,_rgba(243,232,255,.96)_100%)]',
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>,
    },
    {
      label: 'Confirmed Visitors',
      value: data.contacts.confirmed.toLocaleString(),
      sub: `${pct(data.contacts.confirmed, data.contacts.total)}% conversion from contacts`,
      href: '/admin/attendees',
      tone: 'bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,.32),_rgba(255,255,255,.92)_45%,_rgba(255,237,213,.96)_100%)]',
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      label: 'Passes Issued',
      value: data.attendees.pass_generated.toLocaleString(),
      sub: `${data.attendees.pending} still pending entry`,
      href: '/admin/attendees',
      tone: 'bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,.28),_rgba(255,255,255,.92)_45%,_rgba(252,231,243,.96)_100%)]',
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg>,
    },
  ] : [];

  const snapshots = data ? [
    {
      label: 'Checked In',
      value: data.attendees.checked_in,
      detail: `${data.attendees.today} visitors entered today`,
      accent: 'bg-emerald-500',
    },
    {
      label: 'Pending Entry',
      value: data.attendees.pending,
      detail: `${pct(data.attendees.checked_in, data.attendees.pass_generated)}% scan completion rate`,
      accent: 'bg-amber-400',
    },
    {
      label: 'Managers',
      value: data.staff.managers,
      detail: `${data.staff.active} staff active across the operation`,
      accent: 'bg-fuchsia-500',
    },
    {
      label: 'Gate Staff',
      value: data.staff.event_staff,
      detail: `${data.staff.total} total team accounts configured`,
      accent: 'bg-cyan-500',
    },
  ] : [];

  const quickActions = [
    { label: 'Events', href: '/admin/event-settings', icon: '🗓️', tone: 'bg-gradient-to-br from-indigo-600 via-brand-600 to-violet-600', note: 'Launch or edit event settings' },
    { label: 'Contacts', href: '/admin/import', icon: '📤', tone: 'bg-gradient-to-br from-violet-600 to-fuchsia-600', note: 'Import fresh CSV lists fast' },
    { label: 'Visitors', href: '/admin/attendees', icon: '✅', tone: 'bg-gradient-to-br from-emerald-600 to-teal-600', note: 'Issue passes and manage entries' },
    { label: 'Invites', href: '/admin/contacts', icon: '📨', tone: 'bg-gradient-to-br from-amber-500 to-orange-500', note: 'Track delivery and confirmations' },
    { label: 'Bulk Send', href: '/admin/send-invites', icon: '🚀', tone: 'bg-gradient-to-br from-rose-600 to-pink-600', note: 'Run invite campaigns in batches' },
    { label: 'Staff', href: '/admin/staff', icon: '👥', tone: 'bg-gradient-to-br from-sky-600 to-cyan-600', note: 'Manage managers and gate teams' },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,.08),_transparent_28%),linear-gradient(to_bottom,_#f8fafc,_#f8fafc)]">
      <div className="lg:hidden sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Overview</p>
            <h1 className="mt-1 text-lg font-black tracking-tight text-slate-950">Control Room</h1>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6 sm:pb-12 sm:pt-6">
        <div className="hidden lg:flex lg:items-end lg:justify-between lg:gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Admin Overview</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Dashboard</h1>
            <p className="mt-2 text-sm text-slate-500">{desktopToday}</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh Data
          </button>
        </div>

        <div className="mt-4 space-y-6 sm:mt-6 sm:space-y-8">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
          )}

          {loading ? (
            <Skel className="h-[220px] sm:h-[250px]" />
          ) : data?.active_event ? (
            <a href="/admin/event-settings" className="block">
              <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,_#0f172a_0%,_#1e1b4b_35%,_#4338ca_75%,_#7c3aed_100%)] p-5 text-white shadow-[0_20px_60px_-20px_rgba(79,70,229,.45)] sm:p-7">
                <div className="absolute -right-12 top-0 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute bottom-0 left-1/3 h-28 w-28 rounded-full bg-cyan-300/10 blur-2xl" />
                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/75 backdrop-blur-sm">
                      Active Event
                    </div>
                    <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{data.active_event.title}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/72">
                      Operations are live. Use this event as your current control point for invites, passes, check-ins, and seat coordination.
                    </p>
                    <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Date</div>
                        <div className="mt-1 font-semibold text-white">{fmtDateLong(data.active_event.event_date)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Window</div>
                        <div className="mt-1 font-semibold text-white">{fmt12h(data.active_event.start_time)} - {fmt12h(data.active_event.end_time)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Venue</div>
                        <div className="mt-1 font-semibold text-white">{data.active_event.venue_name}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 lg:block lg:text-right">
                    <div className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/15 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
                      {data.active_event.status}
                    </div>
                    <div className="mt-0 text-sm text-white/70 lg:mt-6">Tap to manage event settings</div>
                  </div>
                </div>
              </div>
            </a>
          ) : (
            <a href="/admin/event-settings" className="block rounded-[30px] border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                </svg>
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950">No active event</h2>
              <p className="mt-2 text-sm text-slate-500">Create or activate an event to unlock the invite, pass, and check-in flow.</p>
            </a>
          )}

          <section className="space-y-4">
            <SectionHeader eyebrow="Live Numbers" title="Overview" sub="The operational snapshot you need first, optimized for quick scanning on desktop and mobile." />
            {loading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-44" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {primaryStats.map((stat) => <MetricTile key={stat.label} {...stat} />)}
              </div>
            )}
          </section>

          {!loading && data && (
            <section className="space-y-4">
              <SectionHeader eyebrow="Operational Health" title="Attendance & Team" sub="A tighter summary of entry pressure, staffing, and visitor movement." />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {snapshots.map((snapshot) => <SnapshotCard key={snapshot.label} {...snapshot} />)}
              </div>
            </section>
          )}

          {!loading && data && (
            <section className="space-y-4">
              <SectionHeader eyebrow="Pipeline" title="Visitor Funnel" sub="Track movement from uploaded lead to physical check-in without losing mobile readability." />
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {[
                  { label: 'Uploaded', value: data.funnel.uploaded, tone: 'bg-brand-600' },
                  { label: 'Invited', value: data.funnel.invited, tone: 'bg-violet-500' },
                  { label: 'Submitted', value: data.funnel.form_submitted, tone: 'bg-fuchsia-500' },
                  { label: 'Confirmed', value: data.funnel.confirmed, tone: 'bg-amber-500' },
                  { label: 'Pass Ready', value: data.funnel.pass_generated, tone: 'bg-emerald-500' },
                  { label: 'Checked In', value: data.funnel.checked_in, tone: 'bg-cyan-500' },
                ].map((step) => (
                  <FunnelMeter key={step.label} label={step.label} value={step.value} max={data.funnel.uploaded} tone={step.tone} />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <SectionHeader eyebrow="Actions" title="Move Faster" sub="High-frequency admin tasks grouped for thumb access on mobile and rapid execution on desktop." />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              {quickActions.map((action) => <ActionTile key={action.label} {...action} />)}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeader
                eyebrow="Activity"
                title="Recent Movement"
                sub={activityTab === 'checkins' ? 'Latest entry activity from the gate.' : 'Most recent confirmed visitors and issued passes.'}
              />
              <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
                <ActivityPill active={activityTab === 'checkins'} label="Check-ins" onClick={() => setActivityTab('checkins')} />
                <ActivityPill active={activityTab === 'passes'} label="Passes" onClick={() => setActivityTab('passes')} />
              </div>
            </div>

            {loading ? (
              <Skel className="h-72" />
            ) : (
              <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
                {activityTab === 'checkins' && (
                  <>
                    {!data?.recent_checkins?.length ? (
                      <div className="px-6 py-14 text-center">
                        <div className="text-4xl">📭</div>
                        <div className="mt-3 text-base font-semibold text-slate-700">No check-ins yet</div>
                        <div className="mt-1 text-sm text-slate-400">Gate activity will appear here once scanning starts.</div>
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {data.recent_checkins.map((log) => (
                          <li key={log.id} className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-slate-50 sm:px-6">
                            <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
                              log.status === 'valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {log.status === 'valid' ? 'IN' : 'DU'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-bold text-slate-950 sm:text-base">{log.attendee_name || 'Unknown visitor'}</div>
                              <div className="mt-1 text-xs text-slate-500 sm:text-sm">
                                {log.attendee_pass || 'No pass'}{log.gate_name ? ` · ${log.gate_name}` : ''}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                                log.status === 'valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {log.status}
                              </div>
                              <div className="mt-2 text-[11px] font-medium text-slate-400">{fmtRelative(log.created_at)}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {activityTab === 'passes' && (
                  <>
                    {!data?.recent_confirmations?.length ? (
                      <div className="px-6 py-14 text-center">
                        <div className="text-4xl">🎟️</div>
                        <div className="mt-3 text-base font-semibold text-slate-700">No passes generated yet</div>
                        <div className="mt-1 text-sm text-slate-400">Confirmed visitors will appear here as soon as passes are issued.</div>
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {data.recent_confirmations.map((a) => (
                          <li key={a.id} className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-slate-50 sm:px-6">
                            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-sm font-black text-brand-700">
                              {(a.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-bold text-slate-950 sm:text-base">{a.name || 'Unknown visitor'}</div>
                              <div className="mt-1 text-xs text-slate-500 sm:text-sm">{a.mobile}</div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-xs font-black tracking-wide text-slate-800">{a.pass_number || 'Pending'}</div>
                              <div className="mt-2 text-[11px] font-medium text-slate-400">{fmtRelative(a.created_at)}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
