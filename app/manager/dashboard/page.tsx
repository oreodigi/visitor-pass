'use client';

import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────

interface EventStats {
  total_attendees: number;
  checked_in: number;
  pending: number;
  today: number;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  designation: string | null;
  active: boolean;
}

interface AssignedEvent {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  status: string;
  stats: EventStats;
  staff: StaffMember[];
}

interface RecentCheckin {
  id: string;
  status: string;
  gate_name: string | null;
  created_at: string;
  attendee_name: string | null;
  event_title: string;
}

interface DashboardData {
  assigned_events: AssignedEvent[];
  recent_checkins: RecentCheckin[];
}

// ─── Helpers ──────────────────────────────────────────────

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

// ─── Status badge ─────────────────────────────────────────

function EventStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'badge badge-green',
    draft: 'badge badge-slate',
    completed: 'badge badge-blue',
    cancelled: 'badge badge-red',
  };
  return (
    <span className={`${map[status] || 'badge badge-slate'} capitalize`}>
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'manager') return <span className="badge badge-amber">Manager</span>;
  return <span className="badge badge-blue">Staff</span>;
}

// ─── Stat tile ────────────────────────────────────────────

function StatTile({
  label, value, color, bg,
}: {
  label: string; value: number | string; color: string; bg: string;
}) {
  return (
    <div className={`rounded-xl border p-5 ${bg}`}>
      <div className={`text-2xl font-bold tabular-nums leading-none ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1.5 font-medium">{label}</div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />;
}

// ─── Page ─────────────────────────────────────────────────

export default function ManagerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/manager/dashboard');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.assigned_events?.length > 0 && !selectedEventId) {
          setSelectedEventId(json.data.assigned_events[0].id);
        }
      } else {
        setError(json.error?.message || 'Failed to load dashboard');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedEvent = data?.assigned_events.find((e) => e.id === selectedEventId) ?? data?.assigned_events[0] ?? null;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Page header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Manager Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {/* Event selector */}
        {!loading && data && data.assigned_events.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {data.assigned_events.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelectedEventId(ev.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all border ${
                  selectedEventId === ev.id
                    ? 'bg-brand-600 text-white border-brand-600 shadow-soft'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {ev.title}
              </button>
            ))}
          </div>
        )}

        {/* No assignments */}
        {!loading && data?.assigned_events.length === 0 && (
          <div className="card border-dashed p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
              <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">No events assigned</p>
            <p className="text-xs text-slate-400 mt-1">Contact your administrator to get assigned to an event.</p>
          </div>
        )}

        {/* Skeleton loading */}
        {loading && (
          <div className="space-y-6">
            <Skeleton className="h-40" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-16" />
          </div>
        )}

        {selectedEvent && !loading && (
          <>
            {/* Event card */}
            <div className="card overflow-hidden">
              <div className="bg-gradient-to-r from-brand-700 to-violet-700 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-brand-300 uppercase tracking-widest mb-1.5">Assigned Event</p>
                    <h2 className="text-xl font-bold text-white">{selectedEvent.title}</h2>
                  </div>
                  <EventStatusBadge status={selectedEvent.status} />
                </div>
              </div>
              <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5 font-medium uppercase tracking-wide">Date</p>
                  <p className="font-semibold text-slate-900">{fmtDate(selectedEvent.event_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5 font-medium uppercase tracking-wide">Time</p>
                  <p className="font-semibold text-slate-900">{fmt12h(selectedEvent.start_time)} – {fmt12h(selectedEvent.end_time)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5 font-medium uppercase tracking-wide">Venue</p>
                  <p className="font-semibold text-slate-900">{selectedEvent.venue_name}</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Attendance Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatTile
                  label="Total Passes"
                  value={selectedEvent.stats.total_attendees}
                  color="text-slate-900"
                  bg="bg-white border-slate-200"
                />
                <StatTile
                  label="Checked In"
                  value={selectedEvent.stats.checked_in}
                  color="text-emerald-700"
                  bg="bg-emerald-50 border-emerald-200"
                />
                <StatTile
                  label="Pending Entry"
                  value={selectedEvent.stats.pending}
                  color="text-amber-700"
                  bg="bg-amber-50 border-amber-200"
                />
                <StatTile
                  label="Today"
                  value={selectedEvent.stats.today}
                  color="text-brand-700"
                  bg="bg-brand-50 border-brand-200"
                />
              </div>
            </div>

            {/* Progress bar */}
            {selectedEvent.stats.total_attendees > 0 && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-700">Check-in Progress</span>
                  <span className="text-sm font-bold text-brand-600">
                    {pct(selectedEvent.stats.checked_in, selectedEvent.stats.total_attendees)}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${pct(selectedEvent.stats.checked_in, selectedEvent.stats.total_attendees)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-400">
                  <span>{selectedEvent.stats.checked_in} checked in</span>
                  <span>{selectedEvent.stats.pending} remaining</span>
                </div>
              </div>
            )}

            {/* Staff */}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                Assigned Staff ({selectedEvent.staff.length})
              </h2>
              {selectedEvent.staff.length === 0 ? (
                <div className="card border-dashed py-8 text-center text-sm text-slate-400">
                  No staff assigned to this event
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedEvent.staff.map((s) => (
                    <div key={s.id} className="card p-4 flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-sm font-bold text-white shadow-soft">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{s.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <RoleBadge role={s.role} />
                          {!s.active && (
                            <span className="text-xs text-slate-400">Inactive</span>
                          )}
                        </div>
                        {s.designation && (
                          <div className="text-xs text-slate-400 truncate mt-0.5">{s.designation}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Recent check-ins */}
        {!loading && data && data.recent_checkins.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent Check-ins</h2>
            <div className="card overflow-hidden">
              <ul className="divide-y divide-slate-100">
                {data.recent_checkins.map((log) => (
                  <li key={log.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        log.status === 'valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {log.status === 'valid' ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{log.attendee_name || 'Unknown'}</div>
                        <div className="text-xs text-slate-400 truncate">
                          {log.event_title}{log.gate_name ? ` · ${log.gate_name}` : ''}
                        </div>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
