'use client';

import { useEffect, useRef, useState } from 'react';

export interface EventSummary {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
  venue_name: string;
  support_contact_number: string | null;
  invite_message_template: string | null;
  pass_message_template: string | null;
  pass_terms_conditions: string | null;
}

const LS_KEY = 'vp_admin_selected_event';

const STATUS_CFG: Record<string, { dot: string; label: string; pill: string }> = {
  active: { dot: 'bg-emerald-500', label: 'Active', pill: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  draft: { dot: 'bg-slate-400', label: 'Draft', pill: 'bg-slate-100 text-slate-600 ring-slate-200' },
  completed: { dot: 'bg-blue-500', label: 'Completed', pill: 'bg-blue-100 text-blue-700 ring-blue-200' },
  cancelled: { dot: 'bg-red-400', label: 'Cancelled', pill: 'bg-red-100 text-red-700 ring-red-200' },
};

export function fmtEventDate(d: string) {
  if (!d) return '';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

interface Props {
  onChange: (event: EventSummary | null) => void;
}

export function EventSelectorBar({ onChange }: Props) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/events');
        const d = await res.json();
        if (d.success && d.data?.length > 0) {
          const list: EventSummary[] = d.data.map((e: Record<string, unknown>) => ({
            id: e.id as string,
            title: (e.title as string) || '',
            event_date: (e.event_date as string) || '',
            start_time: ((e.start_time as string) || '').slice(0, 5),
            end_time: ((e.end_time as string) || '').slice(0, 5),
            status: (e.status as string) || 'draft',
            venue_name: (e.venue_name as string) || '',
            support_contact_number: (e.support_contact_number as string) || null,
            invite_message_template: (e.invite_message_template as string) || null,
            pass_message_template: (e.pass_message_template as string) || null,
            pass_terms_conditions: (e.pass_terms_conditions as string) || null,
          }));
          setEvents(list);

          const stored = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
          const resolvedId = stored && list.find((e) => e.id === stored) ? stored : list[0].id;

          setSelectedId(resolvedId);
          onChangeRef.current(list.find((e) => e.id === resolvedId) ?? null);
        } else {
          onChangeRef.current(null);
        }
      } catch {
        onChangeRef.current(null);
      } finally {
        setReady(true);
      }
    }
    load();
  }, []);

  function selectEvent(id: string) {
    setSelectedId(id);
    setOpen(false);
    if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, id);
    onChangeRef.current(events.find((e) => e.id === id) ?? null);
  }

  if (!ready) {
    return <div className="h-14 animate-pulse border-b border-slate-200 bg-slate-100 shrink-0 sm:h-10" />;
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shrink-0 sm:px-5 sm:py-2.5">
        <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <span>
          No events found.{' '}
          <a href="/admin/event-settings" className="font-semibold underline">
            Create an event
          </a>
        </span>
      </div>
    );
  }

  const selected = events.find((e) => e.id === selectedId) ?? events[0];
  const cfg = STATUS_CFG[selected.status] ?? STATUS_CFG.draft;

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3 shrink-0 sm:px-5 sm:py-2.5">
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:items-center">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 sm:mt-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
        </svg>

        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Event</span>
          <span className="truncate text-sm font-bold text-slate-800">{selected.title || 'Untitled'}</span>
          {selected.event_date && <span className="text-xs text-slate-400">{fmtEventDate(selected.event_date)}</span>}
          <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cfg.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {events.length > 1 && (
          <div ref={dropRef} className="relative ml-auto shrink-0">
            <button
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
            >
              Switch
              <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {open && (
              <div className="absolute right-0 z-50 mt-1.5 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:w-72">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Select Event</p>
                </div>
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {events.map((ev) => {
                    const ecfg = STATUS_CFG[ev.status] ?? STATUS_CFG.draft;
                    const isSelected = ev.id === selectedId;
                    return (
                      <button
                        key={ev.id}
                        onClick={() => selectEvent(ev.id)}
                        className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-brand-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ecfg.dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-semibold ${isSelected ? 'text-brand-900' : 'text-slate-800'}`}>
                            {ev.title || 'Untitled'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {ev.event_date ? fmtEventDate(ev.event_date) : 'No date'} · {ecfg.label}
                          </p>
                        </div>
                        {isSelected && (
                          <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-slate-100 p-1.5">
                  <a
                    href="/admin/event-settings"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                    </svg>
                    Manage Events
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
