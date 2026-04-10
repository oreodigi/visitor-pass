'use client';

import { useState, useEffect, FormEvent, useCallback, useRef } from 'react';
import { buildInviteWhatsAppLink, type EventContext } from '@/lib/whatsapp';
import { EventSelectorBar, type EventSummary } from '@/app/admin/_components/event-selector';

interface Contact {
  id: string;
  mobile: string;
  invitation_link: string;
  status: 'uploaded' | 'invited' | 'confirmed' | 'cancelled';
  whatsapp_invite_status: 'pending' | 'sent';
  invited_at: string | null;
  responded_at: string | null;
  attendee_id: string | null;
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

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  uploaded: { label: 'Uploaded', cls: 'badge badge-slate' },
  invited: { label: 'Invited', cls: 'badge badge-blue' },
  confirmed: { label: 'Confirmed', cls: 'badge badge-green' },
  cancelled: { label: 'Cancelled', cls: 'badge badge-red' },
};

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
      const d = await res.json();
      if (d.success) setData(d.data);
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
      const d = await res.json();
      if (d.success) fetchContacts();
      else setMessage({ type: 'error', text: d.error?.message || 'Failed to update' });
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setMarkingInvited(null);
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
      const d = await res.json();
      if (!d.success) {
        setAddError(d.error?.message || 'Failed to add contact');
      } else if (d.data.inserted === 0) {
        setAddError(d.data.errors?.[0]?.reason || 'Mobile number already exists or is invalid');
      } else {
        setAddMobile('');
        setAddModalOpen(false);
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
      const d = await res.json();
      if (d.success) {
        setMessage({ type: 'success', text: `Deleted ${d.data.deleted} contact(s)` });
        setSelectedIds(new Set());
        fetchContacts();
      } else {
        setMessage({ type: 'error', text: d.error?.message || 'Failed to delete' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkSendInvites() {
    if (!data) return;
    const eligible = data.contacts.filter((c) => selectedIds.has(c.id) && c.status !== 'confirmed');
    if (eligible.length === 0) {
      setMessage({ type: 'error', text: 'No eligible contacts selected (confirmed contacts are skipped)' });
      return;
    }

    setBulkLoading(true);
    try {
      for (let i = 0; i < eligible.length; i += 1) {
        const c = eligible[i];
        const link = buildInviteWhatsAppLink(c.mobile, c.invitation_link, eventCtx);
        window.open(link, '_blank', 'noopener,noreferrer');
        if (i < eligible.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      const res = await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: eligible.map((c) => c.id), action: 'bulk_mark_invited' }),
      });
      const d = await res.json();
      if (d.success) {
        setMessage({ type: 'success', text: `Sent invites to ${eligible.length} contact(s)` });
        setSelectedIds(new Set());
        fetchContacts();
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to send invites' });
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <EventSelectorBar onChange={handleEventChange} />

      <div className="mx-auto w-full max-w-6xl px-4 py-5 lg:py-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Contacts &amp; Invites</h1>
            <p className="mt-0.5 text-sm text-slate-500">{data ? `${data.total} total` : 'Loading...'}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
            <button
              onClick={() => {
                setAddModalOpen(true);
                setAddMobile('');
                setAddError('');
                setTimeout(() => addInputRef.current?.focus(), 50);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Contact
            </button>
            <a
              href="/admin/import"
              className="btn-primary inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              Upload CSV
            </a>
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {message.text}
            <button
              onClick={() => setMessage(null)}
              className="ml-auto -mr-1 text-current opacity-50 hover:opacity-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field w-full sm:max-w-sm"
                placeholder="Search by mobile..."
              />
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Search
                </button>
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setPage(1);
                    }}
                    className="rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
              {(['all', 'uploaded', 'invited', 'confirmed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setStatusFilter(f);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    statusFilter === f ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </form>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 sm:flex-row sm:items-center">
            <span className="text-sm font-medium text-brand-800">{selectedIds.size} selected</span>
            <div className="grid grid-cols-1 gap-2 sm:ml-auto sm:flex sm:items-center">
              <button
                onClick={handleBulkSendInvites}
                disabled={bulkLoading}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                Send Invites
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkLoading}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                disabled={bulkLoading}
                className="rounded-lg px-2.5 py-2 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="w-10 px-4 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      aria-label="Select all on page"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Mobile</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Invited At</th>
                  <th className="px-4 py-3 text-left">Responded At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
                      </div>
                    </td>
                  </tr>
                ) : data && data.contacts.length > 0 ? (
                  data.contacts.map((c) => {
                    const badge = STATUS_LABELS[c.status] || STATUS_LABELS.uploaded;
                    const isSelected = selectedIds.has(c.id);
                    return (
                      <tr
                        key={c.id}
                        className={`transition-colors ${isSelected ? 'bg-brand-50/60' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(c.id)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            aria-label={`Select ${c.mobile}`}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-sm font-medium text-slate-900">{c.mobile}</td>
                        <td className="px-4 py-3">
                          <span className={badge.cls}>{badge.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatStamp(c.invited_at)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatStamp(c.responded_at)}</td>
                        <td className="px-4 py-3 text-right">
                          {c.status === 'confirmed' && c.attendee_id ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Confirmed
                            </span>
                          ) : (
                            <button
                              onClick={() => openInviteWhatsApp(c)}
                              disabled={markingInvited === c.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
                              title="Send form link via WhatsApp Web"
                            >
                              Send Invite
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                      {search || statusFilter !== 'all'
                        ? 'No contacts match your filters'
                        : 'No contacts yet. Upload a CSV to get started.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {loading ? (
              <div className="px-4 py-12 text-center">
                <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
              </div>
            ) : data && data.contacts.length > 0 ? (
              data.contacts.map((c) => {
                const badge = STATUS_LABELS[c.status] || STATUS_LABELS.uploaded;
                const isSelected = selectedIds.has(c.id);
                return (
                  <div key={c.id} className={`p-4 ${isSelected ? 'bg-brand-50/60' : 'bg-white'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(c.id)}
                        className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        aria-label={`Select ${c.mobile}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-semibold text-slate-900">{c.mobile}</p>
                          <span className={badge.cls}>{badge.label}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Invited</p>
                            <p className="mt-1">{formatStamp(c.invited_at)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Responded</p>
                            <p className="mt-1">{formatStamp(c.responded_at)}</p>
                          </div>
                        </div>
                        <div className="mt-4">
                          {c.status === 'confirmed' && c.attendee_id ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Confirmed
                            </span>
                          ) : (
                            <button
                              onClick={() => openInviteWhatsApp(c)}
                              disabled={markingInvited === c.id}
                              className="w-full rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
                            >
                              Send Invite
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-12 text-center text-sm text-slate-400">
                {search || statusFilter !== 'all'
                  ? 'No contacts match your filters'
                  : 'No contacts yet. Upload a CSV to get started.'}
              </div>
            )}
          </div>

          {data && data.total_pages > 1 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Page {data.page} of {data.total_pages}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                  disabled={page >= data.total_pages}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {addModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
            onClick={() => setAddModalOpen(false)}
          >
            <div
              className="card w-full rounded-t-3xl p-5 shadow-modal sm:max-w-sm sm:rounded-2xl sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-1 text-base font-bold text-slate-900">Add Contact</h2>
              <p className="mb-4 text-xs text-slate-500">
                Enter a mobile number to add a single contact and generate an invitation link.
              </p>
              <form onSubmit={handleAddContact} className="space-y-4">
                <div>
                  <label className="input-label">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
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
                {addError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {addError}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 pt-1 sm:flex sm:items-center">
                  <button type="submit" disabled={addSaving} className="btn-primary w-full sm:w-auto">
                    {addSaving ? 'Adding...' : 'Add Contact'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Cancel
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
