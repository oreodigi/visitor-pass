'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { buildInviteWhatsAppLink, type EventContext } from '@/lib/whatsapp';
import { EventSelectorBar, type EventSummary } from '@/app/admin/_components/event-selector';
import { AdminHero, EmptyPanel, InlineStatus, MetricTile, SurfaceCard } from '@/app/admin/_components/admin-surface';

interface Contact {
  id: string;
  mobile: string;
  invitation_link: string;
  status: 'uploaded' | 'invited' | 'confirmed' | 'cancelled';
  whatsapp_invite_status: 'pending' | 'sent';
  invited_at: string | null;
  responded_at: string | null;
  attendee_id: string | null;
  pass_whatsapp_status?: 'pending' | 'ready' | 'sent' | 'opened' | 'failed' | null;
  pass_whatsapp_sent_at?: string | null;
  pass_generated_at?: string | null;
  pass_url?: string | null;
  created_at: string;
}

interface PaginatedResponse {
  contacts: Contact[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

type StatusFilter = 'all' | 'uploaded' | 'invited' | 'confirmed';

const STATUS_LABELS: Record<string, { label: string; tone: 'slate' | 'indigo' | 'emerald' | 'rose' }> = {
  uploaded: { label: 'Uploaded', tone: 'slate' },
  invited: { label: 'Invited', tone: 'indigo' },
  confirmed: { label: 'Confirmed', tone: 'emerald' },
  cancelled: { label: 'Cancelled', tone: 'rose' },
};

function getPassDelivery(contact: Contact): { label: string; tone: 'slate' | 'indigo' | 'emerald' | 'rose' | 'amber' } {
  if (contact.pass_whatsapp_status === 'sent' || contact.pass_whatsapp_status === 'opened') {
    return { label: 'Pass sent', tone: 'emerald' };
  }
  if (contact.pass_whatsapp_status === 'failed') return { label: 'Pass failed', tone: 'rose' };
  if (contact.pass_url || contact.pass_generated_at || contact.attendee_id) return { label: 'Pass ready', tone: 'amber' };
  return { label: 'No pass yet', tone: 'slate' };
}

function formatStamp(value: string | null) {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ContactsPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [eventCtx, setEventCtx] = useState<EventContext | undefined>(undefined);
  const eventId = selectedEvent?.id ?? null;
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [markingInvited, setMarkingInvited] = useState<string | null>(null);
  const [markingPassSent, setMarkingPassSent] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addMobile, setAddMobile] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const currentPageIds = data?.contacts.map((c) => c.id) ?? [];
  const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = currentPageIds.some((id) => selectedIds.has(id));
  const selectedContacts = data?.contacts.filter((contact) => selectedIds.has(contact.id)) ?? [];

  const currentPageStats = useMemo(() => {
    const rows = data?.contacts ?? [];
    return {
      confirmed: rows.filter((row) => row.status === 'confirmed').length,
      pendingSend: rows.filter((row) => row.status !== 'confirmed').length,
      passSent: rows.filter((row) => row.pass_whatsapp_status === 'sent' || row.pass_whatsapp_status === 'opened').length,
      responded: rows.filter((row) => row.responded_at).length,
    };
  }, [data]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someOnPageSelected && !allOnPageSelected;
    }
  }, [someOnPageSelected, allOnPageSelected]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, statusFilter, search]);

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
    setStatusFilter('all');
    setSelectedIds(new Set());
    if (ev) {
      setEventCtx({ title: ev.title, event_date: ev.event_date, venue_name: ev.venue_name });
    } else {
      setEventCtx(undefined);
      setLoading(false);
    }
  }

  const fetchContacts = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        event_id: eventId,
        page: String(page),
        per_page: '20',
      });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status_filter', statusFilter);
      const res = await fetch(`/api/contacts?${params}`);
      const response = await res.json();
      if (response.success) setData(response.data);
      else setMessage({ type: 'error', text: response.error?.message || 'Failed to load contacts' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to load contacts' });
    } finally {
      setLoading(false);
    }
  }, [eventId, page, search, statusFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  async function handleMarkInvited(contact: Contact) {
    setMarkingInvited(contact.id);
    try {
      const res = await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contact.id, action: 'mark_invited' }),
      });
      const response = await res.json();
      if (response.success) fetchContacts();
      else setMessage({ type: 'error', text: response.error?.message || 'Failed to update contact' });
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setMarkingInvited(null);
    }
  }

  async function handleMarkPassSent(contact: Contact) {
    setMarkingPassSent(contact.id);
    try {
      const res = await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contact.id, action: 'mark_pass_sent' }),
      });
      const response = await res.json();
      if (response.success) {
        setMessage({ type: 'success', text: `Marked ${contact.mobile} as pass sent` });
        fetchContacts();
      } else {
        setMessage({ type: 'error', text: response.error?.message || 'Failed to mark pass sent' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setMarkingPassSent(null);
    }
  }

  async function handleAddContact(e: FormEvent) {
    e.preventDefault();
    setAddError('');
    if (!addMobile.trim() || !eventId) return;
    setAddSaving(true);
    try {
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        body: (() => {
          const blob = new Blob([`mobile\n${addMobile.trim()}`], { type: 'text/plain' });
          const fd = new FormData();
          fd.append('event_id', eventId);
          fd.append('file', blob, 'contact.csv');
          return fd;
        })(),
      });
      const response = await res.json();
      if (!response.success) {
        setAddError(response.error?.message || 'Failed to add contact');
      } else if (response.data.inserted === 0) {
        setAddError(response.data.errors?.[0]?.reason || 'Mobile number already exists or is invalid');
      } else {
        setAddMobile('');
        setAddModalOpen(false);
        setMessage({ type: 'success', text: 'Contact added successfully' });
        fetchContacts();
      }
    } catch {
      setAddError('Network error');
    } finally {
      setAddSaving(false);
    }
  }

  function openInviteWhatsApp(contact: Contact) {
    const link = buildInviteWhatsAppLink(contact.mobile, contact.invitation_link, eventCtx);
    window.open(link, '_blank', 'noopener,noreferrer');
    handleMarkInvited(contact);
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.size} selected contact(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const response = await res.json();
      if (response.success) {
        setMessage({ type: 'success', text: `Deleted ${response.data.deleted} contact(s)` });
        setSelectedIds(new Set());
        fetchContacts();
      } else {
        setMessage({ type: 'error', text: response.error?.message || 'Failed to delete contacts' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkSendInvites() {
    const eligible = selectedContacts.filter((contact) => contact.status !== 'confirmed');
    if (eligible.length === 0) {
      setMessage({ type: 'error', text: 'No eligible contacts selected. Confirmed contacts are skipped.' });
      return;
    }

    setBulkLoading(true);
    try {
      for (let i = 0; i < eligible.length; i += 1) {
        const contact = eligible[i];
        const link = buildInviteWhatsAppLink(contact.mobile, contact.invitation_link, eventCtx);
        window.open(link, '_blank', 'noopener,noreferrer');
        if (i < eligible.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
      const res = await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: eligible.map((contact) => contact.id), action: 'bulk_mark_invited' }),
      });
      const response = await res.json();
      if (response.success) {
        setMessage({ type: 'success', text: `Opened WhatsApp for ${eligible.length} contact(s)` });
        setSelectedIds(new Set());
        fetchContacts();
      } else {
        setMessage({ type: 'error', text: response.error?.message || 'Failed to update invite status' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to send invites' });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkMarkPassSent() {
    const eligible = selectedContacts.filter((contact) =>
      (contact.attendee_id || contact.pass_url || contact.pass_generated_at) &&
      contact.pass_whatsapp_status !== 'sent' &&
      contact.pass_whatsapp_status !== 'opened'
    );
    if (eligible.length === 0) {
      setMessage({ type: 'error', text: 'No selected contacts have unsent generated passes.' });
      return;
    }

    setBulkLoading(true);
    let updated = 0;
    try {
      for (const contact of eligible) {
        const res = await fetch('/api/contacts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: contact.id, action: 'mark_pass_sent' }),
        });
        const response = await res.json();
        if (response.success) updated += 1;
      }
      setMessage({ type: 'success', text: `Marked ${updated} contact(s) as pass sent` });
      setSelectedIds(new Set());
      fetchContacts();
    } catch {
      setMessage({ type: 'error', text: 'Failed to mark selected passes sent' });
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.08),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <EventSelectorBar onChange={handleEventChange} />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 lg:px-6 lg:py-8">
        <AdminHero
          eyebrow="Contacts and Invites"
          title={selectedEvent ? `${selectedEvent.title} contact desk` : 'Manage imported contacts and invite delivery'}
          description={
            selectedEvent
              ? 'Review fresh imports, send individual or bulk invites, and track which contacts already confirmed attendance.'
              : 'Choose an event first. This screen becomes the operating table for contact hygiene, invite sending, and response tracking.'
          }
          actions={
            selectedEvent ? (
              <>
                <button
                  onClick={() => {
                    setAddModalOpen(true);
                    setAddMobile('');
                    setAddError('');
                    setTimeout(() => addInputRef.current?.focus(), 80);
                  }}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Add Single Contact
                </button>
                <a href="/admin/import" className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                  Open Importer
                </a>
              </>
            ) : undefined
          }
        >
          {selectedEvent ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Total Contacts" value={data?.total ?? '...'} note="Rows currently stored for this event" tone="indigo" variant="dark" />
              <MetricTile label="Confirmed" value={currentPageStats.confirmed} note="Confirmed visitors on this page snapshot" tone="emerald" variant="dark" />
              <MetricTile label="Pass Sent" value={currentPageStats.passSent} note="Manual, runner, or bulk pass sends on this page" tone="emerald" variant="dark" />
              <MetricTile label="Selected" value={selectedIds.size} note="Bulk actions become available when contacts are selected" tone="slate" variant="dark" />
            </div>
          ) : null}
        </AdminHero>

        {!selectedEvent ? (
          <EmptyPanel
            title="Select an event to unlock contact operations"
            description="The contact list, invite links, and bulk send actions all depend on the active event context from the top selector."
          />
        ) : (
          <>
            {message ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                {message.text}
              </div>
            ) : null}

            <SurfaceCard
              eyebrow="Filters"
              title="Search and segment contacts"
              description="Filter the event list by status or mobile prefix, then use bulk actions to move faster."
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <form onSubmit={handleSearch} className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-xl">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-field w-full"
                    placeholder="Search by mobile number"
                  />
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button type="submit" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Search
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setPage(1);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  </div>
                </form>

                <div className="flex flex-wrap gap-2">
                  {(['all', 'uploaded', 'invited', 'confirmed'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setStatusFilter(filter);
                        setPage(1);
                      }}
                      className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] transition ${
                        statusFilter === filter
                          ? 'bg-slate-950 text-white'
                          : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-700'
                      }`}
                    >
                      {filter === 'all' ? 'All' : filter}
                    </button>
                  ))}
                </div>
              </div>

              {selectedIds.size > 0 ? (
                <div className="mt-5 flex flex-col gap-3 rounded-[24px] border border-indigo-200 bg-indigo-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">{selectedIds.size} contacts selected</p>
                    <p className="mt-1 text-sm text-indigo-700">Run invite sends in bulk or clean out invalid list entries.</p>
                  </div>
                  <div className="grid gap-2 sm:flex">
                    <button onClick={handleBulkSendInvites} disabled={bulkLoading} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40">
                      Send Invites
                    </button>
                    <button onClick={handleBulkMarkPassSent} disabled={bulkLoading} className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-40">
                      Mark Pass Sent
                    </button>
                    <button onClick={handleBulkDelete} disabled={bulkLoading} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40">
                      Delete Selected
                    </button>
                    <button onClick={() => setSelectedIds(new Set())} disabled={bulkLoading} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}
            </SurfaceCard>

            <SurfaceCard
              eyebrow="List"
              title="Contact roster"
              description="Use desktop table mode for fast scanning and mobile cards for field teams."
            >
              {loading ? (
                <div className="py-16 text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
                </div>
              ) : data && data.contacts.length > 0 ? (
                <>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full">
                      <thead>
                        <tr className="table-header">
                          <th className="w-10 px-4 py-3">
                            <input
                              ref={selectAllRef}
                              type="checkbox"
                              checked={allOnPageSelected}
                              onChange={toggleAll}
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                          </th>
                          <th className="px-4 py-3 text-left">Mobile</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-left">Invited</th>
                          <th className="px-4 py-3 text-left">Pass Delivery</th>
                          <th className="px-4 py-3 text-left">Responded</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.contacts.map((contact) => {
                          const status = STATUS_LABELS[contact.status] || STATUS_LABELS.uploaded;
                          const passDelivery = getPassDelivery(contact);
                          const selected = selectedIds.has(contact.id);
                          return (
                            <tr key={contact.id} className={selected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleOne(contact.id)}
                                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                />
                              </td>
                              <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-900">{contact.mobile}</td>
                              <td className="px-4 py-3">
                                <InlineStatus tone={status.tone}>{status.label}</InlineStatus>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-500">{formatStamp(contact.invited_at)}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col items-start gap-1.5">
                                  <InlineStatus tone={passDelivery.tone}>{passDelivery.label}</InlineStatus>
                                  {contact.pass_whatsapp_sent_at ? <span className="text-xs text-slate-500">{formatStamp(contact.pass_whatsapp_sent_at)}</span> : null}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-500">{formatStamp(contact.responded_at)}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex flex-wrap justify-end gap-2">
                                  {contact.pass_whatsapp_status === 'sent' || contact.pass_whatsapp_status === 'opened' ? (
                                    <InlineStatus tone="emerald">Done</InlineStatus>
                                  ) : contact.attendee_id || contact.pass_url || contact.pass_generated_at ? (
                                    <button
                                      onClick={() => handleMarkPassSent(contact)}
                                      disabled={markingPassSent === contact.id}
                                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
                                    >
                                      Mark Pass Sent
                                    </button>
                                  ) : null}
                                  {contact.status !== 'confirmed' ? (
                                    <button
                                      onClick={() => openInviteWhatsApp(contact)}
                                      disabled={markingInvited === contact.id}
                                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                                    >
                                      Send Invite
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-4 lg:hidden">
                    {data.contacts.map((contact) => {
                      const status = STATUS_LABELS[contact.status] || STATUS_LABELS.uploaded;
                      const passDelivery = getPassDelivery(contact);
                      const selected = selectedIds.has(contact.id);
                      return (
                        <div key={contact.id} className={`rounded-[24px] border p-4 shadow-sm ${selected ? 'border-indigo-200 bg-indigo-50/70' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleOne(contact.id)}
                              className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-mono text-sm font-semibold text-slate-900">{contact.mobile}</p>
                                <InlineStatus tone={status.tone}>{status.label}</InlineStatus>
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Invited</p>
                                  <p className="mt-2 text-sm text-slate-700">{formatStamp(contact.invited_at)}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Responded</p>
                                  <p className="mt-2 text-sm text-slate-700">{formatStamp(contact.responded_at)}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:col-span-2">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Pass Delivery</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <InlineStatus tone={passDelivery.tone}>{passDelivery.label}</InlineStatus>
                                    {contact.pass_whatsapp_sent_at ? <span className="text-xs text-slate-500">{formatStamp(contact.pass_whatsapp_sent_at)}</span> : null}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                {contact.pass_whatsapp_status !== 'sent' && contact.pass_whatsapp_status !== 'opened' && (contact.attendee_id || contact.pass_url || contact.pass_generated_at) ? (
                                  <button
                                    onClick={() => handleMarkPassSent(contact)}
                                    disabled={markingPassSent === contact.id}
                                    className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
                                  >
                                    Mark Pass Sent
                                  </button>
                                ) : null}
                                {contact.status !== 'confirmed' ? (
                                  <button
                                    onClick={() => openInviteWhatsApp(contact)}
                                    disabled={markingInvited === contact.id}
                                    className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
                                  >
                                    Send Invite
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {data.total_pages > 1 ? (
                    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-500">Page {data.page} of {data.total_pages}</p>
                      <div className="grid grid-cols-2 gap-2 sm:flex">
                        <button
                          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                          disabled={page <= 1}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setPage((prev) => Math.min(data.total_pages, prev + 1))}
                          disabled={page >= data.total_pages}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyPanel
                  title={search || statusFilter !== 'all' ? 'No contacts match the current filter' : 'No contacts loaded yet'}
                  description={search || statusFilter !== 'all' ? 'Clear the search or status filter to see more results.' : 'Start by importing a CSV or adding a single mobile number to create invite-ready contacts.'}
                  action={
                    <a href="/admin/import" className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
                      Open Importer
                    </a>
                  }
                />
              )}
            </SurfaceCard>
          </>
        )}
      </div>

      {addModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" onClick={() => setAddModalOpen(false)}>
          <div className="w-full rounded-t-[32px] bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-[28px] sm:p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">Add Contact</p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">Create a single invite-ready contact</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use this for last-minute guest additions without going back to the CSV importer.</p>

            <form onSubmit={handleAddContact} className="mt-5 space-y-4">
              <div>
                <label className="input-label">Mobile Number</label>
                <input
                  ref={addInputRef}
                  type="tel"
                  value={addMobile}
                  onChange={(e) => setAddMobile(e.target.value)}
                  className="input-field"
                  placeholder="10-digit mobile number"
                  required
                />
              </div>
              {addError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{addError}</div> : null}
              <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
                <button type="button" onClick={() => setAddModalOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={addSaving} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40">
                  {addSaving ? 'Adding...' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
