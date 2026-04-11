'use client';

import { useEffect, useState } from 'react';
import { AdminHero, InlineStatus, MetricTile, SurfaceCard } from '@/app/admin/_components/admin-surface';

const DOWNLOAD_BASE = '/downloads/whatsapp-local-runner';

type AssignedEvent = {
  id: string;
  title: string;
  event_date: string;
  status: string;
  venue_name: string;
};

function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">{value}</pre>
    </div>
  );
}

function DownloadLink({ href, title, note }: { href: string; title: string; note: string }) {
  return (
    <a
      href={href}
      download
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <p className="text-sm font-bold text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">{note}</p>
    </a>
  );
}

export default function ManagerLocalWhatsAppPage() {
  const [events, setEvents] = useState<AssignedEvent[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [appUrl, setAppUrl] = useState('https://ticket.rimacle.com');
  const selected = events.find((event) => event.id === selectedId) ?? events[0] ?? null;
  const eventId = selected?.id || 'PASTE_EVENT_ID';
  const envText = [
    `APP_URL=${appUrl}`,
    'RUNNER_TOKEN=paste-token-from-admin',
    `EVENT_ID=${eventId}`,
    'MODE=invites',
    'MIN_DELAY=45',
    'MAX_DELAY=90',
    'BATCH_SIZE=15',
    'BATCH_BREAK=300',
    'COUNTRY_CODE=91',
  ].join('\n');

  useEffect(() => {
    if (typeof window !== 'undefined') setAppUrl(window.location.origin);

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
          eyebrow="Local WhatsApp Runner"
          title="Send assigned event invites from your local WhatsApp"
          description="Download the runner, paste the admin-provided token, select your assigned event, and run controlled WhatsApp Web batches from this PC."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Sender Type" value="WhatsApp Web" note="Uses your phone session" tone="emerald" variant="dark" />
            <MetricTile label="Access" value="Manager" note="Assigned events only" tone="sky" variant="dark" />
            <MetricTile label="Selected Event" value={selected ? selected.title : 'No event'} note={selected ? selected.id : 'Ask admin to assign event'} tone="slate" variant="dark" />
          </div>
        </AdminHero>

        <SurfaceCard eyebrow="Assigned Event" title="Choose event before copying config" description="Managers only see events assigned by the admin.">
          {events.length === 0 ? (
            <InlineStatus tone="amber">No event is assigned to this manager. Ask the admin to assign an event first.</InlineStatus>
          ) : (
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
        </SurfaceCard>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SurfaceCard eyebrow="Download" title="Runner files" description="Use the installer for the fastest setup, or download files manually.">
            <div className="space-y-3">
              <a
                href={`${DOWNLOAD_BASE}/install-whatsapp-runner.ps1`}
                download
                className="flex items-center justify-between gap-4 rounded-[24px] bg-slate-950 px-5 py-4 text-white shadow-lg transition hover:bg-slate-800"
              >
                <span>
                  <span className="block text-sm font-bold">Download Windows Installer</span>
                  <span className="mt-1 block text-sm text-slate-300">Downloads runner files into your user folder.</span>
                </span>
                <span className="rounded-xl bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]">PS1</span>
              </a>
              <div className="grid gap-3 sm:grid-cols-2">
                <DownloadLink href={`${DOWNLOAD_BASE}/runner.mjs`} title="runner.mjs" note="Main sender script." />
                <DownloadLink href={`${DOWNLOAD_BASE}/package.json`} title="package.json" note="Dependencies and commands." />
                <DownloadLink href={`${DOWNLOAD_BASE}/env.example`} title="env.example" note="Copy to .env and fill values." />
                <DownloadLink href={`${DOWNLOAD_BASE}/start-windows.bat`} title="start-windows.bat" note="Double-click launcher." />
              </div>
            </div>
          </SurfaceCard>

          <div className="space-y-6">
            <SurfaceCard eyebrow="Config" title="Copy this .env template" description="Paste this into the runner .env file after your admin gives you the token.">
              <CopyBox label=".env" value={envText} />
            </SurfaceCard>

            <SurfaceCard eyebrow="Use" title="Run commands" description="Use passes mode after attendee passes are generated.">
              <div className="grid gap-3">
                <CopyBox label="Send invites" value={`npm start -- --event-id ${eventId} --mode invites`} />
                <CopyBox label="Send generated passes" value={`npm start -- --event-id ${eventId} --mode passes`} />
                <CopyBox label="Test first" value={`npm start -- --event-id ${eventId} --mode invites --dry-run`} />
              </div>
            </SurfaceCard>
          </div>
        </div>
      </div>
    </div>
  );
}
