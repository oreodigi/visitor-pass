'use client';

import { useEffect, useState } from 'react';
import { EventSelectorBar, type EventSummary } from '@/app/admin/_components/event-selector';
import { AdminHero, InlineStatus, MetricTile, SurfaceCard } from '@/app/admin/_components/admin-surface';

const DOWNLOAD_BASE = '/downloads/whatsapp-local-runner';

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

export default function LocalWhatsAppRunnerPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [appUrl, setAppUrl] = useState('https://ticket.rimacle.com');

  useEffect(() => {
    if (typeof window !== 'undefined') setAppUrl(window.location.origin);
  }, []);

  const eventId = selectedEvent?.id || 'PASTE_EVENT_ID';
  const envText = [
    `APP_URL=${appUrl}`,
    'RUNNER_TOKEN=paste-runner-token-here',
    `EVENT_ID=${eventId}`,
    'MODE=invites',
    'MIN_DELAY=45',
    'MAX_DELAY=90',
    'BATCH_SIZE=15',
    'BATCH_BREAK=300',
    'COUNTRY_CODE=91',
  ].join('\n');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50">
      <EventSelectorBar onChange={setSelectedEvent} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 lg:px-6 lg:py-8">
        <AdminHero
          eyebrow="Local WhatsApp Runner"
          title="Downloadable WhatsApp Web sender for admins and managers"
          description="Install this on any local Windows PC, scan WhatsApp Web once, and send event invites or generated passes in controlled batches without exposing Supabase keys."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Sender Type" value="WhatsApp Web" note="Uses the user's linked phone session" tone="emerald" variant="dark" />
            <MetricTile label="Deployment" value="Local PC" note="Best for Vercel/serverless apps" tone="sky" variant="dark" />
            <MetricTile label="Selected Event" value={selectedEvent ? selectedEvent.title : 'Choose event'} note={selectedEvent ? selectedEvent.id : 'Event ID fills below'} tone="slate" variant="dark" />
          </div>
        </AdminHero>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <SurfaceCard eyebrow="Download" title="Runner files" description="Fastest install: download the PowerShell installer. Manual install files are also available below.">
              <div className="space-y-3">
                <a
                  href={`${DOWNLOAD_BASE}/install-whatsapp-runner.ps1`}
                  download
                  className="flex items-center justify-between gap-4 rounded-[24px] bg-slate-950 px-5 py-4 text-white shadow-lg transition hover:bg-slate-800"
                >
                  <span>
                    <span className="block text-sm font-bold">Download Windows Installer</span>
                    <span className="mt-1 block text-sm text-slate-300">Creates a RimacleWhatsAppRunner folder and downloads all files.</span>
                  </span>
                  <span className="rounded-xl bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]">PS1</span>
                </a>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DownloadLink href={`${DOWNLOAD_BASE}/runner.mjs`} title="runner.mjs" note="Main WhatsApp Web sender script." />
                  <DownloadLink href={`${DOWNLOAD_BASE}/package.json`} title="package.json" note="Dependency list and start commands." />
                  <DownloadLink href={`${DOWNLOAD_BASE}/env.example`} title="env.example" note="Copy to .env and fill app URL/token/event." />
                  <DownloadLink href={`${DOWNLOAD_BASE}/start-windows.bat`} title="start-windows.bat" note="Double-click launcher for Windows users." />
                  <DownloadLink href={`${DOWNLOAD_BASE}/README.md`} title="README.md" note="Offline instructions for the operator." />
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard eyebrow="Security" title="Runner token setup" description="Do not share the Supabase service role key. Use one runner token in the app environment instead.">
              <div className="space-y-3">
                <InlineStatus tone="amber">Set `WHATSAPP_RUNNER_TOKEN` in Vercel and local `.env.local`, then redeploy.</InlineStatus>
                <CopyBox
                  label="Generate token"
                  value={'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"'}
                />
              </div>
            </SurfaceCard>
          </div>

          <div className="space-y-6">
            <SurfaceCard eyebrow="Operator Steps" title="How managers use it" description="These steps are enough for a non-technical operator after Node.js is installed.">
              <div className="space-y-3">
                {[
                  'Install Node.js 20 LTS once on the local PC.',
                  'Download the Windows installer from this page and run it with PowerShell.',
                  'Open the generated .env file and paste APP_URL, RUNNER_TOKEN, and EVENT_ID.',
                  'Double-click start-windows.bat.',
                  'Scan the generated WhatsApp QR from whatsapp-qr.html.',
                  'Keep the window open until the batch completes.',
                ].map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">{index + 1}</div>
                    <p className="text-sm leading-relaxed text-slate-600">{step}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard eyebrow="Config" title="Copy this .env template" description="The selected event ID is inserted automatically after choosing an event from the top bar.">
              <CopyBox label=".env" value={envText} />
            </SurfaceCard>

            <SurfaceCard eyebrow="Commands" title="Manual commands" description="Use these if the operator is comfortable with Command Prompt or Terminal.">
              <div className="grid gap-3">
                <CopyBox label="Send invites" value={`npm start -- --event-id ${eventId} --mode invites`} />
                <CopyBox label="Send generated passes" value={`npm start -- --event-id ${eventId} --mode passes`} />
                <CopyBox label="Dry run first" value={`npm start -- --event-id ${eventId} --mode passes --dry-run`} />
              </div>
            </SurfaceCard>
          </div>
        </div>
      </div>
    </div>
  );
}
