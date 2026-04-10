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
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
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
function pct(a: number, b: number) { return !b ? 0 : Math.round((a / b) * 100); }

function Skel({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200 ${className}`} />;
}

// ─── Stat card ────────────────────────────────────────────────

function StatCard({ label, value, sub, gradient, icon, href }: {
  label: string; value: string | number; sub?: string;
  gradient: string; icon: React.ReactNode; href?: string;
}) {
  const inner = (
    <div className={`relative overflow-hidden rounded-2xl p-4 ${gradient} shadow-sm active:scale-[.97] transition-transform`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
          {icon}
        </div>
        {href && (
          <svg className="h-4 w-4 text-white/50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        )}
      </div>
      <div className="text-2xl font-bold text-white tabular-nums leading-none mb-1">{value}</div>
      {sub && <div className="text-xs text-white/70 mb-1.5">{sub}</div>}
      <div className="text-xs font-semibold text-white/80">{label}</div>
    </div>
  );
  return href ? <a href={href} className="block">{inner}</a> : inner;
}

// ─── Funnel row ────────────────────────────────────────────────

function FunnelRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const w = pct(value, max);
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 sm:w-36 shrink-0 text-xs sm:text-sm text-slate-600 truncate">{label}</div>
      <div className="flex-1 min-w-0">
        <div className="h-2 rounded-full bg-slate-100">
          <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${w}%` }} />
        </div>
      </div>
      <div className="w-10 sm:w-12 text-right text-xs sm:text-sm font-semibold text-slate-800 tabular-nums">{value.toLocaleString()}</div>
      <div className="hidden sm:block w-10 text-right text-xs text-slate-400 tabular-nums">{w}%</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activityTab, setActivityTab] = useState<'checkins' | 'passes'>('checkins');

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/dashboard');
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error?.message || 'Failed to load');
    } catch { setError('Network error'); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const STATS = data ? [
    { label: 'Total Events',    value: data.events.total,                       sub: `${data.events.active} active`,       gradient: 'bg-gradient-to-br from-brand-500 to-brand-700',   icon: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" /></svg>, href: '/admin/event-settings' },
    { label: 'Contacts',        value: data.contacts.total.toLocaleString(),    sub: `${data.contacts.invited} invited`,   gradient: 'bg-gradient-to-br from-violet-500 to-violet-700',  icon: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>, href: '/admin/contacts' },
    { label: 'Confirmed',       value: data.contacts.confirmed.toLocaleString(), sub: `${pct(data.contacts.confirmed, data.contacts.total)}% of contacts`, gradient: 'bg-gradient-to-br from-amber-500 to-orange-600', icon: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, href: '/admin/attendees' },
    { label: 'Passes Generated', value: data.attendees.pass_generated.toLocaleString(), sub: `${data.attendees.total} attendees`, gradient: 'bg-gradient-to-br from-purple-500 to-purple-700', icon: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg> },
    { label: 'Checked In',      value: data.attendees.checked_in.toLocaleString(), sub: `${data.attendees.today} today`,  gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600',  icon: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { label: 'Pending Entry',   value: data.attendees.pending.toLocaleString(),  sub: `${pct(data.attendees.checked_in, data.attendees.pass_generated)}% done`, gradient: 'bg-gradient-to-br from-orange-400 to-rose-500', icon: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { label: 'Total Staff',     value: data.staff.total,                         sub: `${data.staff.active} active`,       gradient: 'bg-gradient-to-br from-sky-500 to-cyan-600',      icon: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>, href: '/admin/staff' },
    { label: 'Managers',        value: data.staff.managers,                                                                 gradient: 'bg-gradient-to-br from-rose-500 to-pink-600',     icon: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>, href: '/admin/staff' },
    { label: 'Gate Staff',      value: data.staff.event_staff,                                                              gradient: 'bg-gradient-to-br from-teal-500 to-emerald-600', icon: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg>, href: '/admin/staff' },
  ] : [];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Mobile hero header ────────────────────────────── */}
      <div className="lg:hidden sticky top-0 z-20 bg-gradient-to-r from-brand-700 to-violet-700 px-4 pt-4 pb-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-brand-200 mb-0.5">Admin Dashboard</p>
            <h1 className="text-lg font-bold text-white leading-tight">{today}</h1>
          </div>
          <button
            onClick={load} disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white active:bg-white/25 transition-colors"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Desktop header ────────────────────────────────── */}
      <div className="hidden lg:block border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={load} disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 shadow-soft transition-colors"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-8 pt-4 space-y-5 sm:space-y-8 max-w-7xl mx-auto">

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* ── Active event card ─────────────────────────────── */}
        {loading ? (
          <Skel className="h-32" />
        ) : data?.active_event ? (
          <a href="/admin/event-settings" className="block">
            <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-brand-700 to-violet-700 shadow-md active:scale-[.98] transition-transform">
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-200">Active Event</span>
                    <h2 className="text-lg font-bold text-white leading-snug mt-0.5 truncate">{data.active_event.title}</h2>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                    data.active_event.status === 'active' ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' : 'bg-white/15 text-white/70'
                  }`}>{data.active_event.status}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {[
                    { icon: '📅', text: fmtDate(data.active_event.event_date) },
                    { icon: '🕐', text: `${fmt12h(data.active_event.start_time)} – ${fmt12h(data.active_event.end_time)}` },
                    { icon: '📍', text: data.active_event.venue_name },
                  ].map((r, i) => (
                    <span key={i} className="text-xs text-blue-100/80 flex items-center gap-1">
                      <span>{r.icon}</span>{r.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </a>
        ) : (
          <a href="/admin/event-settings" className="block rounded-2xl border-2 border-dashed border-slate-200 bg-white p-5 text-center active:bg-slate-50">
            <p className="text-sm font-medium text-slate-500">No active event</p>
            <p className="text-xs text-brand-600 mt-1">Tap to create one →</p>
          </a>
        )}

        {/* ── KPI stats grid ────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Overview</h2>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Array.from({ length: 9 }).map((_, i) => <Skel key={i} className="h-28" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {STATS.map((s) => <StatCard key={s.label} {...s} />)}
            </div>
          )}
        </section>

        {/* ── Attendance status row ─────────────────────────── */}
        {!loading && data && (
          <section>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Attendance Status</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Checked In',     value: data.attendees.checked_in,   color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', bar: 'bg-emerald-500', pctVal: pct(data.attendees.checked_in, data.attendees.pass_generated) },
                { label: 'Pending Entry',  value: data.attendees.pending,      color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     bar: 'bg-amber-400',   pctVal: pct(data.attendees.pending, data.attendees.pass_generated) },
                { label: "Today's Check-ins", value: data.attendees.today,     color: 'text-brand-700',   bg: 'bg-brand-50 border-brand-200',     bar: 'bg-brand-500',   pctVal: pct(data.attendees.today, data.attendees.pass_generated) },
                { label: 'Check-in Rate',  value: `${pct(data.attendees.checked_in, data.attendees.pass_generated)}%`, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', bar: 'bg-violet-500', pctVal: pct(data.attendees.checked_in, data.attendees.pass_generated) },
              ].map((s) => (
                <div key={s.label} className={`rounded-2xl border ${s.bg} p-4`}>
                  <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-snug">{s.label}</div>
                  <div className="mt-3 h-1.5 rounded-full bg-white/60">
                    <div className={`h-1.5 rounded-full ${s.bar} transition-all duration-700`} style={{ width: `${s.pctVal}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Visitor Funnel ────────────────────────────────── */}
        {!loading && data && (
          <section>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Visitor Funnel</h2>
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-3.5">
              {[
                { label: 'Uploaded',   value: data.funnel.uploaded,       color: 'bg-brand-600' },
                { label: 'Invited',    value: data.funnel.invited,        color: 'bg-brand-500' },
                { label: 'Submitted',  value: data.funnel.form_submitted, color: 'bg-violet-500' },
                { label: 'Confirmed',  value: data.funnel.confirmed,      color: 'bg-violet-400' },
                { label: 'Pass Ready', value: data.funnel.pass_generated, color: 'bg-emerald-500' },
                { label: 'Checked In', value: data.funnel.checked_in,     color: 'bg-emerald-600' },
              ].map((step) => (
                <FunnelRow key={step.label} {...step} max={data.funnel.uploaded} />
              ))}
            </div>
          </section>
        )}

        {/* ── Quick actions ─────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Quick Actions</h2>
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Events',      href: '/admin/event-settings', bg: 'bg-brand-600',   icon: '🗓️' },
              { label: 'Contacts',    href: '/admin/import',         bg: 'bg-violet-600',  icon: '📤' },
              { label: 'Attendees',   href: '/admin/attendees',      bg: 'bg-emerald-600', icon: '✅' },
              { label: 'Invites',     href: '/admin/contacts',       bg: 'bg-amber-500',   icon: '📨' },
              { label: 'Bulk Send',   href: '/admin/send-invites',   bg: 'bg-rose-600',    icon: '📱' },
              { label: 'Staff',       href: '/admin/staff',          bg: 'bg-sky-600',     icon: '👥' },
            ].map((a) => (
              <a key={a.label} href={a.href}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-3.5 sm:p-4 text-center text-white ${a.bg} shadow-sm active:scale-95 transition-transform`}
              >
                <span className="text-2xl sm:text-3xl leading-none">{a.icon}</span>
                <span className="text-[11px] sm:text-xs font-semibold leading-tight">{a.label}</span>
              </a>
            ))}
          </div>
        </section>

        {/* ── Recent activity (tabbed on mobile) ────────────── */}
        <section>
          {/* Tab bar */}
          <div className="flex items-center gap-1 mb-3 bg-slate-100 rounded-xl p-1 w-fit">
            {(['checkins', 'passes'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActivityTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activityTab === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'checkins' ? '✅ Check-ins' : '🪪 Passes'}
              </button>
            ))}
            <a href={activityTab === 'passes' ? '/admin/attendees' : '#'}
              className="ml-2 px-3 py-1.5 text-[11px] font-medium text-brand-600 hover:text-brand-700">
              {activityTab === 'passes' ? 'View all →' : ''}
            </a>
          </div>

          {loading ? <Skel className="h-56" /> : (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">

              {/* Check-ins tab */}
              {activityTab === 'checkins' && (
                <>
                  {!data?.recent_checkins?.length ? (
                    <div className="py-12 text-center">
                      <p className="text-3xl mb-2">📭</p>
                      <p className="text-sm text-slate-400">No check-ins yet</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {data.recent_checkins.map((log) => (
                        <li key={log.id} className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            log.status === 'valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {log.status === 'valid' ? '✓' : '!'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{log.attendee_name || 'Unknown'}</div>
                            <div className="text-xs text-slate-400 truncate">{log.attendee_pass || '—'}{log.gate_name ? ` · ${log.gate_name}` : ''}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`block text-[11px] font-bold px-2 py-0.5 rounded-full mb-0.5 ${log.status === 'valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {log.status === 'valid' ? 'Valid' : 'Dup'}
                            </span>
                            <span className="text-[10px] text-slate-400">{fmtRelative(log.created_at)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {/* Passes tab */}
              {activityTab === 'passes' && (
                <>
                  {!data?.recent_confirmations?.length ? (
                    <div className="py-12 text-center">
                      <p className="text-3xl mb-2">🪪</p>
                      <p className="text-sm text-slate-400">No passes generated yet</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {data.recent_confirmations.map((a) => (
                        <li key={a.id} className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                            {(a.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{a.name || 'Unknown'}</div>
                            <div className="text-xs text-slate-400">{a.mobile}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-mono font-bold text-slate-700">{a.pass_number}</div>
                            <div className="text-[10px] text-slate-400">{fmtRelative(a.created_at)}</div>
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
  );
}
