'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { EventSelectorBar, type EventSummary } from '@/app/admin/_components/event-selector';
import type { BulkSendProgress } from '@/lib/wa-sender';

type WaStatus = 'idle' | 'initializing' | 'qr_ready' | 'authenticated' | 'ready' | 'disconnected';

interface WaState {
  status: WaStatus;
  qrDataUrl: string | null;
}

const STATUS_COPY: Record<WaStatus, string> = {
  idle: 'Not connected',
  initializing: 'Starting WhatsApp Web…',
  qr_ready: 'Scan the QR code with your phone',
  authenticated: 'Authenticated — loading…',
  ready: 'Connected & ready',
  disconnected: 'Disconnected',
};

const DEFAULTS = {
  minDelay: 45,
  maxDelay: 90,
  batchSize: 15,
  batchBreak: 300,
};

function fmtSeconds(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function Countdown({ nextSendAt }: { nextSendAt: number }) {
  const [secs, setSecs] = useState(Math.max(0, Math.ceil((nextSendAt - Date.now()) / 1000)));
  useEffect(() => {
    const id = setInterval(() => setSecs(Math.max(0, Math.ceil((nextSendAt - Date.now()) / 1000))), 500);
    return () => clearInterval(id);
  }, [nextSendAt]);
  return <span>{fmtSeconds(secs)}</span>;
}

export default function SendInvitesPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const eventId = selectedEvent?.id ?? null;
  const [waState, setWaState] = useState<WaState>({ status: 'idle', qrDataUrl: null });
  const [progress, setProgress] = useState<BulkSendProgress | null>(null);
  const [config, setConfig] = useState(DEFAULTS);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  function handleEventChange(ev: EventSummary | null) {
    setSelectedEvent(ev);
    setPendingCount(null);
  }

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/contacts?event_id=${eventId}&per_page=1&page=1&status_filter=uploaded`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          fetch(`/api/contacts?event_id=${eventId}&per_page=1&page=1&status_filter=invited`)
            .then((r2) => r2.json())
            .then((d2) => {
              const uploaded = d.data?.total || 0;
              const invited = d2.success ? (d2.data?.total || 0) : 0;
              setPendingCount(uploaded + invited);
            });
        }
      });
  }, [eventId]);

  const pollWaStatus = useCallback(() => {
    fetch('/api/whatsapp').then((r) => r.json()).then((d) => { if (d.success) setWaState(d.data); });
  }, []);

  const pollProgress = useCallback(() => {
    fetch('/api/whatsapp/progress').then((r) => r.json()).then((d) => { if (d.success) setProgress(d.data); });
  }, []);

  useEffect(() => {
    pollWaStatus();
    pollProgress();
    pollingRef.current = setInterval(() => {
      pollWaStatus();
      if (progress?.status === 'running') pollProgress();
    }, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [pollWaStatus, pollProgress, progress?.status]);

  useEffect(() => {
    if (progress?.status !== 'running') return;
    const id = setInterval(pollProgress, 2000);
    return () => clearInterval(id);
  }, [progress?.status, pollProgress]);

  async function handleConnect() {
    setError(null);
    await fetch('/api/whatsapp', { method: 'POST' });
    pollWaStatus();
  }

  async function handleDisconnect() {
    await fetch('/api/whatsapp', { method: 'DELETE' });
    setWaState({ status: 'idle', qrDataUrl: null });
  }

  async function handleStartSend() {
    if (!eventId || !pendingCount) return;
    setError(null);
    setStarting(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          min_delay_ms: config.minDelay * 1000,
          max_delay_ms: config.maxDelay * 1000,
          batch_size: config.batchSize,
          batch_break_ms: config.batchBreak * 1000,
        }),
      });
      const d = await res.json();
      if (!d.success) setError(d.error?.message || 'Failed to start');
      else pollProgress();
    } finally {
      setStarting(false);
    }
  }

  async function handleStop() {
    await fetch('/api/whatsapp/send', { method: 'DELETE' });
    pollProgress();
  }

  const isRunning = progress?.status === 'running';
  const isConnected = waState.status === 'ready';
  const pct = progress && progress.total > 0
    ? Math.round(((progress.sent + progress.failed) / progress.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <EventSelectorBar onChange={handleEventChange} />
    <div className="mx-auto w-full max-w-2xl px-4 py-5 space-y-6 lg:py-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Bulk Send Invites</h1>
        <p className="mt-1 text-sm text-slate-500">
          Send WhatsApp invitations automatically with safe rate limiting to avoid blocks.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {/* Step 1: Connect WhatsApp */}
      <div className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">1</span>
              <h2 className="text-sm font-semibold text-slate-900">Connect WhatsApp</h2>
            </div>
            <p className="text-xs text-slate-500 ml-7">{STATUS_COPY[waState.status]}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${
              isConnected ? 'bg-emerald-500' :
              ['qr_ready', 'initializing', 'authenticated'].includes(waState.status) ? 'bg-amber-400 animate-pulse' :
              'bg-slate-300'
            }`} />
            <span className="text-xs font-medium text-slate-600">
              {isConnected ? 'Connected' :
               waState.status === 'qr_ready' ? 'Awaiting scan' :
               ['initializing', 'authenticated'].includes(waState.status) ? 'Connecting…' :
               'Disconnected'}
            </span>
          </div>
        </div>

        {waState.status === 'qr_ready' && waState.qrDataUrl && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <img src={waState.qrDataUrl} alt="WhatsApp QR" className="h-52 w-52" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-700">Open WhatsApp on your phone</p>
              <p className="text-xs text-slate-400">Settings → Linked Devices → Link a Device</p>
            </div>
          </div>
        )}

        {['initializing', 'authenticated'].includes(waState.status) && (
          <div className="mt-4 flex items-center gap-2.5 text-sm text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 shrink-0" />
            <span>{waState.status === 'initializing' ? 'Starting browser — this takes 15–30 seconds…' : 'Authenticating…'}</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-2 sm:flex">
          {(waState.status === 'idle' || waState.status === 'disconnected') ? (
            <button onClick={handleConnect} className="btn-primary text-sm">
              Connect WhatsApp
            </button>
          ) : isConnected ? (
            <button
              onClick={handleDisconnect}
              className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Disconnect
            </button>
          ) : null}
        </div>
      </div>

      {/* Step 2: Rate limit config */}
      <div className={`card p-5 transition-opacity ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2 mb-4">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">2</span>
          <h2 className="text-sm font-semibold text-slate-900">Rate Limit Settings</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="input-label">Min delay (seconds)</label>
            <input
              type="number" min={10} max={300} value={config.minDelay}
              onChange={(e) => setConfig((c) => ({ ...c, minDelay: Number(e.target.value) }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="input-label">Max delay (seconds)</label>
            <input
              type="number" min={10} max={600} value={config.maxDelay}
              onChange={(e) => setConfig((c) => ({ ...c, maxDelay: Number(e.target.value) }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="input-label">Messages per batch</label>
            <input
              type="number" min={1} max={50} value={config.batchSize}
              onChange={(e) => setConfig((c) => ({ ...c, batchSize: Number(e.target.value) }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="input-label">Pause between batches (seconds)</label>
            <input
              type="number" min={60} max={1800} value={config.batchBreak}
              onChange={(e) => setConfig((c) => ({ ...c, batchBreak: Number(e.target.value) }))}
              className="input-field"
            />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
          <strong>Estimated time</strong> for {pendingCount ?? '?'} contacts:{' '}
          {pendingCount != null ? (() => {
            const avgDelay = (config.minDelay + config.maxDelay) / 2;
            const batches = Math.ceil(pendingCount / config.batchSize);
            const totalSecs = (pendingCount * avgDelay) + ((batches - 1) * config.batchBreak);
            return fmtSeconds(Math.round(totalSecs));
          })() : '…'}
          {' '}· Keep delays at 45s+ to stay safe.
        </div>
      </div>

      {/* Step 3: Send */}
      <div className={`card p-5 transition-opacity ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">3</span>
              <h2 className="text-sm font-semibold text-slate-900">Send Invites</h2>
            </div>
            <p className="text-xs text-slate-500 ml-7">
              {pendingCount != null
                ? `${pendingCount} contacts pending (uploaded + invited, not yet confirmed)`
                : 'Loading…'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 shrink-0 sm:flex">
            {isRunning ? (
              <button
                onClick={handleStop}
                className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleStartSend}
                disabled={starting || !pendingCount || progress?.status === 'running'}
                className="btn-primary text-sm disabled:opacity-40"
              >
                {starting ? 'Starting…' : `Send to ${pendingCount ?? '…'} contacts`}
              </button>
            )}
          </div>
        </div>

        {progress && progress.status !== 'idle' && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>{progress.sent + progress.failed} / {progress.total}</span>
                <span className={
                  progress.status === 'completed' ? 'text-emerald-700 font-semibold' :
                  progress.status === 'stopped' ? 'text-amber-600 font-semibold' :
                  'text-slate-500'
                }>
                  {progress.status === 'running' ? 'Sending…' :
                   progress.status === 'completed' ? 'Completed' :
                   progress.status === 'stopped' ? 'Stopped' : ''}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress.status === 'completed' ? 'bg-emerald-500' :
                    progress.status === 'stopped' ? 'bg-amber-400' :
                    'bg-gradient-to-r from-brand-500 to-violet-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                <div className="text-xl font-bold text-emerald-700 tabular-nums">{progress.sent}</div>
                <div className="text-[10px] text-emerald-600 uppercase tracking-wide mt-0.5">Sent</div>
              </div>
              <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
                <div className="text-xl font-bold text-red-600 tabular-nums">{progress.failed}</div>
                <div className="text-[10px] text-red-500 uppercase tracking-wide mt-0.5">Failed</div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <div className="text-xl font-bold text-slate-700 tabular-nums">{progress.total - progress.sent - progress.failed}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Remaining</div>
              </div>
            </div>

            {isRunning && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {progress.nextSendAt ? (
                  <>
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>Next message in <strong className="text-slate-700"><Countdown nextSendAt={progress.nextSendAt} /></strong></span>
                  </>
                ) : progress.currentMobile ? (
                  <>
                    <div className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                    <span>Sending to <strong className="text-slate-700 font-mono">{progress.currentMobile}</strong></span>
                  </>
                ) : null}
              </div>
            )}

            {progress.errors.length > 0 && (
              <details>
                <summary className="text-xs text-red-600 cursor-pointer select-none">
                  {progress.errors.length} failed — tap to see
                </summary>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-2 space-y-1">
                  {progress.errors.map((e, i) => (
                    <div key={i} className="flex gap-2 text-xs text-red-700 font-mono">
                      <span className="text-red-400">{e.mobile}</span>
                      <span>{e.reason}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500 space-y-1.5">
        <p><strong className="text-slate-700">How this works:</strong> This browser controls WhatsApp Web on your behalf. Messages appear as if sent from your phone number — no API needed.</p>
        <p><strong className="text-slate-700">Stay safe:</strong> Keep delays at 45s+ and batches at 15 or fewer. Sending too fast can trigger WhatsApp restrictions.</p>
        <p><strong className="text-slate-700">Session persists</strong> across page refreshes — you only need to scan the QR once until you disconnect.</p>
      </div>
    </div>
    </div>
  );
}
