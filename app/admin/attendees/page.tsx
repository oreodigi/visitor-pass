'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { buildPassWhatsAppLink, type EventContext } from '@/lib/whatsapp';
import { EventSelectorBar, type EventSummary } from '@/app/admin/_components/event-selector';
import { AdminHero, EmptyPanel, InlineStatus, MetricTile, SurfaceCard } from '@/app/admin/_components/admin-surface';

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

function ActionMenu({
  attendee,
  eventCtx,
  onEdit,
  onDelete,
  onRegenerate,
}: {
  attendee: Attendee;
  eventCtx: EventContext | undefined;
  onEdit: (attendee: Attendee) => void;
  onDelete: (attendee: Attendee) => void;
  onRegenerate: (attendee: Attendee) => void;
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

  const itemCls = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50';

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button onClick={() => setOpen((prev) => !prev)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
        More
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-[24px] border border-slate-200 bg-white p-2 shadow-xl">
          {attendee.pass_url && attendee.seat_number ? (
            <button
              onClick={() => {
                const link = buildPassWhatsAppLink(attendee.mobile, attendee.name || '', attendee.pass_url!, attendee.seat_number!, eventCtx);
                window.open(link, '_blank', 'noopener,noreferrer');
                setOpen(false);
              }}
              className={itemCls}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Send pass on WhatsApp
            </button>
          ) : null}
          {attendee.pass_url ? <a href={attendee.pass_url} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={itemCls}><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />View pass</a> : null}
          {attendee.qr_token ? <a href={`/api/pass/image?token=${attendee.qr_token}`} download={`pass-${attendee.pass_number || attendee.id}.png`} onClick={() => setOpen(false)} className={itemCls}><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Download pass image</a> : null}
          <div className="my-2 border-t border-slate-100" />
          <button onClick={() => { onEdit(attendee); setOpen(false); }} className={itemCls}><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Edit attendee</button>
          <button onClick={() => { onRegenerate(attendee); setOpen(false); }} className={itemCls}><span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />Regenerate pass</button>
          <button onClick={() => { onDelete(attendee); setOpen(false); }} className={`${itemCls} text-rose-700 hover:bg-rose-50`}><span className="h-2.5 w-2.5 rounded-full bg-rose-400" />Delete attendee</button>
        </div>
      ) : null}
    </div>
  );
}

