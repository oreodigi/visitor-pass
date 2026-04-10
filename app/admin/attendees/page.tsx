'use client';

import { useState, useEffect, FormEvent, useCallback, useRef } from 'react';
import { buildPassWhatsAppLink, type EventContext } from '@/lib/whatsapp';
import { EventSelectorBar, type EventSummary } from '@/app/admin/_components/event-selector';

interface Attendee {
  id: string;
  name: string | null;
  mobile: string;
  email: string | null;
  business_name: string | null;
  seat_number: string | null;
  pass_number: string | null;
  pass_url: string | null;
  qr_token: string | null;
  pass_generated_at: string | null;
  whatsapp_status: string;
  checked_in_at: string | null;
  created_at: string;
}

interface PaginatedResponse {
  attendees: Attendee[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

interface EditForm {
  name: string;
  mobile: string;
  email: string;
  business_name: string;
}

// ── Per-row dropdown ──────────────────────────────────────

function ActionMenu({
  attendee,
  eventCtx,
  onEdit,
  onDelete,
  onRegenerate,
}: {
  attendee: Attendee;
  eventCtx: EventContext | undefined;
  onEdit: (a: Attendee) => void;
  onDelete: (a: Attendee) => void;
  onRegenerate: (a: Attendee) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function sendWhatsApp() {
    if (!attendee.pass_url || !attendee.seat_number) return;
    const link = buildPassWhatsAppLink(attendee.mobile, attendee.name || '', attendee.pass_url, attendee.seat_number, eventCtx);
    window.open(link, '_blank', 'noopener,noreferrer');
    setOpen(false);
  }

  const item = 'flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors rounded-lg';

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        title="More actions"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {attendee.pass_url && attendee.seat_number && (
            <button onClick={sendWhatsApp} className={item}>
              <svg className="h-4 w-4 text-green-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Send Pass (WhatsApp)
            </button>
          )}
          {attendee.pass_url && (
            <a href={attendee.pass_url} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={item}>
              <svg className="h-4 w-4 text-brand-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              View Pass
            </a>
          )}
          {attendee.qr_token && (
            <a href={`/api/pass/image?token=${attendee.qr_token}`} download={`pass-${attendee.pass_number || attendee.id}.png`} onClick={() => setOpen(false)} className={item}>
              <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download Pass Image
            </a>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button onClick={() => { onEdit(attendee); setOpen(false); }} className={item}>
            <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            Edit Details
          </button>
          <button onClick={() => { onRegenerate(attendee); setOpen(false); }} className={item}>
            <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Regenerate Pass
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={() => { onDelete(attendee); setOpen(false); }}
            disabled={!!attendee.checked_in_at}
            className={`${item} ${attendee.checked_in_at ? 'opacity-40 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            {attendee.checked_in_at ? 'Cannot delete (checked in)' : 'Delete Attendee'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export default function AttendeesPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [eventCtx, setEventCtx] = useState<EventContext | undefined>(undefined);
  const eventId = selectedEvent?.id ?? null;
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit panel
  const [editTarget, setEditTarget] = useState<Attendee | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', mobile: '', email: '', business_name: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Per-row loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const bulkMenuRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const currentPageIds = data?.attendees.map(a => a.id) ?? [];
  const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));
  const someOnPageSelected = currentPageIds.some(id => selectedIds.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someOnPageSelected && !allOnPageSelected;
    }
  }, [someOnPageSelected, allOnPageSelected]);

  // Clear selection on page/search change
  useEffect(() => { setSelectedIds(new Set()); }, [page, search]);

  // Close bulk menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) setBulkMenuOpen(false);
    }
    if (bulkMenuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bulkMenuOpen]);

  function toggleAll() {
    if (allOnPageSelected) {
      setSelectedIds(prev => { const n = new Set(prev); currentPageIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); currentPageIds.forEach(id => n.add(id)); return n; });
    }
  }

  function toggleOne(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function handleEventChange(ev: EventSummary | null) {
    setSelectedEvent(ev);
    setData(null);
    setPage(1);
    setSearch('');
    setSelectedIds(new Set());
    if (ev) {
      setEventCtx({
        title: ev.title, event_date: ev.event_date, start_time: ev.start_time,
        end_time: ev.end_time, venue_name: ev.venue_name,
        support_contact_number: ev.support_contact_number ?? undefined,
        pass_message_template: ev.pass_message_template ?? null,
      });
    } else {
      setEventCtx(undefined);
      setLoading(false);
    }
  }

  const fetchAttendees = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ event_id: eventId, page: String(page), per_page: '20', pass_filter: 'has_pass' });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/attendees?${params}`);
      const d = await res.json();
      if (d.success) setData(d.data);
    } catch { setMessage({ type: 'error', text: 'Failed to load attendees' }); }
    finally { setLoading(false); }
  }, [eventId, page, search]);

  useEffect(() => { fetchAttendees(); }, [fetchAttendees]);

  function handleSearch(e: FormEvent) { e.preventDefault(); setPage(1); }

  // ── Edit ────────────────────────────────────────────────
  function openEdit(a: Attendee) {
    setEditTarget(a);
    setEditForm({ name: a.name || '', mobile: a.mobile, email: a.email || '', business_name: a.business_name || '' });
    setEditError('');
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true); setEditError('');
    try {
      const res = await fetch('/api/attendees', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editTarget.id, name: editForm.name.trim() || null, mobile: editForm.mobile.trim(), email: editForm.email.trim() || null, business_name: editForm.business_name.trim() || null }),
      });
      const d = await res.json();
      if (d.success) { setEditTarget(null); setMessage({ type: 'success', text: 'Attendee updated' }); fetchAttendees(); }
      else setEditError(d.error?.message || 'Failed to update');
    } catch { setEditError('Network error'); }
    finally { setEditSaving(false); }
  }

  // ── Delete single ───────────────────────────────────────
  async function handleDelete(a: Attendee) {
    if (a.checked_in_at || !window.confirm(`Delete ${a.name || a.mobile}? This cannot be undone.`)) return;
    setActionLoading(a.id);
    try {
      const res = await fetch(`/api/attendees?id=${a.id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) { setMessage({ type: 'success', text: 'Attendee deleted' }); fetchAttendees(); }
      else setMessage({ type: 'error', text: d.error?.message || 'Failed to delete' });
    } catch { setMessage({ type: 'error', text: 'Network error' }); }
    finally { setActionLoading(null); }
  }

  // ── Regenerate single ───────────────────────────────────
  async function handleRegenerate(a: Attendee) {
    if (!window.confirm(`Regenerate pass for ${a.name || a.mobile}? The old QR code will stop working.`)) return;
    setActionLoading(a.id);
    try {
      const res = await fetch('/api/attendees/generate-pass', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendee_id: a.id, force: true }),
      });
      const d = await res.json();
      if (d.success) { setMessage({ type: 'success', text: `Pass regenerated: ${d.data.pass_number}` }); fetchAttendees(); }
      else setMessage({ type: 'error', text: d.error?.message || 'Failed to regenerate' });
    } catch { setMessage({ type: 'error', text: 'Network error' }); }
    finally { setActionLoading(null); }
  }

  // ── Bulk actions ────────────────────────────────────────
  const selectedAttendees = data?.attendees.filter(a => selectedIds.has(a.id)) ?? [];

  async function bulkSendPasses() {
    const eligible = selectedAttendees.filter(a => a.pass_url && a.seat_number);
    if (eligible.length === 0) { setMessage({ type: 'error', text: 'No selected attendees have a pass ready' }); return; }
    setBulkMenuOpen(false); setBulkLoading(true);
    for (let i = 0; i < eligible.length; i++) {
      const a = eligible[i];
      const link = buildPassWhatsAppLink(a.mobile, a.name || '', a.pass_url!, a.seat_number!, eventCtx);
      window.open(link, '_blank', 'noopener,noreferrer');
      if (i < eligible.length - 1) await new Promise(r => setTimeout(r, 400));
    }
    setMessage({ type: 'success', text: `Opened WhatsApp for ${eligible.length} attendee(s)` });
    setBulkLoading(false);
  }

  async function bulkDelete() {
    const deletable = selectedAttendees.filter(a => !a.checked_in_at);
    if (deletable.length === 0) { setMessage({ type: 'error', text: 'Selected attendees are all checked in and cannot be deleted' }); return; }
    setBulkMenuOpen(false);
    if (!window.confirm(`Delete ${deletable.length} attendee(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    let deleted = 0;
    for (const a of deletable) {
      try {
        const res = await fetch(`/api/attendees?id=${a.id}`, { method: 'DELETE' });
        const d = await res.json();
        if (d.success) deleted++;
      } catch { /* continue */ }
    }
    setMessage({ type: 'success', text: `Deleted ${deleted} attendee(s)` });
    setSelectedIds(new Set());
    fetchAttendees();
    setBulkLoading(false);
  }

  async function bulkRegenerate() {
    setBulkMenuOpen(false);
    if (!window.confirm(`Regenerate passes for ${selectedIds.size} attendee(s)? All old QR codes will stop working.`)) return;
    setBulkLoading(true);
    let done = 0;
    for (const a of selectedAttendees) {
      try {
        const res = await fetch('/api/attendees/generate-pass', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendee_id: a.id, force: true }),
        });
        const d = await res.json();
        if (d.success) done++;
      } catch { /* continue */ }
    }
    setMessage({ type: 'success', text: `Regenerated ${done} pass(es)` });
    setSelectedIds(new Set());
    fetchAttendees();
    setBulkLoading(false);
  }

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 transition-colors';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <EventSelectorBar onChange={handleEventChange} />
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:py-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Confirmed Visitors</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {data ? `${data.total} confirmed` : 'Loading…'} · Passes auto-generated on form submission
          </p>
        </div>
      </div>

      {message && (
        <div className={`mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto -mr-1 opacity-50 hover:opacity-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="input-field max-w-xs" placeholder="Search by name, mobile, or pass…"
          />
          <button type="submit" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Search
          </button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setPage(1); }} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-medium text-brand-800">{selectedIds.size} selected</span>

          <div className="flex items-center gap-2 ml-auto">
            {/* Send Passes */}
            <button
              onClick={bulkSendPasses}
              disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Send Passes
            </button>

            {/* More actions dropdown */}
            <div ref={bulkMenuRef} className="relative">
              <button
                onClick={() => setBulkMenuOpen(o => !o)}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-50"
              >
                More actions
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {bulkMenuOpen && (
                <div className="absolute right-0 z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                  <button
                    onClick={bulkRegenerate}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Regenerate Passes
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={bulkDelete}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Delete Selected
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkLoading}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
            >
              Clear
            </button>

            {bulkLoading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-700" />
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    aria-label="Select all on page"
                  />
                </th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Mobile</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Company</th>
                <th className="px-4 py-3 text-left">Seat</th>
                <th className="px-4 py-3 text-left">Pass</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
                    </div>
                  </td>
                </tr>
              ) : data && data.attendees.length > 0 ? (
                data.attendees.map(a => {
                  const isSelected = selectedIds.has(a.id);
                  return (
                    <tr
                      key={a.id}
                      className={`transition-colors ${isSelected ? 'bg-brand-50/60' : 'hover:bg-slate-50'} ${actionLoading === a.id ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(a.id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                          aria-label={`Select ${a.name || a.mobile}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        {a.name || <span className="text-slate-400 italic font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{a.mobile}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-600">
                        {a.email || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-600">
                        {a.business_name || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {a.seat_number
                          ? <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{a.seat_number}</span>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {a.pass_number ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-brand-700">{a.pass_number}</span>
                            <a href={a.pass_url || `/p/${a.qr_token}`} target="_blank" rel="noopener noreferrer"
                              className="text-brand-400 hover:text-brand-600 transition-colors" title="Preview pass">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Generating…</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {a.checked_in_at ? (
                          <span className="badge badge-green inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Checked in
                          </span>
                        ) : (
                          <span className="badge badge-blue inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />Pass ready
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {a.pass_url && a.seat_number && (
                            <button
                              onClick={() => {
                                const link = buildPassWhatsAppLink(a.mobile, a.name || '', a.pass_url!, a.seat_number!, eventCtx);
                                window.open(link, '_blank', 'noopener,noreferrer');
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              Send Pass
                            </button>
                          )}
                          {actionLoading === a.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 mx-1.5" />
                          ) : (
                            <ActionMenu attendee={a} eventCtx={eventCtx} onEdit={openEdit} onDelete={handleDelete} onRegenerate={handleRegenerate} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                    {search ? 'No attendees match your search' : 'No confirmed attendees yet. Contacts must submit the form first.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">Page {data.page} of {data.total_pages}</p>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">
                Previous
              </button>
              <button onClick={() => setPage(p => Math.min(data.total_pages, p + 1))} disabled={page >= data.total_pages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit panel */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm">
          <div className="relative h-full w-full max-w-md bg-white shadow-xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Edit Attendee</h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">{editTarget.pass_number || editTarget.mobile}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditSave} className="flex-1 flex flex-col p-6 gap-4">
              <div>
                <label className="input-label">Full Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Rahul Sharma" />
              </div>
              <div>
                <label className="input-label">Mobile <span className="text-red-500">*</span></label>
                <input type="tel" required value={editForm.mobile} onChange={e => setEditForm(f => ({ ...f, mobile: e.target.value }))} className={inputCls} placeholder="10-digit mobile" />
              </div>
              <div>
                <label className="input-label">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="email@example.com" />
              </div>
              <div>
                <label className="input-label">Company / Business Name</label>
                <input type="text" value={editForm.business_name} onChange={e => setEditForm(f => ({ ...f, business_name: e.target.value }))} className={inputCls} placeholder="e.g. ABC Enterprises" />
              </div>
              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{editError}</div>
              )}
              <div className="mt-auto flex gap-3 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={editSaving} className="flex-1 btn-primary py-2.5 text-sm">
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
