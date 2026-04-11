'use client';

import { useEffect, useState } from 'react';
import { EventSelectorBar, type EventSummary } from '@/app/admin/_components/event-selector';
import { AdminHero, InlineStatus, MetricTile, SurfaceCard } from '@/app/admin/_components/admin-surface';

type RunnerMode = 'invites' | 'passes';

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

export default function LocalWhatsAppRunnerPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [mode, setMode] = useState<RunnerMode>('invites');
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => {
    if (!selectedEvent?.id) {
      setDownloadUrl('');
      return;
    }
    setDownloadUrl(`/api/local-runner/launcher?event_id=${encodeURIComponent(selectedEvent.id)}&mode=${mode}`);
  }, [selectedEvent?.id, mode]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50">
      <EventSelectorBar onChange={setSelectedEvent} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 lg:px-6 lg:py-8">
        <AdminHero
          eyebrow="Plug and Play WhatsApp Sender"
          title="Download one file. Double-click. Send bulk WhatsApp."
          description="No command line, no Supabase keys, no manual setup. The downloaded sender is already configured for the selected event."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Step 1" value="Choose" note="Select event and send type" tone="sky" variant="dark" />
            <MetricTile label="Step 2" value="Run" note="Download and double-click" tone="emerald" variant="dark" />
            <MetricTile label="Security" value="Event Lock" note="File works only for this event" tone="slate" variant="dark" />
          </div>
        </AdminHero>

        <SurfaceCard
          eyebrow="Operator Flow"
          title="Give this to your admin or manager"
          description="They only need to download this sender and double-click it. If WhatsApp asks for QR, they scan once from their phone."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <ModeButton
              active={mode === 'invites'}
              title="Send Invitations"
              note="Use this for contacts who have not received the invitation yet."
              onClick={() => setMode('invites')}
            />
            <ModeButton
              active={mode === 'passes'}
              title="Send Generated Passes"
              note="Use this after visitors confirm and passes are generated."
              onClick={() => setMode('passes')}
            />
          </div>

          <div className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Ready Sender</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  {selectedEvent ? selectedEvent.title : 'Select an event first'}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Downloaded file: {mode === 'passes' ? 'pass sending launcher' : 'invite sending launcher'}.
                </p>
              </div>

              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  download
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white shadow-lg transition hover:bg-emerald-700"
                >
                  Download WhatsApp Sender
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center justify-center rounded-2xl bg-slate-200 px-6 py-4 text-sm font-black text-slate-500"
                >
                  Select Event First
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <InlineStatus tone="emerald">Operator instruction: download the file, double-click it, scan WhatsApp QR if shown.</InlineStatus>
            <InlineStatus tone="amber">First-time PC only: if the runtime is missing, the file installs it automatically where Windows allows it.</InlineStatus>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
