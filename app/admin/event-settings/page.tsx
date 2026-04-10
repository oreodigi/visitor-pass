'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';

// ─── Types ────────────────────────────────────────────────

interface Partner {
  name: string;
  logo_url: string | null;
}

interface EventData {
  id?: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string;
  venue_contact_number: string;
  organizer_contact_number: string;
  support_contact_number: string;
  footer_note: string;
  logo_url: string | null;
  status?: string;
  max_visitors: number | null;
  vip_seats: number;
  partners: Partner[];
}

type Mode = 'list' | 'edit';

const EMPTY: EventData = {
  title: '', event_date: '', start_time: '', end_time: '',
  venue_name: '', venue_address: '', venue_contact_number: '',
  organizer_contact_number: '', support_contact_number: '',
  footer_note: '', logo_url: null, status: 'draft',
  max_visitors: null, vip_seats: 0, partners: [],
};

// ─── Helpers ──────────────────────────────────────────────

function fmt12h(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function fmtDate(d: string) {
  if (!d) return '';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return d; }
}
function fmtDateLong(d: string) {
  if (!d) return '';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return d; }
}

// ─── Status config ────────────────────────────────────────

const STATUS_CFG: Record<string, { dot: string; pill: string; label: string; cardAccent: string }> = {
  active:    { dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700 ring-emerald-200',  label: 'Active',    cardAccent: 'from-emerald-600 to-teal-600' },
  draft:     { dot: 'bg-slate-400',   pill: 'bg-slate-100 text-slate-600 ring-slate-200',        label: 'Draft',     cardAccent: 'from-slate-600 to-slate-700' },
  completed: { dot: 'bg-blue-500',    pill: 'bg-blue-100 text-blue-700 ring-blue-200',           label: 'Completed', cardAccent: 'from-blue-600 to-indigo-600' },
  cancelled: { dot: 'bg-red-400',     pill: 'bg-red-100 text-red-700 ring-red-200',              label: 'Cancelled', cardAccent: 'from-red-500 to-rose-600' },
};

function StatusPill({ status }: { status?: string }) {
  const s = STATUS_CFG[status || 'draft'] ?? STATUS_CFG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── Form section divider ─────────────────────────────────


// ─── Delete confirmation modal ────────────────────────────

function SectionCard({
  eyebrow,
  title,
  sub,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{sub}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function ReadinessItem({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
      ready ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'
    }`}>
      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${
        ready ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
      }`}>
        {ready ? (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2.5" />
          </svg>
        )}
      </span>
      <span>{label}</span>
    </div>
  );
}

function InsightCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/65">{hint}</p>
    </div>
  );
}

