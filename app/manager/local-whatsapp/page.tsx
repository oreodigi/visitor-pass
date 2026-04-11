'use client';

import { useEffect, useState } from 'react';
import { AdminHero, InlineStatus, MetricTile, SurfaceCard } from '@/app/admin/_components/admin-surface';

type RunnerMode = 'invites' | 'passes';
type AssignedEvent = {
  id: string;
  title: string;
  event_date: string;
  status: string;
  venue_name: string;
};

function ModeButton({
  active,
  title,
  note,
  onClick,
}: {
  active: boolean;
  title: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border p-4 text-left transition ${
        active
          ? 'border-slate-950 bg-slate-950 text-white shadow-lg'
          : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <span className="block text-base font-black">{title}</span>
      <span className={`mt-1 block text-sm leading-relaxed ${active ? 'text-slate-300' : 'text-slate-500'}`}>{note}</span>
    </button>
  );
}

export default function ManagerLocalWhatsAppPage() {
  const [events, setEvents] = useState<AssignedEvent[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<RunnerMode>('invites');
  const selected = events.find((event) => event.id === selectedId) ?? events[0] ?? null;
  const downloadUrl = selected
    ? `/api/local-runner/launcher?event_id=${encodeURIComponent(selected.id)}&mode=${mode}`
    : '';

  useEffect(() => {
    async function loadAssignments() {
      const res = await fetch('/api/manager/dashboard');
      const json = await res.json();
      const assigned = (json.success ? json.data?.assigned_events : []) || [];
      setEvents(assigned);
      if (assigned[0]?.id) setSelectedId(assigned[0].id);
    }

    loadAssignments().catch(() => setEvents([]));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 lg:px-6 lg:py-8">
        <AdminHero
          eyebrow="Plug and Play WhatsApp Sender"
          title="Download one file. Double-click. Send bulk WhatsApp."
          description="No commands and no setup screen. This file is already configured for your assigned event."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Step 1" value="Download" note="Sender is pre-configured" tone="sky" variant="dark" />
            <MetricTile label="Step 2" value="Double-click" note="Scan WhatsApp QR if shown" tone="emerald" variant="dark" />
            <MetricTile label="Access" value="Assigned" note="Only your assigned event" tone="slate" variant="dark" />
          </div>
        </AdminHero>

        <SurfaceCard
          eyebrow="Your Sender"
          title="Choose what you want to send"
          description="Pick invitations or generated passes, then download the sender file."
        >
          {events.length === 0 ? (
            <InlineStatus tone="amber">No event is assigned to you. Ask the admin to assign an event first.</InlineStatus>
          ) : (
            <div className="space-y-5">
              {events.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {events.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedId(event.id)}
                      className={`rounded-2xl border px-4 py-2 text-sm font-bold transition ${
                        selectedId === event.id
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <ModeButton
                  active={mode === 'invites'}
                  title="Send Invitations"
                  note="For contacts who still need the invitation link."
                  onClick={() => setMode('invites')}
                />
                <ModeButton
                  active={mode === 'passes'}
                  title="Send Generated Passes"
                  note="For confirmed visitors whose passes are ready."
                  onClick={() => setMode('passes')}
                />
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Ready Sender</p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">{selected?.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Download, double-click, scan WhatsApp QR if shown, and keep the window open.
                    </p>
                  </div>
                  <a
                    href={downloadUrl}
                    download
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white shadow-lg transition hover:bg-emerald-700"
                  >
                    Download WhatsApp Sender
                  </a>
                </div>
              </div>

              <InlineStatus tone="emerald">This is the only instruction needed for operators: download the file and double-click it.</InlineStatus>
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
