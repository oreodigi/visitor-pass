'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';

// ─── Types ────────────────────────────────────────────────

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
}

const EMPTY: EventData = {
  title: '', event_date: '', start_time: '', end_time: '',
  venue_name: '', venue_address: '', venue_contact_number: '',
  organizer_contact_number: '', support_contact_number: '',
  footer_note: '', logo_url: null,
};

// ─── Helpers ──────────────────────────────────────────────

function fmt12h(t: string) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function fmtDate(d: string) {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

// ─── Section divider ─────────────────────────────────────

function SDiv({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pb-0.5 pt-3">
      <span className="h-[13px] w-0.5 shrink-0 rounded-full bg-brand-600" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600/80">{label}</span>
      <span className="flex-1 border-t border-slate-100" />
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────

const STATUS_MAP: Record<string, { dot: string; cls: string; label: string }> = {
  active:    { dot: 'bg-emerald-500', cls: 'badge badge-green',  label: 'Active' },
  draft:     { dot: 'bg-slate-400',   cls: 'badge badge-slate',  label: 'Draft' },
  completed: { dot: 'bg-blue-500',    cls: 'badge badge-blue',   label: 'Completed' },
  cancelled: { dot: 'bg-red-500',     cls: 'badge badge-red',    label: 'Cancelled' },
};

function StatusBadge({ status }: { status?: string }) {
  const s = STATUS_MAP[status || 'draft'] ?? STATUS_MAP.draft;
  return (
    <span className={`${s.cls} inline-flex items-center gap-1.5`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── Summary panel ────────────────────────────────────────

function SummaryPanel({ event }: { event: EventData }) {
  return (
    <div className="space-y-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live Preview</p>
      <div className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Event</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 leading-snug">
            {event.title || <span className="text-slate-400 font-normal italic">Not set</span>}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Date</p>
            <p className="mt-0.5 text-xs font-medium text-slate-700">{fmtDate(event.event_date)}</p>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
            <div className="mt-0.5"><StatusBadge status={event.status} /></div>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Time</p>
          <p className="mt-0.5 text-xs font-medium text-slate-700">
            {event.start_time ? `${fmt12h(event.start_time)} – ${fmt12h(event.end_time)}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Venue</p>
          <p className="mt-0.5 text-xs font-medium text-slate-700 leading-snug">
            {event.venue_name || <span className="text-slate-400 italic">Not set</span>}
          </p>
        </div>
      </div>
    </div>
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
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Event Logo</p>
      <label
        htmlFor="logo-input"
        className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-3 py-2.5 transition-colors ${
          disabled
            ? 'cursor-not-allowed border-slate-200 opacity-50'
            : 'cursor-pointer border-slate-200 hover:border-brand-400 hover:bg-brand-50/30'
        }`}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-0.5" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-700">
            {uploading ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
          </p>
          <p className="text-[10px] text-slate-400">
            {!eventId ? 'Save event first' : 'PNG or JPG · max 2MB'}
          </p>
        </div>
        {uploading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 shrink-0" />
        )}
      </label>
      <input id="logo-input" type="file" accept="image/png,image/jpeg,image/jpg" onChange={onUpload} disabled={disabled} className="sr-only" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function EventSettingsPage() {
  const [event, setEvent] = useState<EventData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { loadEvent(); }, []);

  async function loadEvent() {
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        const e = data.data[0];
        setEvent({
          id: e.id,
          title: e.title || '',
          event_date: e.event_date || '',
          start_time: e.start_time?.slice(0, 5) || '',
          end_time: e.end_time?.slice(0, 5) || '',
          venue_name: e.venue_name || '',
          venue_address: e.venue_address || '',
          venue_contact_number: e.venue_contact_number || '',
          organizer_contact_number: e.organizer_contact_number || '',
          support_contact_number: e.support_contact_number || '',
          footer_note: e.footer_note || '',
          logo_url: e.logo_url || null,
          status: e.status,
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load event data' });
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setEvent((prev) => ({ ...prev, [name]: value }));
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
        setMessage({ type: 'success', text: isUpdate ? 'Event updated' : 'Event created' });
        if (!isUpdate && data.data?.id) setEvent((prev) => ({ ...prev, id: data.data.id }));
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
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) { setMessage({ type: 'error', text: 'Only PNG and JPG files are allowed' }); return; }
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">

      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <h1 className="text-sm font-bold text-slate-900">Event Settings</h1>
            <p className="text-[11px] text-slate-400">
              {event.id ? 'Update event details and branding' : 'Create your event to get started'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/admin/attendees"
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors ${!event.id ? 'pointer-events-none opacity-40' : ''}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              View Attendees
            </a>
            <button
              form="event-form"
              type="submit"
              disabled={saving}
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs"
            >
              {saving ? (
                <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
              ) : (
                <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>{event.id ? 'Update Event' : 'Create Event'}</>
              )}
            </button>
          </div>
        </div>

        {/* Inline toast */}
        {message && (
          <div className={`border-t px-5 py-2 text-[11px] font-medium flex items-center gap-1.5 ${
            message.type === 'success'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
              : 'border-red-100 bg-red-50 text-red-700'
          }`}>
            {message.type === 'success'
              ? <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              : <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            }
            {message.text}
          </div>
        )}
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <form id="event-form" onSubmit={handleSubmit} className="space-y-2.5 max-w-3xl">

            <SDiv label="Basic Information" />

            <div>
              <label htmlFor="title" className="input-label">
                Event Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title" name="title" value={event.title} onChange={handleChange}
                className="input-field" placeholder="e.g. MSME Awareness Program 2026" required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div>
                <label htmlFor="event_date" className="input-label">Date <span className="text-red-500">*</span></label>
                <input id="event_date" name="event_date" type="date" value={event.event_date} onChange={handleChange} className="input-field" required />
              </div>
              <div>
                <label htmlFor="start_time" className="input-label">Start <span className="text-red-500">*</span></label>
                <input id="start_time" name="start_time" type="time" value={event.start_time} onChange={handleChange} className="input-field" required />
              </div>
              <div>
                <label htmlFor="end_time" className="input-label">End <span className="text-red-500">*</span></label>
                <input id="end_time" name="end_time" type="time" value={event.end_time} onChange={handleChange} className="input-field" required />
              </div>
              <div>
                <label htmlFor="status" className="input-label">Status</label>
                <select id="status" name="status" value={event.status || 'draft'} onChange={handleChange} className="input-field" disabled={!event.id}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <SDiv label="Venue" />

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label htmlFor="venue_name" className="input-label">Venue Name <span className="text-red-500">*</span></label>
                <input id="venue_name" name="venue_name" value={event.venue_name} onChange={handleChange} className="input-field" placeholder="e.g. Town Hall, Jalgaon" required />
              </div>
              <div>
                <label htmlFor="venue_contact_number" className="input-label">Venue Contact</label>
                <input id="venue_contact_number" name="venue_contact_number" value={event.venue_contact_number} onChange={handleChange} className="input-field" placeholder="0257-1234567" />
              </div>
            </div>

            <div>
              <label htmlFor="venue_address" className="input-label">Venue Address <span className="text-red-500">*</span></label>
              <textarea
                id="venue_address" name="venue_address" value={event.venue_address} onChange={handleChange}
                className="input-field resize-none" rows={2} placeholder="Full address with landmarks" required
              />
            </div>

            <SDiv label="Organizer & Support" />

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label htmlFor="organizer_contact_number" className="input-label">Organizer Contact</label>
                <input id="organizer_contact_number" name="organizer_contact_number" value={event.organizer_contact_number} onChange={handleChange} className="input-field" placeholder="9876543210" />
              </div>
              <div>
                <label htmlFor="support_contact_number" className="input-label">Support Contact</label>
                <input id="support_contact_number" name="support_contact_number" value={event.support_contact_number} onChange={handleChange} className="input-field" placeholder="9876543210" />
              </div>
            </div>

            <SDiv label="Branding & Footer" />

            <div>
              <label htmlFor="footer_note" className="input-label">Footer Note</label>
              <input
                id="footer_note" name="footer_note" value={event.footer_note} onChange={handleChange}
                className="input-field" placeholder="e.g. Organized by District Industries Centre, Jalgaon"
              />
            </div>

          </form>
        </div>

        {/* Right: Summary + Logo */}
        <div className="hidden lg:flex w-64 shrink-0 flex-col border-l border-slate-200 bg-white xl:w-72">
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <SummaryPanel event={event} />
            <LogoUpload
              logoUrl={event.logo_url}
              eventId={event.id}
              uploading={uploading}
              onUpload={handleLogoUpload}
            />
          </div>
          <div className="shrink-0 border-t border-slate-200 p-4 space-y-2">
            <button
              form="event-form"
              type="submit"
              disabled={saving}
              className="btn-primary w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm"
            >
              {saving ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
              ) : (
                <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>{event.id ? 'Update Event' : 'Create Event'}</>
              )}
            </button>
            <p className="text-center text-[10px] text-slate-400">
              {event.id ? 'Changes saved immediately' : 'Creates a new event record'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
