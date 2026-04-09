'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { buildPassWhatsAppLink, type EventContext } from '@/lib/whatsapp';

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

export default function AttendeesPage() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventCtx, setEventCtx] = useState<EventContext | undefined>(undefined);
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadEventId() {
      const res = await fetch('/api/events');
      const d = await res.json();
      if (d.success && d.data?.[0]?.id) {
        const ev = d.data[0];
        setEventId(ev.id);
        setEventCtx({
          title: ev.title,
          event_date: ev.event_date,
          start_time: ev.start_time,
          end_time: ev.end_time,
          venue_name: ev.venue_name,
          support_contact_number: ev.support_contact_number,
        });
      } else {
        setLoading(false);
      }
    }
    loadEventId();
  }, []);

  const fetchAttendees = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        event_id: eventId,
        page: String(page),
        per_page: '20',
        pass_filter: 'has_pass',
      });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/attendees?${params}`);
      const d = await res.json();
      if (d.success) setData(d.data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load attendees' });
    } finally {
      setLoading(false);
    }
  }, [eventId, page, search]);

  useEffect(() => { fetchAttendees(); }, [fetchAttendees]);

  function handleSearch(e: FormEvent) { e.preventDefault(); setPage(1); }

  function openPassWhatsApp(a: Attendee) {
    if (!a.pass_url || !a.pass_number || !a.seat_number) return;
    const link = buildPassWhatsAppLink(a.mobile, a.name || '', a.pass_url, a.seat_number, eventCtx);
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  if (!eventId && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
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
          <h1 className="text-xl font-bold text-slate-900">Confirmed Visitors</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {data ? `${data.total} confirmed` : 'Loading…'} · Passes auto-generated on form submission
          </p>
        </div>
      </div>

      {message && (
        <div className={`mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field max-w-xs"
            placeholder="Search by name, mobile, or pass…"
          />
          <button
            type="submit"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
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
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
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
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
                    </div>
                  </td>
                </tr>
              ) : data && data.attendees.length > 0 ? (
                data.attendees.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
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
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-brand-700">{a.pass_number}</span>
                          <a
                            href={a.pass_url || `/p/${a.qr_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-500 hover:text-brand-700 transition-colors"
                            title="Preview pass"
                          >
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
                      {a.pass_url && a.seat_number && (
                        <button
                          onClick={() => openPassWhatsApp(a)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                          title="Send pass via WhatsApp Web"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Send Pass
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
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
    </div>
  );
}