export default function AttendeesPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [eventCtx, setEventCtx] = useState<EventContext | undefined>(undefined);
  const eventId = selectedEvent?.id ?? null;
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editTarget, setEditTarget] = useState<Attendee | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', mobile: '', email: '', business_name: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const currentPageIds = data?.attendees.map((attendee) => attendee.id) ?? [];
  const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = currentPageIds.some((id) => selectedIds.has(id));
  const selectedAttendees = data?.attendees.filter((attendee) => selectedIds.has(attendee.id)) ?? [];
  const stats = useMemo(() => {
    const attendees = data?.attendees ?? [];
    return {
      checkedIn: attendees.filter((attendee) => attendee.checked_in_at).length,
      ready: attendees.filter((attendee) => attendee.pass_number && !attendee.checked_in_at).length,
    };
  }, [data]);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [someOnPageSelected, allOnPageSelected]);

  useEffect(() => setSelectedIds(new Set()), [page, search]);

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition';

  function toggleAll() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentPageIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      currentPageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleEventChange(ev: EventSummary | null) {
    setSelectedEvent(ev);
    setData(null);
    setPage(1);
    setSearch('');
    setSelectedIds(new Set());
    if (ev) {
      setEventCtx({
        title: ev.title,
        event_date: ev.event_date,
        start_time: ev.start_time,
        end_time: ev.end_time,
        venue_name: ev.venue_name,
        support_contact_number: ev.support_contact_number ?? undefined,
        pass_message_template: ev.pass_message_template ?? null,
        pass_terms_conditions: ev.pass_terms_conditions ?? null,
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
      const response = await res.json();
      if (response.success) setData(response.data);
      else setMessage({ type: 'error', text: response.error?.message || 'Failed to load attendees' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to load attendees' });
    } finally {
      setLoading(false);
    }
  }, [eventId, page, search]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  function openEdit(attendee: Attendee) {
    setEditTarget(attendee);
    setEditForm({
      name: attendee.name || '',
      mobile: attendee.mobile,
      email: attendee.email || '',
      business_name: attendee.business_name || '',
    });
    setEditError('');
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch('/api/attendees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editTarget.id,
          name: editForm.name.trim() || null,
          mobile: editForm.mobile.trim(),
          email: editForm.email.trim() || null,
          business_name: editForm.business_name.trim() || null,
        }),
      });
      const response = await res.json();
      if (response.success) {
        setEditTarget(null);
        setMessage({ type: 'success', text: 'Attendee updated' });
        fetchAttendees();
      } else {
        setEditError(response.error?.message || 'Failed to update attendee');
      }
    } catch {
      setEditError('Network error');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(attendee: Attendee) {
    const warning = attendee.checked_in_at
      ? `Delete checked-in visitor ${attendee.name || attendee.mobile}? Their check-in log will be removed and seat ${attendee.seat_number || ''} will become available. This cannot be undone.`
      : `Delete ${attendee.name || attendee.mobile}? Their seat ${attendee.seat_number || ''} will become available. This cannot be undone.`;
    if (!window.confirm(warning)) return;
    setActionLoading(attendee.id);
    try {
      const res = await fetch(`/api/attendees?id=${attendee.id}`, { method: 'DELETE' });
      const response = await res.json();
      if (response.success) {
        setMessage({ type: 'success', text: 'Attendee deleted' });
        fetchAttendees();
      } else {
        setMessage({ type: 'error', text: response.error?.message || 'Failed to delete attendee' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRegenerate(attendee: Attendee) {
    if (!window.confirm(`Regenerate pass for ${attendee.name || attendee.mobile}? The old QR code will stop working.`)) return;
    setActionLoading(attendee.id);
    try {
      const res = await fetch('/api/attendees/generate-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendee_id: attendee.id, force: true }),
      });
      const response = await res.json();
      if (response.success) {
        setMessage({ type: 'success', text: `Pass regenerated: ${response.data.pass_number}` });
        fetchAttendees();
      } else {
        setMessage({ type: 'error', text: response.error?.message || 'Failed to regenerate pass' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setActionLoading(null);
    }
  }

  async function bulkSendPasses() {
    const eligible = selectedAttendees.filter((attendee) => attendee.pass_url && attendee.seat_number);
    if (eligible.length === 0) {
      setMessage({ type: 'error', text: 'No selected attendees have a pass ready.' });
      return;
    }
    setBulkLoading(true);
    for (let i = 0; i < eligible.length; i += 1) {
      const attendee = eligible[i];
      const link = buildPassWhatsAppLink(attendee.mobile, attendee.name || '', attendee.pass_url!, attendee.seat_number!, eventCtx);
      window.open(link, '_blank', 'noopener,noreferrer');
      if (i < eligible.length - 1) await new Promise((resolve) => setTimeout(resolve, 400));
    }
    setMessage({ type: 'success', text: `Opened WhatsApp for ${eligible.length} attendee(s)` });
    setBulkLoading(false);
  }

  async function bulkDelete() {
    const deletable = selectedAttendees;
    if (!window.confirm(`Delete ${deletable.length} attendee(s)? Checked-in logs will be removed and assigned seats will become available. This cannot be undone.`)) return;
    setBulkLoading(true);
    let deleted = 0;
    for (const attendee of deletable) {
      try {
        const res = await fetch(`/api/attendees?id=${attendee.id}`, { method: 'DELETE' });
        const response = await res.json();
        if (response.success) deleted += 1;
      } catch {
      }
    }
    setMessage({ type: 'success', text: `Deleted ${deleted} attendee(s)` });
    setSelectedIds(new Set());
    fetchAttendees();
    setBulkLoading(false);
  }

  async function bulkRegenerate() {
    if (!window.confirm(`Regenerate passes for ${selectedIds.size} attendee(s)? Old QR codes will stop working.`)) return;
    setBulkLoading(true);
    let done = 0;
    for (const attendee of selectedAttendees) {
      try {
        const res = await fetch('/api/attendees/generate-pass', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendee_id: attendee.id, force: true }),
        });
        const response = await res.json();
        if (response.success) done += 1;
      } catch {
      }
    }
    setMessage({ type: 'success', text: `Regenerated ${done} pass(es)` });
    setSelectedIds(new Set());
    fetchAttendees();
    setBulkLoading(false);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <EventSelectorBar onChange={handleEventChange} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 lg:px-6 lg:py-8">
        <AdminHero
          eyebrow="Confirmed Visitors"
          title={selectedEvent ? `${selectedEvent.title} attendee desk` : 'Manage confirmed visitors and pass delivery'}
          description={selectedEvent ? 'Review pass holders, resend passes, edit attendee records, and regenerate QR codes when needed.' : 'Choose an event first. Once selected, this page becomes the control room for confirmed visitors and pass operations.'}
        >
          {selectedEvent ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Total Attendees" value={data?.total ?? '...'} note="Confirmed visitors with generated passes" tone="indigo" variant="dark" />
              <MetricTile label="Pass Ready" value={stats.ready} note="Not checked in yet on this page snapshot" tone="emerald" variant="dark" />
              <MetricTile label="Checked In" value={stats.checkedIn} note="Already admitted at the venue" tone="amber" variant="dark" />
              <MetricTile label="Selected" value={selectedIds.size} note="Bulk resend, regenerate, or delete actions" tone="slate" variant="dark" />
            </div>
          ) : null}
        </AdminHero>

        {!selectedEvent ? (
          <EmptyPanel title="Select an event to manage confirmed visitors" description="Attendee lists and pass operations are event-specific. Pick the active event from the top selector to continue." />
        ) : (
          <>
            {message ? <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{message.text}</div> : null}

            <SurfaceCard eyebrow="Search" title="Find attendees fast" description="Search by name, mobile number, or pass number. The list already limits results to visitors who have a pass.">
              <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field w-full sm:max-w-md" placeholder="Search by name, mobile, or pass number" />
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button type="submit" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Search</button>
                  <button type="button" onClick={() => { setSearch(''); setPage(1); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50">Clear</button>
                </div>
              </form>

              {selectedIds.size > 0 ? (
                <div className="mt-5 flex flex-col gap-3 rounded-[24px] border border-indigo-200 bg-indigo-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">{selectedIds.size} attendees selected</p>
                    <p className="mt-1 text-sm text-indigo-700">Bulk-send passes, regenerate QR codes, or remove attendees not yet checked in.</p>
                  </div>
                  <div className="grid gap-2 sm:flex">
                    <button onClick={bulkSendPasses} disabled={bulkLoading} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40">Send Passes</button>
                    <button onClick={bulkRegenerate} disabled={bulkLoading} className="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-40">Regenerate</button>
                    <button onClick={bulkDelete} disabled={bulkLoading} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40">Delete</button>
                  </div>
                </div>
              ) : null}
            </SurfaceCard>

            <SurfaceCard eyebrow="Roster" title="Attendee list" description="Desktop mode keeps a denser table. Mobile mode switches to stacked action cards for field teams.">
              {loading ? (
                <div className="py-16 text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" /></div>
              ) : data && data.attendees.length > 0 ? (
                <>
                  <div className="hidden overflow-x-auto xl:block">
                    <table className="w-full">
                      <thead>
                        <tr className="table-header">
                          <th className="w-10 px-4 py-3"><input ref={selectAllRef} type="checkbox" checked={allOnPageSelected} onChange={toggleAll} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900" /></th>
                          <th className="px-4 py-3 text-left">Name</th>
                          <th className="px-4 py-3 text-left">Mobile</th>
                          <th className="px-4 py-3 text-left">Company</th>
                          <th className="px-4 py-3 text-left">Seat</th>
                          <th className="px-4 py-3 text-left">Pass</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.attendees.map((attendee) => {
                          const selected = selectedIds.has(attendee.id);
                          return (
                            <tr key={attendee.id} className={`${selected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'} ${actionLoading === attendee.id ? 'pointer-events-none opacity-50' : ''}`}>
                              <td className="px-4 py-3"><input type="checkbox" checked={selected} onChange={() => toggleOne(attendee.id)} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900" /></td>
                              <td className="px-4 py-3 text-sm font-semibold text-slate-900">{attendee.name || 'Unnamed attendee'}</td>
                              <td className="px-4 py-3 font-mono text-sm text-slate-700">{attendee.mobile}</td>
                              <td className="px-4 py-3 text-sm text-slate-500">{attendee.business_name || '-'}</td>
                              <td className="px-4 py-3">{attendee.seat_number ? <InlineStatus tone="slate">{attendee.seat_number}</InlineStatus> : <span className="text-sm text-slate-300">-</span>}</td>
                              <td className="px-4 py-3">{attendee.pass_number ? <div className="flex items-center gap-2"><span className="font-mono text-sm font-semibold text-indigo-700">{attendee.pass_number}</span><a href={attendee.pass_url || `/p/${attendee.qr_token}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-slate-500 underline">Open</a></div> : <span className="text-sm text-slate-300">Generating...</span>}</td>
                              <td className="px-4 py-3">{attendee.checked_in_at ? <InlineStatus tone="emerald">Checked in</InlineStatus> : <InlineStatus tone="indigo">Pass ready</InlineStatus>}</td>
                              <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2">{attendee.pass_url && attendee.seat_number ? <button onClick={() => { const link = buildPassWhatsAppLink(attendee.mobile, attendee.name || '', attendee.pass_url!, attendee.seat_number!, eventCtx); window.open(link, '_blank', 'noopener,noreferrer'); }} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">Send Pass</button> : null}<ActionMenu attendee={attendee} eventCtx={eventCtx} onEdit={openEdit} onDelete={handleDelete} onRegenerate={handleRegenerate} /></div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-4 xl:hidden">
                    {data.attendees.map((attendee) => {
                      const selected = selectedIds.has(attendee.id);
                      return (
                        <div key={attendee.id} className={`rounded-[24px] border p-4 shadow-sm ${selected ? 'border-indigo-200 bg-indigo-50/70' : 'border-slate-200 bg-white'} ${actionLoading === attendee.id ? 'pointer-events-none opacity-50' : ''}`}>
                          <div className="flex items-start gap-3">
                            <input type="checkbox" checked={selected} onChange={() => toggleOne(attendee.id)} className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">{attendee.name || 'Unnamed attendee'}</p>
                                {attendee.checked_in_at ? <InlineStatus tone="emerald">Checked in</InlineStatus> : <InlineStatus tone="indigo">Pass ready</InlineStatus>}
                              </div>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Mobile</p><p className="mt-2 font-mono text-sm text-slate-700">{attendee.mobile}</p></div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Seat</p><p className="mt-2 text-sm text-slate-700">{attendee.seat_number || 'Not assigned'}</p></div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Pass</p><p className="mt-2 text-sm text-slate-700">{attendee.pass_number || 'Generating...'}</p>{attendee.business_name ? <p className="mt-1 text-sm text-slate-500">{attendee.business_name}</p> : null}</div>
                              </div>
                              <div className="mt-4 grid gap-2 sm:grid-cols-2">{attendee.pass_url && attendee.seat_number ? <button onClick={() => { const link = buildPassWhatsAppLink(attendee.mobile, attendee.name || '', attendee.pass_url!, attendee.seat_number!, eventCtx); window.open(link, '_blank', 'noopener,noreferrer'); }} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Send Pass</button> : null}<ActionMenu attendee={attendee} eventCtx={eventCtx} onEdit={openEdit} onDelete={handleDelete} onRegenerate={handleRegenerate} /></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {data.total_pages > 1 ? <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-500">Page {data.page} of {data.total_pages}</p><div className="grid grid-cols-2 gap-2 sm:flex"><button onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">Previous</button><button onClick={() => setPage((prev) => Math.min(data.total_pages, prev + 1))} disabled={page >= data.total_pages} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">Next</button></div></div> : null}
                </>
              ) : (
                <EmptyPanel title={search ? 'No attendees match the search' : 'No confirmed attendees yet'} description={search ? 'Try a different search term or clear the filter.' : 'Contacts need to confirm participation first. Once they submit the invite form, they will appear here with a generated pass.'} />
              )}
            </SurfaceCard>
          </>
        )}
      </div>

      {editTarget ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-sm sm:items-center sm:justify-end">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white px-5 py-6 shadow-2xl sm:px-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">Edit Attendee</p><h2 className="mt-2 text-xl font-bold text-slate-950">{editTarget.name || editTarget.mobile}</h2><p className="mt-1 text-sm text-slate-500">{editTarget.pass_number || 'Pass number pending'}</p></div>
              <button onClick={() => setEditTarget(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Close</button>
            </div>
            <form onSubmit={handleEditSave} className="mt-5 space-y-4">
              <div><label className="input-label">Full Name</label><input type="text" value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} className={inputCls} placeholder="e.g. Rahul Sharma" /></div>
              <div><label className="input-label">Mobile Number</label><input type="tel" required value={editForm.mobile} onChange={(e) => setEditForm((prev) => ({ ...prev, mobile: e.target.value }))} className={inputCls} placeholder="10-digit mobile number" /></div>
              <div><label className="input-label">Email Address</label><input type="email" value={editForm.email} onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))} className={inputCls} placeholder="name@example.com" /></div>
              <div><label className="input-label">Company / Business</label><input type="text" value={editForm.business_name} onChange={(e) => setEditForm((prev) => ({ ...prev, business_name: e.target.value }))} className={inputCls} placeholder="Company or organization name" /></div>
              {editError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{editError}</div> : null}
              <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end"><button type="button" onClick={() => setEditTarget(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button><button type="submit" disabled={editSaving} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40">{editSaving ? 'Saving...' : 'Save Changes'}</button></div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