function PassPreviewCard({ event }: { event: EventData }) {
  return (
    <div className="mx-auto w-full max-w-[230px]">
      <div className="overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-[0_25px_60px_-32px_rgba(15,23,42,0.45)] text-[10px]">
        <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 px-3 py-3.5">
          {event.logo_url && (
            <div className="mb-2 flex justify-center">
              <img
                src={event.logo_url}
                alt="Logo"
                className="h-7 w-auto max-w-[100px] rounded object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <p className="text-center text-[11px] font-bold leading-tight text-white">
            {event.title || <span className="font-normal italic opacity-50">Event Title</span>}
          </p>
          <div className="mt-2 flex justify-center">
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.22em] text-emerald-50">
              Visitor Pass
            </span>
          </div>
        </div>

        <div className="px-3 pb-2 pt-3 text-center">
          <p className="text-[12px] font-bold text-stone-900 leading-tight">Visitor Name</p>
          <p className="mt-0.5 text-[9px] text-stone-400">Company / Organization</p>
        </div>

        <div className="flex gap-2 border-b border-dashed border-stone-200 px-3 py-2">
          <div className="flex-1">
            <div className="text-[7px] font-semibold uppercase tracking-[0.2em] text-stone-400">Mobile</div>
            <div className="mt-0.5 font-mono text-[9px] font-medium text-stone-700">98765 43210</div>
          </div>
          <div className="flex-1">
            <div className="text-[7px] font-semibold uppercase tracking-[0.2em] text-stone-400">Pass No.</div>
            <div className="mt-0.5 font-mono text-[9px] font-bold text-emerald-800">VP-001</div>
          </div>
          <div className="flex-1">
            <div className="text-[7px] font-semibold uppercase tracking-[0.2em] text-stone-400">Seat No.</div>
            <div className="mt-0.5 font-mono text-[9px] font-bold text-stone-800">A-12</div>
          </div>
        </div>

        <div className="flex flex-col items-center px-3 py-3">
          <div className="rounded-xl border border-stone-100 bg-white p-1.5 shadow-sm">
            <div className="grid h-[72px] w-[72px] grid-cols-7 gap-px bg-white p-1">
              {[
                1,1,1,0,1,1,1,
                1,0,1,0,1,0,1,
                1,1,1,0,1,1,1,
                0,0,0,0,0,0,0,
                1,1,1,0,1,0,1,
                1,0,0,0,0,0,1,
                1,1,1,0,1,1,1,
              ].map((v, i) => (
                <div key={i} className={`rounded-[1px] ${v ? 'bg-stone-800' : 'bg-white'}`} />
              ))}
            </div>
          </div>
          <p className="mt-1.5 text-[8px] text-stone-400">Show QR code at entry</p>
        </div>

        <div className="mx-3 border-t border-dashed border-stone-200" />

        <div className="space-y-2 px-3 py-2.5">
          <div className="flex items-start gap-1.5">
            <svg className="mt-0.5 h-3 w-3 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <div className="min-w-0">
              <p className="text-[9px] font-medium leading-tight text-stone-800">
                {event.event_date ? fmtDate(event.event_date) : <span className="italic text-stone-300">Date not set</span>}
              </p>
              <p className="mt-0.5 text-[8px] text-stone-400">
                {event.start_time && event.end_time ? `${fmt12h(event.start_time)} - ${fmt12h(event.end_time)}` : <span className="italic">Time not set</span>}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-1.5">
            <svg className="mt-0.5 h-3 w-3 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-medium leading-tight text-stone-800">
                {event.venue_name || <span className="italic text-stone-300">Venue not set</span>}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[8px] leading-relaxed text-stone-400">
                {event.venue_address || <span className="italic">Address not set</span>}
              </p>
            </div>
          </div>

          {(event.venue_contact_number || event.organizer_contact_number || event.support_contact_number) && (
            <div className="flex items-start gap-1.5">
              <svg className="mt-0.5 h-3 w-3 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <div className="space-y-0.5 text-[8px] text-stone-500">
                {event.venue_contact_number && <div>Venue: <span className="font-medium text-emerald-700">{event.venue_contact_number}</span></div>}
                {event.organizer_contact_number && <div>Organizer: <span className="font-medium text-emerald-700">{event.organizer_contact_number}</span></div>}
                {event.support_contact_number && <div>Support: <span className="font-medium text-emerald-700">{event.support_contact_number}</span></div>}
              </div>
            </div>
          )}
        </div>

        {event.footer_note && (
          <div className="border-t border-stone-100 bg-stone-50 px-3 py-2">
            <p className="text-center text-[8px] leading-relaxed text-stone-400">{event.footer_note}</p>
          </div>
        )}

        {event.partners.filter((p) => p.name || p.logo_url).length > 0 && (
          <div className="border-t border-stone-200 bg-stone-50 px-3 py-2">
            <p className="mb-1.5 text-center text-[7px] font-bold uppercase tracking-[0.24em] text-stone-400">
              Partners &amp; Sponsors
            </p>
            <div
              className="grid items-center gap-1.5"
              style={{ gridTemplateColumns: `repeat(${event.partners.filter((p) => p.name || p.logo_url).length}, 1fr)` }}
            >
              {event.partners.filter((p) => p.name || p.logo_url).map((p, i) => (
                <div key={i} className="flex flex-col items-center">
                  {p.logo_url ? (
                    <img
                      src={p.logo_url}
                      alt={p.name}
                      className="h-4 w-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-center text-[7px] font-semibold leading-tight text-stone-600">{p.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteModal({
  event, onCancel, onConfirm, deleting,
}: {
  event: EventData; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  const [txt, setTxt] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-red-600 px-5 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 shrink-0">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Delete &quot;{event.title || 'this event'}&quot;</h3>
            <p className="text-xs text-red-200">This action is permanent and cannot be undone</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-red-50 border border-red-100 p-3.5 text-xs text-red-800 space-y-1">
            <p className="font-semibold mb-1.5">Everything below will be deleted:</p>
            <div className="grid grid-cols-2 gap-1">
              {['Event record', 'All contacts & invites', 'All attendees', 'All generated passes', 'Check-in logs', 'Logo & assets'].map(item => (
                <div key={item} className="flex items-center gap-1.5">
                  <svg className="h-3 w-3 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">DELETE</span> to confirm
            </label>
            <input
              type="text" value={txt} onChange={e => setTxt(e.target.value)} autoFocus
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20"
              placeholder="DELETE"
            />
          </div>
        </div>
        <div className="flex gap-2.5 px-5 pb-5">
          <button onClick={onCancel} disabled={deleting}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={txt !== 'DELETE' || deleting}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
            {deleting
              ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Deleting…</>
              : 'Delete Everything'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Event card (list view) ───────────────────────────────

function EventCard({
  event, onEdit, onDelete,
}: {
  event: EventData; onEdit: () => void; onDelete: () => void;
}) {
  const cfg = STATUS_CFG[event.status || 'draft'] ?? STATUS_CFG.draft;
  return (
    <div className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
      {/* Coloured header */}
      <div className={`bg-gradient-to-br ${cfg.cardAccent} px-5 py-4 relative`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Event</p>
            <h3 className="text-base font-bold text-white leading-snug line-clamp-2">
              {event.title || <span className="opacity-60 font-normal italic">Untitled</span>}
            </h3>
          </div>
          <StatusPill status={event.status} />
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 px-5 py-4 space-y-2.5">
        {event.event_date && (
          <div className="flex items-center gap-2.5 text-sm text-slate-700">
            <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            <span className="font-medium">{fmtDateLong(event.event_date)}</span>
          </div>
        )}
        {(event.start_time || event.end_time) && (
          <div className="flex items-center gap-2.5 text-sm text-slate-600">
            <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{fmt12h(event.start_time)}{event.end_time ? ` – ${fmt12h(event.end_time)}` : ''}</span>
          </div>
        )}
        {event.venue_name && (
          <div className="flex items-start gap-2.5 text-sm text-slate-600">
            <svg className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="line-clamp-2 leading-snug">{event.venue_name}</span>
          </div>
        )}
        {!event.event_date && !event.venue_name && (
          <p className="text-sm text-slate-400 italic">No details added yet</p>
        )}
      </div>

      {/* Logo strip */}
      {event.logo_url && (
        <div className="px-5 pb-3">
          <img src={event.logo_url} alt="Logo" className="h-7 w-auto rounded-md border border-slate-200 bg-slate-50 object-contain p-0.5" />
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-slate-100 flex items-center">
        <button
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
          Edit
        </button>
        <div className="w-px h-8 bg-slate-100" />
        <button
          onClick={onDelete}
          className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Add event card (placeholder) ────────────────────────

function AddEventCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-slate-400 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600 transition-all duration-200 group min-h-[200px]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 group-hover:bg-brand-100 transition-colors">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold">Add New Event</p>
        <p className="text-xs mt-0.5">Create another event</p>
      </div>
    </button>
  );
}

// ─── Logo upload ──────────────────────────────────────────

function LogoUpload({
  logoUrl, eventId, uploading, onUpload,
}: {
  logoUrl: string | null; eventId?: string; uploading: boolean;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const disabled = !eventId || uploading;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Event Logo</p>
      {/* Overlay pattern: invisible full-size input sits on top so the user's click hits it natively */}
      <div className={`relative flex items-center gap-3 rounded-xl border-2 border-dashed px-3 py-3 transition-colors ${
        disabled ? 'cursor-not-allowed border-slate-200 opacity-50'
          : 'cursor-pointer border-slate-200 hover:border-brand-400 hover:bg-brand-50/30'
      }`}>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-0.5" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-700">
            {uploading ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {!eventId ? 'Save event first' : 'PNG or JPG · max 2MB'}
          </p>
        </div>
        {uploading
          ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 shrink-0" />
          : !disabled && (
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={onUpload}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          )
        }
      </div>
    </div>
  );
}

// ─── Partner row ─────────────────────────────────────────

function PartnerRow({
  partner, idx, eventId, uploading, onNameChange, onLogoUpload, onRemove,
}: {
  partner: Partner; idx: number; eventId?: string; uploading: boolean;
  onNameChange: (name: string) => void;
  onLogoUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const logoDisabled = !eventId || uploading;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      {/* Logo picker — overlay pattern */}
      <div
        title={!eventId ? 'Save event first' : 'Upload partner logo'}
        className={`relative shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border transition-colors overflow-hidden ${
          partner.logo_url ? 'border-slate-200 bg-white p-0.5' : 'border-dashed border-slate-300 bg-white'
        } ${logoDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-brand-400'}`}
      >
        {uploading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        ) : partner.logo_url ? (
          <img src={partner.logo_url} alt="" className="h-full w-full rounded-md object-contain" />
        ) : (
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        )}
        {!logoDisabled && (
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoUpload(f); e.target.value = ''; }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        )}
      </div>

      {/* Name */}
      <input
        value={partner.name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={`Partner / Sponsor ${idx + 1} name`}
        className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none"
      />

      {/* Remove */}
      <button type="button" onClick={onRemove}
        className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Edit view ────────────────────────────────────────────

function EditView({
  event, saving, uploading, uploadingPartnerIdx,
  onChange, onSubmit, onLogoUpload,
  onAddPartner, onRemovePartner, onPartnerNameChange, onPartnerLogoUpload,
  onBack, onDeleteClick, message, onDismissMessage,
}: {
  event: EventData; saving: boolean; uploading: boolean; uploadingPartnerIdx: number | null;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit: (e: FormEvent) => void;
  onLogoUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onAddPartner: () => void;
  onRemovePartner: (idx: number) => void;
  onPartnerNameChange: (idx: number, name: string) => void;
  onPartnerLogoUpload: (idx: number, file: File) => void;
  onBack: () => void;
  onDeleteClick: () => void;
  message: { type: 'success' | 'error'; text: string } | null;
  onDismissMessage: () => void;
}) {
  const isNew = !event.id;

  return (
    <div className="flex h-full min-h-screen flex-col bg-slate-50">
      {/* Edit header */}
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Events
          </button>
          <span className="text-slate-300">/</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">
              {isNew ? 'New Event' : (event.title || 'Untitled Event')}
            </p>
          </div>
          {!isNew && (
            <a href="/admin/attendees"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              Attendees
            </a>
          )}
          <button form="event-form" type="submit" disabled={saving}
            className="btn-primary inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs">
            {saving
              ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
              : <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>{isNew ? 'Create Event' : 'Save Changes'}</>
            }
          </button>
        </div>

        {message && (
          <div className={`border-t px-5 py-2 text-[11px] font-medium flex items-center gap-1.5 ${
            message.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-700'
          }`}>
            {message.type === 'success'
              ? <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              : <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            }
            {message.text}
            <button onClick={onDismissMessage} className="ml-auto opacity-50 hover:opacity-100">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col lg:flex-row">

        {/* ── Form column ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <form id="event-form" onSubmit={onSubmit} className="space-y-3">

            {/* Row 1: Title + Status */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
              <div className="sm:col-span-3">
                <label htmlFor="title" className="input-label">Event Title <span className="text-red-500">*</span></label>
                <input id="title" name="title" value={event.title} onChange={onChange}
                  className="input-field" placeholder="e.g. MSME Awareness Program 2026" required />
              </div>
              <div>
                <label htmlFor="status" className="input-label">Status</label>
                <select id="status" name="status" value={event.status || 'draft'} onChange={onChange} className="input-field" disabled={isNew}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Row 2: Date + Start + End + Max Visitors + VIP Seats */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="event_date" className="input-label">Date <span className="text-red-500">*</span></label>
                <input id="event_date" name="event_date" type="date" value={event.event_date} onChange={onChange} className="input-field" required />
              </div>
              <div>
                <label htmlFor="start_time" className="input-label">Start Time <span className="text-red-500">*</span></label>
                <input id="start_time" name="start_time" type="time" value={event.start_time} onChange={onChange} className="input-field" required />
              </div>
              <div>
                <label htmlFor="end_time" className="input-label">End Time <span className="text-red-500">*</span></label>
                <input id="end_time" name="end_time" type="time" value={event.end_time} onChange={onChange} className="input-field" required />
              </div>
              <div>
                <label htmlFor="max_visitors" className="input-label">Max Visitors</label>
                <input id="max_visitors" name="max_visitors" type="number" min="1"
                  value={event.max_visitors ?? ''} onChange={onChange}
                  className="input-field" placeholder="Unlimited" />
              </div>
              <div>
                <label htmlFor="vip_seats" className="input-label">VIP / Mgmt Seats</label>
                <input id="vip_seats" name="vip_seats" type="number" min="0"
                  value={event.vip_seats || ''} onChange={onChange}
                  className="input-field" placeholder="0" />
              </div>
            </div>

            {/* Row 3: Venue Name + Venue Contact + Organizer + Support */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div>
                <label htmlFor="venue_name" className="input-label">Venue Name <span className="text-red-500">*</span></label>
                <input id="venue_name" name="venue_name" value={event.venue_name} onChange={onChange} className="input-field" placeholder="Town Hall, Jalgaon" required />
              </div>
              <div>
                <label htmlFor="venue_contact_number" className="input-label">Venue Contact</label>
                <input id="venue_contact_number" name="venue_contact_number" value={event.venue_contact_number} onChange={onChange} className="input-field" placeholder="0257-1234567" />
              </div>
              <div>
                <label htmlFor="organizer_contact_number" className="input-label">Organizer Contact</label>
                <input id="organizer_contact_number" name="organizer_contact_number" value={event.organizer_contact_number} onChange={onChange} className="input-field" placeholder="9876543210" />
              </div>
              <div>
                <label htmlFor="support_contact_number" className="input-label">Support Contact</label>
                <input id="support_contact_number" name="support_contact_number" value={event.support_contact_number} onChange={onChange} className="input-field" placeholder="9876543210" />
              </div>
            </div>

            {/* Row 4: Venue Address */}
            <div>
              <label htmlFor="venue_address" className="input-label">Venue Address <span className="text-red-500">*</span></label>
              <textarea id="venue_address" name="venue_address" value={event.venue_address} onChange={onChange}
                className="input-field resize-none" rows={2} placeholder="Full address with landmarks" required />
            </div>

            {/* Row 5: Footer Note + Logo Upload */}
            <div className="grid grid-cols-1 gap-2.5 items-start sm:grid-cols-4">
              <div className="sm:col-span-3">
                <label htmlFor="footer_note" className="input-label">Footer Note</label>
                <input id="footer_note" name="footer_note" value={event.footer_note} onChange={onChange}
                  className="input-field" placeholder="e.g. Organized by District Industries Centre, Jalgaon" />
              </div>
              <div>
                <LogoUpload
                  logoUrl={event.logo_url}
                  eventId={event.id}
                  uploading={uploading}
                  onUpload={onLogoUpload}
                />
              </div>
            </div>

            {/* Partners & Sponsors */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-700">Partners &amp; Sponsors</p>
                <button type="button" onClick={onAddPartner}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 transition-colors">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add
                </button>
              </div>
              {event.partners.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-[11px] text-slate-400 italic">
                  No partners added yet — logos and names will appear in the pass footer.
                </p>
              ) : (
                <div className="space-y-2">
                  {event.partners.map((partner, idx) => (
                    <PartnerRow
                      key={idx}
                      partner={partner}
                      idx={idx}
                      eventId={event.id}
                      uploading={uploadingPartnerIdx === idx}
                      onNameChange={(name) => onPartnerNameChange(idx, name)}
                      onLogoUpload={(file) => onPartnerLogoUpload(idx, file)}
                      onRemove={() => onRemovePartner(idx)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Danger zone */}
            {!isNew && (
              <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold text-red-800">Delete this event</p>
                  <p className="text-[11px] text-red-600 mt-0.5">
                    Permanently deletes the event, all attendees, passes, contacts, and check-in logs.
                  </p>
                </div>
                <button type="button" onClick={onDeleteClick}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Delete Event
                </button>
              </div>
            )}
          </form>
        </div>

        {/* ── Pass Preview panel ──────────────────────────── */}
        <div className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col border-l border-slate-200 bg-slate-50">
          {/* Panel header */}
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pass Preview</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>

          {/* Scrollable pass */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto w-full max-w-[220px]">
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md text-[10px]">

                {/* Header band */}
                <div className="bg-emerald-800 px-3 py-3">
                  {event.logo_url && (
                    <div className="mb-2 flex justify-center">
                      <img src={event.logo_url} alt="Logo"
                        className="h-7 w-auto max-w-[100px] object-contain rounded"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                  <p className="text-center text-[11px] font-bold text-white leading-tight">
                    {event.title || <span className="italic font-normal opacity-50">Event Title</span>}
                  </p>
                  <div className="mt-1.5 flex justify-center">
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[8px] font-semibold tracking-wider text-emerald-100 uppercase">
                      Visitor Pass
                    </span>
                  </div>
                </div>

                {/* Sample attendee */}
                <div className="px-3 pt-2.5 pb-1.5 text-center">
                  <p className="text-[12px] font-bold text-stone-900 leading-tight">Visitor Name</p>
                  <p className="text-[9px] text-stone-400 mt-0.5">Company / Organization</p>
                </div>

                {/* Pass meta */}
                <div className="flex px-3 py-1.5 border-b border-dashed border-stone-200 gap-2">
                  <div className="flex-1">
                    <div className="text-[7px] font-semibold uppercase tracking-wider text-stone-400">Mobile</div>
                    <div className="text-[9px] font-medium text-stone-700 font-mono mt-0.5">98765 43210</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[7px] font-semibold uppercase tracking-wider text-stone-400">Pass No.</div>
                    <div className="text-[9px] font-bold text-emerald-800 font-mono mt-0.5">VP-001</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[7px] font-semibold uppercase tracking-wider text-stone-400">Seat No.</div>
                    <div className="text-[9px] font-bold text-stone-800 font-mono mt-0.5">A-12</div>
                  </div>
                </div>

                {/* QR placeholder */}
                <div className="flex flex-col items-center py-3 px-3">
                  <div className="rounded-lg border border-stone-100 bg-white p-1.5 shadow-sm">
                    {/* QR grid pattern */}
                    <div className="h-[72px] w-[72px] grid grid-cols-7 gap-px p-1 bg-white">
                      {[
                        1,1,1,0,1,1,1,
                        1,0,1,0,1,0,1,
                        1,1,1,0,1,1,1,
                        0,0,0,0,0,0,0,
                        1,1,1,0,1,0,1,
                        1,0,0,0,0,0,1,
                        1,1,1,0,1,1,1,
                      ].map((v, i) => (
                        <div key={i} className={`rounded-[1px] ${v ? 'bg-stone-800' : 'bg-white'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-1.5 text-[8px] text-stone-400">Show QR code at entry</p>
                </div>

                {/* Dashed divider */}
                <div className="mx-3 border-t border-dashed border-stone-200" />

                {/* Event info */}
                <div className="px-3 py-2.5 space-y-2">
                  {/* Date & time */}
                  <div className="flex items-start gap-1.5">
                    <svg className="h-3 w-3 mt-0.5 text-stone-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-[9px] font-medium text-stone-800 leading-tight">
                        {event.event_date ? fmtDate(event.event_date) : <span className="text-stone-300 italic">Date not set</span>}
                      </p>
                      <p className="text-[8px] text-stone-400 mt-0.5">
                        {event.start_time && event.end_time
                          ? `${fmt12h(event.start_time)} – ${fmt12h(event.end_time)}`
                          : <span className="italic">Time not set</span>}
                      </p>
                    </div>
                  </div>

                  {/* Venue */}
                  <div className="flex items-start gap-1.5">
                    <svg className="h-3 w-3 mt-0.5 text-stone-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-[9px] font-medium text-stone-800 leading-tight truncate">
                        {event.venue_name || <span className="text-stone-300 italic">Venue not set</span>}
                      </p>
                      <p className="text-[8px] text-stone-400 mt-0.5 leading-relaxed line-clamp-2">
                        {event.venue_address || <span className="italic">Address not set</span>}
                      </p>
                    </div>
                  </div>

                  {/* Contacts */}
                  {(event.venue_contact_number || event.organizer_contact_number || event.support_contact_number) && (
                    <div className="flex items-start gap-1.5">
                      <svg className="h-3 w-3 mt-0.5 text-stone-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                      </svg>
                      <div className="text-[8px] text-stone-500 space-y-0.5">
                        {event.venue_contact_number && <div>Venue: <span className="text-emerald-700 font-medium">{event.venue_contact_number}</span></div>}
                        {event.organizer_contact_number && <div>Organizer: <span className="text-emerald-700 font-medium">{event.organizer_contact_number}</span></div>}
                        {event.support_contact_number && <div>Support: <span className="text-emerald-700 font-medium">{event.support_contact_number}</span></div>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer note */}
                {event.footer_note && (
                  <div className="border-t border-stone-100 bg-stone-50 px-3 py-2">
                    <p className="text-center text-[8px] text-stone-400 leading-relaxed">{event.footer_note}</p>
                  </div>
                )}

                {/* Partners */}
                {event.partners.filter(p => p.name || p.logo_url).length > 0 && (
                  <div className="border-t border-stone-200 bg-stone-50 px-3 py-2">
                    <p className="text-center text-[7px] font-bold uppercase tracking-widest text-stone-400 mb-1.5">
                      Partners &amp; Sponsors
                    </p>
                    {/* Single row, equal columns */}
                    <div
                      className="grid items-center gap-1.5"
                      style={{ gridTemplateColumns: `repeat(${event.partners.filter(p => p.name || p.logo_url).length}, 1fr)` }}
                    >
                      {event.partners.filter(p => p.name || p.logo_url).map((p, i) => (
                        <div key={i} className="flex flex-col items-center">
                          {p.logo_url ? (
                            <img src={p.logo_url} alt={p.name}
                              className="h-4 w-full object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <span className="text-[7px] font-semibold text-stone-600 text-center leading-tight">{p.name}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────

function RedesignedEditView({
  event, saving, uploading, uploadingPartnerIdx,
  onChange, onSubmit, onLogoUpload,
  onAddPartner, onRemovePartner, onPartnerNameChange, onPartnerLogoUpload,
  onBack, onDeleteClick, message, onDismissMessage,
}: {
  event: EventData; saving: boolean; uploading: boolean; uploadingPartnerIdx: number | null;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit: (e: FormEvent) => void;
  onLogoUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onAddPartner: () => void;
  onRemovePartner: (idx: number) => void;
  onPartnerNameChange: (idx: number, name: string) => void;
  onPartnerLogoUpload: (idx: number, file: File) => void;
  onBack: () => void;
  onDeleteClick: () => void;
  message: { type: 'success' | 'error'; text: string } | null;
  onDismissMessage: () => void;
}) {
  const isNew = !event.id;
  const partnersCount = event.partners.filter((p) => p.name || p.logo_url).length;
  const hasSchedule = !!(event.event_date && event.start_time && event.end_time);
  const hasVenue = !!(event.venue_name && event.venue_address);
  const hasBranding = !!(event.logo_url || event.footer_note);
  const hasSupport = !!(event.organizer_contact_number || event.support_contact_number);
  const readinessChecks = [
    { label: 'Core schedule added', ready: hasSchedule },
    { label: 'Venue details added', ready: hasVenue },
    { label: 'Branding added', ready: hasBranding },
    { label: 'Support contacts added', ready: hasSupport },
  ];
  const readinessScore = Math.round((readinessChecks.filter((item) => item.ready).length / readinessChecks.length) * 100);
  const statusCopy = isNew
    ? 'Save once to unlock logo uploads, partner logos, and live preview exports.'
    : readinessScore === 100
      ? 'This event is ready for invite sending and polished pass generation.'
      : 'Complete the missing basics below before sending live invitations.';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.08),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <div className="sticky top-0 z-20 border-b border-white/70 bg-white/90 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Events
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Event Builder</p>
            <p className="truncate text-sm font-bold text-slate-900">{isNew ? 'New Event' : (event.title || 'Untitled Event')}</p>
          </div>
          {!isNew && (
            <a
              href="/admin/attendees"
              className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 sm:inline-flex"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              Attendees
            </a>
          )}
          <button
            form="event-form"
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs shadow-lg shadow-brand-500/25"
          >
            {saving
              ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving...</>
              : <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>{isNew ? 'Create Event' : 'Save Changes'}</>
            }
          </button>
        </div>

        {message && (
          <div className={`border-t px-4 py-2 text-[11px] font-medium flex items-center gap-1.5 sm:px-6 ${
            message.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-700'
          }`}>
            {message.type === 'success'
              ? <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              : <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            }
            {message.text}
            <button onClick={onDismissMessage} className="ml-auto opacity-50 hover:opacity-100">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-4 py-5 sm:px-6 xl:gap-8">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-950 via-slate-900 to-brand-900 px-5 py-6 text-white shadow-[0_30px_80px_-35px_rgba(15,23,42,0.7)] sm:px-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={event.status} />
                  <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                    {isNew ? 'Draft workspace' : 'Live event setup'}
                  </span>
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  {event.title || 'Shape the event before you go live'}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">{statusCopy}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <InsightCard label="Readiness" value={`${readinessScore}%`} hint={readinessScore === 100 ? 'Ready for invite sending' : 'Complete the missing fields'} />
                <InsightCard label="Capacity" value={event.max_visitors ? String(event.max_visitors) : 'Open'} hint={event.vip_seats ? `${event.vip_seats} VIP seats reserved` : 'No VIP quota set'} />
                <InsightCard label="Sponsors" value={partnersCount ? String(partnersCount) : 'None'} hint={partnersCount ? 'Visible on the final pass' : 'Add branding partners'} />
              </div>
            </div>
          </div>

          <div className="lg:hidden">
            <SectionCard eyebrow="Live Preview" title="Mobile pass preview" sub="Keep the attendee pass polished while you update details.">
              <PassPreviewCard event={event} />
            </SectionCard>
          </div>

          <form id="event-form" onSubmit={onSubmit} className="space-y-6">
            <SectionCard eyebrow="Core Setup" title="Identity and scheduling" sub="These fields define how the event appears across invitations, passes, and dashboards.">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div className="sm:col-span-3">
                    <label htmlFor="title" className="input-label">Event Title <span className="text-red-500">*</span></label>
                    <input id="title" name="title" value={event.title} onChange={onChange} className="input-field" placeholder="e.g. MSME Awareness Program 2026" required />
                  </div>
                  <div>
                    <label htmlFor="status" className="input-label">Status</label>
                    <select id="status" name="status" value={event.status || 'draft'} onChange={onChange} className="input-field" disabled={isNew}>
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <label htmlFor="event_date" className="input-label">Date <span className="text-red-500">*</span></label>
                    <input id="event_date" name="event_date" type="date" value={event.event_date} onChange={onChange} className="input-field" required />
                  </div>
                  <div>
                    <label htmlFor="start_time" className="input-label">Start Time <span className="text-red-500">*</span></label>
                    <input id="start_time" name="start_time" type="time" value={event.start_time} onChange={onChange} className="input-field" required />
                  </div>
                  <div>
                    <label htmlFor="end_time" className="input-label">End Time <span className="text-red-500">*</span></label>
                    <input id="end_time" name="end_time" type="time" value={event.end_time} onChange={onChange} className="input-field" required />
                  </div>
                  <div>
                    <label htmlFor="max_visitors" className="input-label">Max Visitors</label>
                    <input id="max_visitors" name="max_visitors" type="number" min="1" value={event.max_visitors ?? ''} onChange={onChange} className="input-field" placeholder="Unlimited" />
                  </div>
                  <div>
                    <label htmlFor="vip_seats" className="input-label">VIP / Mgmt Seats</label>
                    <input id="vip_seats" name="vip_seats" type="number" min="0" value={event.vip_seats || ''} onChange={onChange} className="input-field" placeholder="0" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {readinessChecks.map((item) => (
                    <ReadinessItem key={item.label} label={item.label} ready={item.ready} />
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard eyebrow="Venue Ops" title="Venue and support lines" sub="Make arrival frictionless by giving guests and staff clear place and contact details.">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label htmlFor="venue_name" className="input-label">Venue Name <span className="text-red-500">*</span></label>
                    <input id="venue_name" name="venue_name" value={event.venue_name} onChange={onChange} className="input-field" placeholder="Town Hall, Jalgaon" required />
                  </div>
                  <div>
                    <label htmlFor="venue_contact_number" className="input-label">Venue Contact</label>
                    <input id="venue_contact_number" name="venue_contact_number" value={event.venue_contact_number} onChange={onChange} className="input-field" placeholder="0257-1234567" />
                  </div>
                  <div>
                    <label htmlFor="organizer_contact_number" className="input-label">Organizer Contact</label>
                    <input id="organizer_contact_number" name="organizer_contact_number" value={event.organizer_contact_number} onChange={onChange} className="input-field" placeholder="9876543210" />
                  </div>
                  <div>
                    <label htmlFor="support_contact_number" className="input-label">Support Contact</label>
                    <input id="support_contact_number" name="support_contact_number" value={event.support_contact_number} onChange={onChange} className="input-field" placeholder="9876543210" />
                  </div>
                </div>

                <div>
                  <label htmlFor="venue_address" className="input-label">Venue Address <span className="text-red-500">*</span></label>
                  <textarea id="venue_address" name="venue_address" value={event.venue_address} onChange={onChange} className="input-field resize-none" rows={3} placeholder="Full address with landmarks" required />
                </div>
              </div>
            </SectionCard>

            <SectionCard eyebrow="Pass Branding" title="Footer copy and event branding" sub="Control the event logo and footer line that appear on the final pass.">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.65fr_0.95fr]">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="footer_note" className="input-label">Footer Note</label>
                    <input id="footer_note" name="footer_note" value={event.footer_note} onChange={onChange} className="input-field" placeholder="e.g. Organized by District Industries Centre, Jalgaon" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Preview Notes</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {event.footer_note || 'Your footer note will appear here on the attendee pass and can highlight the organizer or special access instructions.'}
                    </p>
                  </div>
                </div>
                <LogoUpload logoUrl={event.logo_url} eventId={event.id} uploading={uploading} onUpload={onLogoUpload} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Partners"
              title="Sponsors and partner strip"
              sub="Add names or logos that should appear in the pass footer. Save the event once before uploading logos."
              action={
                <button type="button" onClick={onAddPartner} className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Partner
                </button>
              }
            >
              {event.partners.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-700">No partners added yet</p>
                  <p className="mt-1 text-sm text-slate-500">Keep it clean or add sponsor logos for premium, branded passes.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {event.partners.map((partner, idx) => (
                    <PartnerRow
                      key={idx}
                      partner={partner}
                      idx={idx}
                      eventId={event.id}
                      uploading={uploadingPartnerIdx === idx}
                      onNameChange={(name) => onPartnerNameChange(idx, name)}
                      onLogoUpload={(file) => onPartnerLogoUpload(idx, file)}
                      onRemove={() => onRemovePartner(idx)}
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            {!isNew && (
              <SectionCard
                eyebrow="Danger Zone"
                title="Delete this event"
                sub="This permanently removes the event, attendees, generated passes, contacts, and check-in history."
                action={
                  <button type="button" onClick={onDeleteClick} className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Delete Event
                  </button>
                }
              >
                <div className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-4 text-sm text-red-700">
                  Use this only when the event was created by mistake or should be removed from the system entirely.
                </div>
              </SectionCard>
            )}
          </form>
        </div>

        <aside className="hidden w-80 shrink-0 xl:block">
          <div className="sticky top-[110px] space-y-5">
            <SectionCard eyebrow="Pass Preview" title="Live attendee pass" sub="Every logo, footer, and venue change is reflected here instantly.">
              <PassPreviewCard event={event} />
            </SectionCard>

            <SectionCard eyebrow="Operator Notes" title="Pre-launch checklist" sub="Use this to catch gaps before the event team starts sending invites.">
              <div className="space-y-3">
                {readinessChecks.map((item) => (
                  <ReadinessItem key={item.label} label={item.label} ready={item.ready} />
                ))}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Timing Summary</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {hasSchedule ? `${fmtDateLong(event.event_date)} | ${fmt12h(event.start_time)} to ${fmt12h(event.end_time)}` : 'Add date and time to complete the schedule'}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function EventsPage() {
  const [mode, setMode] = useState<Mode>('list');
  const [events, setEvents] = useState<EventData[]>([]);
  const [event, setEvent] = useState<EventData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingPartnerIdx, setUploadingPartnerIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventData | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (data.success) {
        const list: EventData[] = (data.data || []).map((e: Record<string, unknown>) => ({
          id: e.id as string,
          title: (e.title as string) || '',
          event_date: (e.event_date as string) || '',
          start_time: ((e.start_time as string) || '').slice(0, 5),
          end_time: ((e.end_time as string) || '').slice(0, 5),
          venue_name: (e.venue_name as string) || '',
          venue_address: (e.venue_address as string) || '',
          venue_contact_number: (e.venue_contact_number as string) || '',
          organizer_contact_number: (e.organizer_contact_number as string) || '',
          support_contact_number: (e.support_contact_number as string) || '',
          footer_note: (e.footer_note as string) || '',
          logo_url: (e.logo_url as string) || null,
          status: (e.status as string) || 'draft',
          max_visitors: e.max_visitors != null ? Number(e.max_visitors) : null,
          vip_seats: e.vip_seats != null ? Number(e.vip_seats) : 0,
          partners: Array.isArray(e.partners) ? (e.partners as Partner[]) : [],
        }));
        setEvents(list);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load events' });
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEvent({ ...EMPTY });
    setMessage(null);
    setMode('edit');
  }

  function openEdit(ev: EventData) {
    setEvent({ ...ev });
    setMessage(null);
    setMode('edit');
  }

  function backToList() {
    setMode('list');
    setMessage(null);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    const inputType = (e.target as HTMLInputElement).type;
    const parsed = inputType === 'number'
      ? (value === '' ? null : Number(value))
      : value;
    setEvent((prev) => ({ ...prev, [name]: parsed }));
    if (message) setMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const isUpdate = !!event.id;
      const res = await fetch('/api/events', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isUpdate ? { ...event, id: event.id } : { ...event }),
      });
      const data = await res.json();
      if (!data.success) {
        setMessage({ type: 'error', text: data.error?.message || 'Save failed' });
      } else {
        const saved: EventData = {
          ...event,
          id: data.data?.id || event.id,
          status: data.data?.status || event.status,
        };
        setMessage({ type: 'success', text: isUpdate ? 'Event updated successfully' : 'Event created successfully' });
        setEvent(saved);
        await loadEvents();
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!event.id) { setMessage({ type: 'error', text: 'Save the event first before uploading a logo' }); return; }
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) { setMessage({ type: 'error', text: 'Only PNG and JPG allowed' }); return; }
    if (file.size > 2 * 1024 * 1024) { setMessage({ type: 'error', text: 'File must be under 2MB' }); return; }
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('event_id', event.id);
      fd.append('logo', file);
      const res = await fetch('/api/events', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) {
        setMessage({ type: 'error', text: data.error?.message || 'Upload failed' });
      } else {
        setEvent((prev) => ({ ...prev, logo_url: data.data.logo_url }));
        setMessage({ type: 'success', text: 'Logo uploaded' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }

  function addPartner() {
    setEvent((prev) => ({ ...prev, partners: [...prev.partners, { name: '', logo_url: null }] }));
  }

  function removePartner(idx: number) {
    setEvent((prev) => ({ ...prev, partners: prev.partners.filter((_, i) => i !== idx) }));
  }

  function handlePartnerNameChange(idx: number, name: string) {
    setEvent((prev) => {
      const partners = [...prev.partners];
      partners[idx] = { ...partners[idx], name };
      return { ...prev, partners };
    });
  }

  async function handlePartnerLogoUpload(idx: number, file: File) {
    if (!event.id) { setMessage({ type: 'error', text: 'Save the event first before uploading logos' }); return; }
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) { setMessage({ type: 'error', text: 'Only PNG and JPG allowed' }); return; }
    if (file.size > 2 * 1024 * 1024) { setMessage({ type: 'error', text: 'File must be under 2MB' }); return; }
    setUploadingPartnerIdx(idx);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('event_id', event.id);
      fd.append('upload_type', 'partner_logo');
      fd.append('logo', file);
      const res = await fetch('/api/events', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) {
        setMessage({ type: 'error', text: data.error?.message || 'Upload failed' });
      } else {
        setEvent((prev) => {
          const partners = [...prev.partners];
          partners[idx] = { ...partners[idx], logo_url: data.data.logo_url };
          return { ...prev, partners };
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Upload failed' });
    } finally {
      setUploadingPartnerIdx(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events?id=${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        setMessage({ type: 'error', text: data.error?.message || 'Delete failed' });
      } else {
        setDeleteTarget(null);
        if (mode === 'edit') setMode('list');
        await loadEvents();
        setMessage({ type: 'success', text: 'Event deleted successfully' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setDeleting(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="h-6 w-24 animate-pulse rounded-lg bg-slate-200" />
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="h-24 animate-pulse bg-slate-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded-lg bg-slate-100" />
                  <div className="h-3 w-1/2 animate-pulse rounded-lg bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────
  if (mode === 'edit') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        {deleteTarget && (
          <DeleteModal
            event={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
            deleting={deleting}
          />
        )}
        <RedesignedEditView
          event={event}
          saving={saving}
          uploading={uploading}
          uploadingPartnerIdx={uploadingPartnerIdx}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onLogoUpload={handleLogoUpload}
          onAddPartner={addPartner}
          onRemovePartner={removePartner}
          onPartnerNameChange={handlePartnerNameChange}
          onPartnerLogoUpload={handlePartnerLogoUpload}
          onBack={backToList}
          onDeleteClick={() => setDeleteTarget(event)}
          message={message}
          onDismissMessage={() => setMessage(null)}
        />
      </div>
    );
  }

  // ── List mode ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {deleteTarget && (
        <DeleteModal
          event={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          deleting={deleting}
        />
      )}

      {/* Page header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Events</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {events.length === 0
                ? 'No events yet — create your first one'
                : `${events.length} event${events.length === 1 ? '' : 's'} · ${events.filter(e => e.status === 'active').length} active`}
            </p>
          </div>
          <button
            onClick={openNew}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Event
          </button>
        </div>

        {message && (
          <div className={`border-t px-6 py-2 text-[11px] font-medium flex items-center gap-1.5 ${
            message.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-700'
          }`}>
            {message.type === 'success'
              ? <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              : <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            }
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-auto opacity-50 hover:opacity-100">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {events.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100">
              <svg className="h-8 w-8 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">No events yet</h2>
            <p className="mt-2 text-sm text-slate-500 max-w-xs">
              Create your first event to start managing visitors, generating passes, and tracking check-ins.
            </p>
            <button onClick={openNew}
              className="btn-primary mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create First Event
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {events.map(ev => (
              <EventCard
                key={ev.id}
                event={ev}
                onEdit={() => openEdit(ev)}
                onDelete={() => setDeleteTarget(ev)}
              />
            ))}
            <AddEventCard onClick={openNew} />
          </div>
        )}
      </div>
    </div>
  );
}
