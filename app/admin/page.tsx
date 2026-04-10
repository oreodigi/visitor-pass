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
function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

// ─── Stat card ────────────────────────────────────────────────

function StatCard({ label, value, sub, iconBg, icon, href }: {
  label: string; value: number | string; sub?: string;
  iconBg: string; icon: React.ReactNode; href?: string;
}) {
  const inner = (
    <div className="card p-5 hover:shadow-panel transition-shadow group">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        <div className="text-right flex-1 min-w-0">
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        </div>
      </div>
      <div className="mt-3 text-sm font-medium text-slate-500 group-hover:text-slate-700 transition-colors">{label}</div>
    </div>
  );
  return href ? <a href={href} className="block">{inner}</a> : inner;
}

// ─── Funnel bar ───────────────────────────────────────────────

function FunnelStep({ label, value, max, color, pctNum }: { label: string; value: number; max: number; color: string; pctNum?: number }) {
  const w = pctNum ?? pct(value, max);
  return (
    <div className="flex items-center gap-4">
      <div className="w-36 shrink-0 text-sm text-slate-600 truncate">{label}</div>
      <div className="flex-1 min-w-0">
        <div className="h-2 rounded-full bg-slate-100">
          <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${w}%` }} />
        </div>
      </div>
      <div className="w-12 text-right text-sm font-semibold text-slate-800 tabular-nums">{value.toLocaleString()}</div>
      <div className="w-10 text-right text-xs text-slate-400 tabular-nums">{w}%</div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

function Skel({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />;
}

// ─── Event status badge ───────────────────────────────────────

function EventBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    'badge badge-green',
    draft:     'badge badge-slate',
    completed: 'badge badge-blue',
    cancelled: 'badge badge-red',
  };
  return <span className={map[status] || 'badge badge-slate capitalize'}>{status}</span>;
}

// ─── Page ─────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const STATS = data ? [
    { label: 'Total Events',       value: data.events.total,                  sub: `${data.events.active} active`,                             iconBg: 'bg-brand-100',   icon: <svg className="h-5 w-5 text-brand-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" /></svg>, href: '/admin/event-settings' },
    { label: 'Contacts',           value: data.contacts.total.toLocaleString(), sub: `${data.contacts.invited} invited`,                        iconBg: 'bg-violet-100',  icon: <svg className="h-5 w-5 text-violet-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>, href: '/admin/contacts' },
    { label: 'Confirmed Visitors', value: data.contacts.confirmed.toLocaleString(), sub: `${pct(data.contacts.confirmed, data.contacts.total)}% conversion`, iconBg: 'bg-amber-100',  icon: <svg className="h-5 w-5 text-amber-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, href: '/admin/attendees' },
    { label: 'Passes Generated',   value: data.attendees.pass_generated.toLocaleString(), sub: `${data.attendees.total} attendees`,            iconBg: 'bg-purple-100',  icon: <svg className="h-5 w-5 text-purple-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg> },
    { label: 'Checked In',         value: data.attendees.checked_in.toLocaleString(), sub: `${data.attendees.today} today`,                   iconBg: 'bg-emerald-100', icon: <svg className="h-5 w-5 text-emerald-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { label: 'Pending Entry',      value: data.attendees.pending.toLocaleString(), sub: `${pct(data.attendees.checked_in, data.attendees.pass_generated)}% done`, iconBg: 'bg-orange-100', icon: <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { label: 'Total Staff',        value: data.staff.total,                   sub: `${data.staff.active} active`,                              iconBg: 'bg-sky-100',     icon: <svg className="h-5 w-5 text-sky-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>, href: '/admin/staff' },
    { label: 'Managers',           value: data.staff.managers,                                                                                 iconBg: 'bg-rose-100',    icon: <svg className="h-5 w-5 text-rose-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>, href: '/admin/staff' },
    { label: 'Event Staff',        value: data.staff.event_staff,                                                                              iconBg: 'bg-teal-100',    icon: <svg className="h-5 w-5 text-teal-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg>, href: '/admin/staff' },
  ] : [];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Page header ────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
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

      <div className="p-6 space-y-8 max-w-7xl mx-auto">

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* ── KPI grid ─────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">System Overview</h2>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {Array.from({ length: 9 }).map((_, i) => <Skel key={i} className="h-28" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {STATS.map((s) => <StatCard key={s.label} {...s} />)}
            </div>
          )}
        </section>

        {/* ── Active event + funnel ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Active event */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Active Event</h2>
              <a href="/admin/event-settings" className="text-xs font-medium text-brand-600 hover:text-brand-700">Edit →</a>
            </div>
            {loading ? <Skel className="h-56" /> : data?.active_event ? (
              <div className="card overflow-hidden">
                <div className="bg-gradient-to-r from-brand-700 to-violet-700 px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-brand-200 uppercase tracking-widest mb-1">Current Event</p>
                      <h3 className="text-lg font-bold text-white leading-snug">{data.active_event.title}</h3>
                    </div>
                    <EventBadge status={data.active_event.status} />
                  </div>
                </div>
                <div className="p-5 space-y-3 text-sm">
                  {[
                    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />, text: fmtDate(data.active_event.event_date) },
                    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />, text: `${fmt12h(data.active_event.start_time)} – ${fmt12h(data.active_event.end_time)}` },
                    { icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></>, text: data.active_event.venue_name },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-slate-700">
                      <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">{row.icon}</svg>
                      <span>{row.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card border-dashed p-10 text-center">
                <p className="text-sm text-slate-400">No active event.</p>
                <a href="/admin/event-settings" className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">Create one →</a>
              </div>
            )}
          </div>

          {/* Visitor funnel */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Visitor Funnel</h2>
            </div>
            {loading ? <Skel className="h-56" /> : data ? (
              <div className="card p-6 h-full">
                <div className="space-y-4">
                  {[
                    { label: 'Contacts Uploaded',     value: data.funnel.uploaded,       color: 'bg-brand-600' },
                    { label: 'Invite Sent',           value: data.funnel.invited,        color: 'bg-brand-500' },
                    { label: 'Form Submitted',        value: data.funnel.form_submitted, color: 'bg-violet-500' },
                    { label: 'Confirmed Attendees',   value: data.funnel.confirmed,      color: 'bg-violet-400' },
                    { label: 'Pass Generated',        value: data.funnel.pass_generated, color: 'bg-emerald-500' },
                    { label: 'Checked In',            value: data.funnel.checked_in,     color: 'bg-emerald-600' },
                  ].map((step) => (
                    <FunnelStep key={step.label} {...step} max={data.funnel.uploaded} pctNum={pct(step.value, data.funnel.uploaded)} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Check-in gauge tiles ──────────────────────────── */}
        {!loading && data && (
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-4">Attendance Status</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Checked In',        value: data.attendees.checked_in,  accent: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', num: 'text-emerald-700' },
                { label: 'Pending Entry',     value: data.attendees.pending,     accent: 'bg-amber-400',   bg: 'bg-amber-50 border-amber-200',     num: 'text-amber-700' },
                { label: "Today's Check-ins", value: data.attendees.today,       accent: 'bg-brand-500',   bg: 'bg-brand-50 border-brand-200',     num: 'text-brand-700' },
                { label: 'Check-in Rate',     value: `${pct(data.attendees.checked_in, data.attendees.pass_generated)}%`, accent: 'bg-violet-500', bg: 'bg-violet-50 border-violet-200', num: 'text-violet-700' },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border ${s.bg} p-5`}>
                  <div className={`text-2xl font-bold tabular-nums ${s.num}`}>{s.value}</div>
                  <div className="text-sm text-slate-600 mt-1">{s.label}</div>
                  <div className={`mt-3 h-1 rounded-full ${s.accent} opacity-60`} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Recent activity ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent check-ins */}
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-4">Recent Check-ins</h2>
            {loading ? <Skel className="h-64" /> : (
              <div className="card overflow-hidden">
                {!data?.recent_checkins?.length ? (
                  <div className="py-12 text-center text-sm text-slate-400">No check-ins yet</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.recent_checkins.map((log) => (
                      <li key={log.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            log.status === 'valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {log.status === 'valid' ? '✓' : '!'}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">{log.attendee_name || 'Unknown'}</div>
                            <div className="text-xs text-slate-400">{log.attendee_pass || ''}{log.gate_name ? ` · ${log.gate_name}` : ''}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className={`badge ${log.status === 'valid' ? 'badge-green' : 'badge-amber'}`}>
                            {log.status === 'valid' ? 'New' : 'Dup'}
                          </span>
                          <span className="text-xs text-slate-400">{fmtRelative(log.created_at)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Recent confirmations */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Recent Pass Generations</h2>
              <a href="/admin/attendees" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</a>
            </div>
            {loading ? <Skel className="h-64" /> : (
              <div className="card overflow-hidden">
                {!data?.recent_confirmations?.length ? (
                  <div className="py-12 text-center text-sm text-slate-400">No passes generated yet</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.recent_confirmations.map((a) => (
                      <li key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                            {(a.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">{a.name || 'Unknown'}</div>
                            <div className="text-xs text-slate-400">{a.mobile}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="text-xs font-mono font-semibold text-slate-700">{a.pass_number}</div>
                          <div className="text-xs text-slate-400">{fmtRelative(a.created_at)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Quick actions ─────────────────────────────────── */}
        <section>
          <h2 className="text-base font-bold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Events',             href: '/admin/event-settings', bg: 'bg-brand-600 text-white hover:bg-brand-700',         icon: '🗓️' },
              { label: 'Upload Contacts',    href: '/admin/import',         bg: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-soft', icon: '📤' },
              { label: 'Staff Management',  href: '/admin/staff',          bg: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-soft', icon: '👥' },
              { label: 'Contacts & Invites', href: '/admin/contacts',       bg: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-soft', icon: '📨' },
              { label: 'Confirmed Visitors', href: '/admin/attendees',      bg: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-soft', icon: '✅' },
              { label: 'Bulk Send',          href: '/admin/send-invites',   bg: 'bg-violet-600 text-white hover:bg-violet-700',        icon: '📱' },
            ].map((a) => (
              <a key={a.label} href={a.href}
                className={`flex flex-col items-center gap-2.5 rounded-xl p-4 text-center text-sm font-medium transition-all ${a.bg}`}
              >
                <span className="text-2xl leading-none">{a.icon}</span>
                <span>{a.label}</span>
              </a>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
