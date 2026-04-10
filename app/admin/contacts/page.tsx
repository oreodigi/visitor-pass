'use client';

import { useState, useEffect, FormEvent, useCallback, useRef } from 'react';
import { buildInviteWhatsAppLink, type EventContext } from '@/lib/whatsapp';

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
  uploaded:  { label: 'Uploaded',  cls: 'badge badge-slate' },
  invited:   { label: 'Invited',   cls: 'badge badge-blue' },
  confirmed: { label: 'Confirmed', cls: 'badge badge-green' },
  cancelled: { label: 'Cancelled', cls: 'badge badge-red' },
};

export default function ContactsPage() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventCtx, setEventCtx] = useState<EventContext | undefined>(undefined);
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

  // Selection state
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

  // Clear selection when page/filter changes
  useEffect(() => { setSelectedIds(new Set()); }, [page, statusFilter, search]);

  function toggleAll() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentPageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentPageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    async function loadEventId() {
      const res = await fetch('/api/events');
      const d = await res.json();
      if (d.success && d.data?.[0]?.id) {
        const ev = d.data[0];
        setEventId(ev.id);
        setEventCtx({ title: ev.title, event_date: ev.event_date, venue_name: ev.venue_name });
      } else {
        setLoading(false);
      }
    }
    loadEventId();
  }, []);

  const fetchContacts = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ event_id: eventId, page: String(page), per_page: '20' });
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

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  function handleSearch(e: FormEvent) { e.preventDefault(); setPage(1); }

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
    const eligible = data.contacts.filter(
      (c) => selectedIds.has(c.id) && c.status !== 'confirmed'
    );
    if (eligible.length === 0) {
      setMessage({ type: 'error', text: 'No eligible contacts selected (confirmed contacts are skipped)' });
      return;
    }
    setBulkLoading(true);
    try {
      for (let i = 0; i < eligible.length; i++) {
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

  if (!eventId && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-slate-800">No Event Found</h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Create an event in{' '}
          <a href="/admin/event-settings" className="text-brand-600 underline font-medium">Event Settings</a>{' '}
          first.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:py-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Contacts &amp; Invites</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {data ? `${data.total} total` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAddModalOpen(true); setAddMobile(''); setAddError(''); setTimeout(() => addInputRef.current?.focus(), 50); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Contact
          </button>
          <a href="/admin/import" className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Upload CSV
          </a>
        </div>
      </div>

      {message && (
        <div className={`mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto -mr-1 text-current opacity-50 hover:opacity-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Search + Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field max-w-xs"
            placeholder="Search by mobile…"
          />
          <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setPage(1); }}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
          {(['all', 'uploaded', 'invited', 'confirmed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setStatusFilter(f); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-medium text-brand-800">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleBulkSendInvites}
              disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Send Invites
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkLoading}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
            >
              Clear
            </button>
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
                <th className="px-4 py-3 text-left">Mobile</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Invited At</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Responded At</th>
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
                      className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-brand-50/60' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(c.id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                          aria-label={`Select ${c.mobile}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-medium text-slate-900">{c.mobile}</td>
                      <td className="px-4 py-3">
                        <span className={badge.cls}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-500">
                        {c.invited_at
                          ? new Date(c.invited_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-500">
                        {c.responded_at
                          ? new Date(c.responded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
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
                              className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                              title="Send form link via WhatsApp Web"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              Send Invite
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    {search || statusFilter !== 'all' ? 'No contacts match your filters' : 'No contacts yet. Upload a CSV to get started.'}
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
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAddModalOpen(false)}>
          <div className="card w-full max-w-sm p-6 shadow-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-slate-900 mb-1">Add Contact</h2>
            <p className="text-xs text-slate-500 mb-4">Enter a mobile number to add a single contact and generate their invitation link.</p>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="input-label">Mobile Number <span className="text-red-500">*</span></label>
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
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</div>
              )}
              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={addSaving} className="btn-primary">
                  {addSaving ? 'Adding…' : 'Add Contact'}
                </button>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
