'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EventSelectorBar, type EventSummary } from '@/app/admin/_components/event-selector';
import { AdminHero, InlineStatus, MetricTile, SurfaceCard } from '@/app/admin/_components/admin-surface';
import type { BulkSendProgress } from '@/lib/wa-sender';

type WaStatus = 'idle' | 'disabled' | 'initializing' | 'qr_ready' | 'authenticated' | 'ready' | 'disconnected';
type WaProvider = 'web' | 'cloud_api';

interface WaState {
  status: WaStatus;
  qrDataUrl: string | null;
  reason?: string | null;
  provider?: WaProvider;
}

const STATUS_COPY: Record<WaStatus, string> = {
  idle: 'Not connected',
  disabled: 'Worker unavailable here',
  initializing: 'Starting WhatsApp Web...',
  qr_ready: 'Scan the QR code with your phone',
  authenticated: 'Authenticated, loading...',
  ready: 'Connected and ready',
  disconnected: 'Disconnected',
};

const DEFAULTS = { minDelay: 45, maxDelay: 90, batchSize: 15, batchBreak: 300 };

function fmtSeconds(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem > 0 ? `${minutes}m ${rem}s` : `${minutes}m`;
}

function Countdown({ nextSendAt }: { nextSendAt: number }) {
  const [seconds, setSeconds] = useState(Math.max(0, Math.ceil((nextSendAt - Date.now()) / 1000)));
  useEffect(() => {
    const id = setInterval(() => setSeconds(Math.max(0, Math.ceil((nextSendAt - Date.now()) / 1000))), 500);
    return () => clearInterval(id);
  }, [nextSendAt]);
  return <span>{fmtSeconds(seconds)}</span>;
}

export default function SendInvitesPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const eventId = selectedEvent?.id ?? null;
  const [waState, setWaState] = useState<WaState>({ status: 'idle', qrDataUrl: null });
  const [progress, setProgress] = useState<BulkSendProgress | null>(null);
  const [config, setConfig] = useState(DEFAULTS);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const cloudStopRef = useRef(false);

  function handleEventChange(ev: EventSummary | null) {
    setSelectedEvent(ev);
    setPendingCount(null);
  }

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/contacts?event_id=${eventId}&per_page=1&page=1&status_filter=uploaded`)
      .then((r) => r.json())
      .then((first) => {
        if (!first.success) return;
        fetch(`/api/contacts?event_id=${eventId}&per_page=1&page=1&status_filter=invited`)
          .then((r) => r.json())
          .then((second) => {
            const uploaded = first.data?.total || 0;
            const invited = second.success ? second.data?.total || 0 : 0;
            setPendingCount(uploaded + invited);
          });
      });
  }, [eventId]);

  const pollWaStatus = useCallback(() => {
    fetch('/api/whatsapp')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) return;
        setWaState(data.data);
        if (data.data?.status === 'disabled') setError(null);
      });
  }, []);

  const pollProgress = useCallback(() => {
    if (waState.provider === 'cloud_api') return;
    fetch('/api/whatsapp/progress')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProgress(data.data);
      });
  }, [waState.provider]);

  useEffect(() => {
    pollWaStatus();
    pollProgress();
    pollingRef.current = setInterval(() => {
      pollWaStatus();
      if (progress?.status === 'running') pollProgress();
    }, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollProgress, pollWaStatus, progress?.status]);

  useEffect(() => {
    if (progress?.status !== 'running') return;
    const id = setInterval(pollProgress, 2000);
    return () => clearInterval(id);
  }, [pollProgress, progress?.status]);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      const res = await fetch('/api/whatsapp', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        const message = data.error?.message || 'WhatsApp connection is unavailable on this server';
        if (data.error?.code === 'WHATSAPP_DISABLED') {
          setWaState({ status: 'disabled', qrDataUrl: null, reason: message });
        } else {
          setError(message);
        }
        return;
      }
      pollWaStatus();
    } catch {
      setError('Could not start WhatsApp connection');
    } finally {
      setConnecting(false);
    }
  }

  async function handleReconnect() {
    setError(null);
    setConnecting(true);
    try {
      await fetch('/api/whatsapp', { method: 'DELETE' });
      const res = await fetch('/api/whatsapp', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        const message = data.error?.message || 'WhatsApp connection is unavailable on this server';
        if (data.error?.code === 'WHATSAPP_DISABLED') {
          setWaState({ status: 'disabled', qrDataUrl: null, reason: message });
        } else {
          setError(message);
        }
        return;
      }
      pollWaStatus();
    } catch {
      setError('Could not restart WhatsApp connection');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setConnecting(true);
    await fetch('/api/whatsapp', { method: 'DELETE' });
    setWaState({ status: 'idle', qrDataUrl: null });
    setConnecting(false);
  }

  async function handleStartSend() {
    if (!eventId || !pendingCount) return;
    setError(null);
    if (waState.provider === 'cloud_api') {
      await runCloudCampaign();
      return;
    }
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
      const data = await res.json();
      if (!data.success) setError(data.error?.message || 'Failed to start sending');
      else pollProgress();
    } finally {
      setStarting(false);
    }
  }

  async function handleStop() {
    if (waState.provider === 'cloud_api') {
      cloudStopRef.current = true;
      setProgress((prev) => prev ? { ...prev, status: 'stopped', completedAt: new Date().toISOString(), nextSendAt: undefined } : prev);
      return;
    }
    await fetch('/api/whatsapp/send', { method: 'DELETE' });
    pollProgress();
  }

  function wait(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  function nextDelayMs(processedCount: number) {
    const isBatchEnd = processedCount > 0 && processedCount % config.batchSize === 0;
    return isBatchEnd
      ? config.batchBreak * 1000
      : (Math.floor(Math.random() * (config.maxDelay - config.minDelay + 1)) + config.minDelay) * 1000;
  }

  async function runCloudCampaign() {
    if (!eventId || !pendingCount || starting) return;

    cloudStopRef.current = false;
    setStarting(true);
    const startedAt = new Date().toISOString();
    const processedIds = new Set<string>();
    const errors: Array<{ mobile: string; reason: string }> = [];
    let sent = 0;
    let failed = 0;

    setProgress({
      status: 'running',
      total: pendingCount,
      sent: 0,
      failed: 0,
      currentIndex: 0,
      errors: [],
      startedAt,
    });

    try {
      while (!cloudStopRef.current && sent + failed < pendingCount) {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            limit: 1,
            skip_ids: Array.from(processedIds),
          }),
        });
        const data = await res.json();

        if (!data.success) {
          if (data.error?.code === 'NO_CONTACTS') break;
          throw new Error(data.error?.message || 'Failed to send invite batch');
        }

        const step = data.data;
        const processedContacts = Array.isArray(step.contacts) ? step.contacts : [];
        processedContacts.forEach((contact: { id?: string }) => {
          if (contact.id) processedIds.add(contact.id);
        });
        sent += Number(step.sent || 0);
        failed += Number(step.failed || 0);
        if (Array.isArray(step.errors)) {
          step.errors.forEach((item: { id?: string; mobile?: string; reason?: string }) => {
            if (item.id) processedIds.add(item.id);
            errors.push({ mobile: item.mobile || 'Unknown', reason: item.reason || 'Failed to send invite' });
          });
        }

        const processed = sent + failed;
        const isDone = cloudStopRef.current || processed >= pendingCount || Number(step.remaining || 0) <= 0;
        const nextSendAt = isDone ? undefined : Date.now() + nextDelayMs(processed);

        setProgress({
          status: isDone ? 'completed' : 'running',
          total: pendingCount,
          sent,
          failed,
          currentIndex: processed,
          errors: [...errors],
          startedAt,
          completedAt: isDone ? new Date().toISOString() : undefined,
          nextSendAt,
        });

        if (isDone) break;
        await wait(Math.max(1000, (nextSendAt || Date.now()) - Date.now()));
      }

      if (cloudStopRef.current) {
        setProgress((prev) => prev ? { ...prev, status: 'stopped', completedAt: new Date().toISOString(), nextSendAt: undefined } : prev);
      } else {
        setProgress((prev) => prev ? { ...prev, status: 'completed', completedAt: new Date().toISOString(), nextSendAt: undefined } : prev);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cloud campaign failed');
      setProgress((prev) => prev ? { ...prev, status: 'stopped', completedAt: new Date().toISOString(), nextSendAt: undefined } : prev);
    } finally {
      setStarting(false);
    }
  }

  function applyPreset(preset: 'safe' | 'balanced' | 'fast') {
    if (preset === 'safe') {
      setConfig({ minDelay: 60, maxDelay: 120, batchSize: 10, batchBreak: 420 });
      return;
    }
    if (preset === 'fast') {
      setConfig({ minDelay: 25, maxDelay: 45, batchSize: 20, batchBreak: 180 });
      return;
    }
    setConfig(DEFAULTS);
  }

  const isRunning = progress?.status === 'running';
  const isConnected = waState.status === 'ready';
  const isWaBlocked = waState.status === 'disabled';
  const isCloudProvider = waState.provider === 'cloud_api';
  const percent = progress && progress.total > 0 ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 0;
  const avgDelay = (config.minDelay + config.maxDelay) / 2;
  const estimatedSeconds = pendingCount != null ? Math.round((pendingCount * avgDelay) + ((Math.ceil(pendingCount / config.batchSize) - 1) * config.batchBreak)) : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <EventSelectorBar onChange={handleEventChange} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 lg:px-6 lg:py-8">
        <AdminHero
          eyebrow="Bulk Invite Sending"
          title={selectedEvent ? `WhatsApp send room for ${selectedEvent.title}` : 'Send WhatsApp event invites in batches'}
          description={selectedEvent ? (isCloudProvider ? 'Run Vercel-safe invite campaigns through Meta WhatsApp Cloud API. Keep this tab open while the browser drives each batch.' : 'Run invite campaigns from a single device session, slow the queue down when needed, and monitor live progress without leaving the admin panel.') : 'Select an event first. Then connect WhatsApp or verify Cloud API, choose a safe sending profile, and start the invite queue.'}
        >
          {selectedEvent ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Pending Contacts" value={pendingCount ?? '...'} note="Uploaded plus invited contacts not yet confirmed" tone="indigo" variant="dark" />
              <MetricTile label="Connection" value={isConnected ? (isCloudProvider ? 'Cloud API' : 'Ready') : isWaBlocked ? 'Blocked' : 'Offline'} note={STATUS_COPY[waState.status]} tone={isConnected ? 'emerald' : 'amber'} variant="dark" />
              <MetricTile label="Estimated Runtime" value={estimatedSeconds != null ? fmtSeconds(Math.max(estimatedSeconds, 0)) : '...'} note="Based on current delay and batch settings" tone="slate" variant="dark" />
              <MetricTile label="Progress" value={`${percent}%`} note="Current run completion rate" tone="sky" variant="dark" />
            </div>
          ) : null}
        </AdminHero>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <SurfaceCard eyebrow="Session" title={isCloudProvider ? 'WhatsApp Cloud API' : 'WhatsApp connection'} description={isCloudProvider ? 'This Vercel-safe mode sends through Meta Cloud API. No QR scan or VPS worker is required, but approved templates are recommended for campaigns.' : 'This session controls WhatsApp Web from your logged-in browser session. Keep the tab alive while sending.'}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <InlineStatus tone={isConnected ? 'emerald' : waState.status === 'qr_ready' ? 'amber' : isWaBlocked ? 'rose' : 'slate'}>{STATUS_COPY[waState.status]}</InlineStatus>
                  {isWaBlocked ? (
                    <div className="max-w-xl rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <p className="font-semibold">WhatsApp worker is not running on this runtime.</p>
                      <p className="mt-1">{waState.reason || 'Configure WhatsApp Cloud API credentials in Vercel environment variables.'}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Vercel mode: set WHATSAPP_PROVIDER=cloud_api and add the Meta phone number ID plus access token.</p>
                    </div>
                  ) : null}
                  {waState.status === 'qr_ready' && waState.qrDataUrl ? (
                    <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                      <img src={waState.qrDataUrl} alt="WhatsApp QR" className="h-56 w-56 max-w-full" />
                      <p className="mt-3 text-sm text-slate-500">Open WhatsApp on your phone, then go to Linked Devices and scan this code.</p>
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:flex">
                  {isCloudProvider ? (
                    <button onClick={pollWaStatus} disabled={connecting} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50">
                      Cloud API Ready
                    </button>
                  ) : isWaBlocked ? (
                    <button onClick={pollWaStatus} disabled={connecting} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                      Refresh Status
                    </button>
                  ) : waState.status === 'idle' || waState.status === 'disconnected' ? (
                    <button onClick={handleConnect} disabled={connecting} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                      {connecting ? 'Connecting...' : 'Connect WhatsApp'}
                    </button>
                  ) : (
                    <button onClick={handleReconnect} disabled={connecting} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                      {connecting ? 'Restarting...' : isConnected ? 'Reconnect WhatsApp' : 'Restart Connection'}
                    </button>
                  )}
                  {waState.status !== 'idle' && !isWaBlocked && (
                    <button onClick={handleDisconnect} disabled={connecting} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard eyebrow="Throttle" title="Sending profile" description="Use safer presets for large campaigns. The custom controls below let you tune runtime against WhatsApp risk.">
              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" onClick={() => applyPreset('safe')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-slate-300">
                  <p className="text-sm font-semibold text-slate-900">Safe</p>
                  <p className="mt-1 text-xs text-slate-500">Best for high-value live events</p>
                </button>
                <button type="button" onClick={() => applyPreset('balanced')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-slate-300">
                  <p className="text-sm font-semibold text-slate-900">Balanced</p>
                  <p className="mt-1 text-xs text-slate-500">Default day-to-day sending</p>
                </button>
                <button type="button" onClick={() => applyPreset('fast')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-slate-300">
                  <p className="text-sm font-semibold text-slate-900">Fast</p>
                  <p className="mt-1 text-xs text-slate-500">Use carefully on small lists</p>
                </button>
              </div>

              <div className={`mt-5 grid gap-4 sm:grid-cols-2 ${!isConnected ? 'pointer-events-none opacity-50' : ''}`}>
                <div><label className="input-label">Min delay (seconds)</label><input type="number" min={10} max={300} value={config.minDelay} onChange={(e) => setConfig((prev) => ({ ...prev, minDelay: Number(e.target.value) }))} className="input-field" /></div>
                <div><label className="input-label">Max delay (seconds)</label><input type="number" min={10} max={600} value={config.maxDelay} onChange={(e) => setConfig((prev) => ({ ...prev, maxDelay: Number(e.target.value) }))} className="input-field" /></div>
                <div><label className="input-label">Messages per batch</label><input type="number" min={1} max={50} value={config.batchSize} onChange={(e) => setConfig((prev) => ({ ...prev, batchSize: Number(e.target.value) }))} className="input-field" /></div>
                <div><label className="input-label">Pause between batches (seconds)</label><input type="number" min={60} max={1800} value={config.batchBreak} onChange={(e) => setConfig((prev) => ({ ...prev, batchBreak: Number(e.target.value) }))} className="input-field" /></div>
              </div>
            </SurfaceCard>
          </div>

          <div className="space-y-6">
            <SurfaceCard eyebrow="Queue" title="Start or stop the invite run" description="Only pending contacts are included. Confirmed contacts are excluded automatically.">
              <div className={`space-y-4 ${!isConnected ? 'pointer-events-none opacity-50' : ''}`}>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">{pendingCount != null ? `${pendingCount} contacts ready for invite sending` : 'Loading contact count...'}</p>
                  <p className="mt-1 text-sm text-slate-500">{isWaBlocked ? 'Configure Meta WhatsApp Cloud API in Vercel before starting a send run.' : isCloudProvider ? 'Cloud API sends one contact per Vercel request. Keep this tab open until the run completes.' : 'Keep delays at 45 seconds or above for a safer delivery rhythm.'}</p>
                </div>
                <div className="grid gap-2 sm:flex">
                  {isRunning ? (
                    <button onClick={handleStop} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
                      Stop Sending
                    </button>
                  ) : (
                    <button onClick={handleStartSend} disabled={starting || !pendingCount} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40">
                      {starting ? (isCloudProvider ? 'Sending...' : 'Starting...') : `Send to ${pendingCount ?? '...'} contacts`}
                    </button>
                  )}
                </div>
              </div>

              {progress && progress.status !== 'idle' ? (
                <div className="mt-5 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                      <span>{progress.sent + progress.failed} / {progress.total}</span>
                      <span>{progress.status === 'completed' ? 'Completed' : progress.status === 'stopped' ? 'Stopped' : 'Running'}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${progress.status === 'completed' ? 'bg-emerald-500' : progress.status === 'stopped' ? 'bg-amber-400' : 'bg-gradient-to-r from-emerald-500 to-cyan-500'}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricTile label="Sent" value={progress.sent} note="Successful deliveries" tone="emerald" />
                    <MetricTile label="Failed" value={progress.failed} note="Rows that need a retry" tone="rose" />
                    <MetricTile label="Remaining" value={progress.total - progress.sent - progress.failed} note="Left in the queue" tone="slate" />
                  </div>
                  {isRunning && progress.nextSendAt ? <InlineStatus tone="amber">Next message in <Countdown nextSendAt={progress.nextSendAt} /></InlineStatus> : null}
                  {progress.errors.length > 0 ? (
                    <details className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                      <summary className="cursor-pointer text-sm font-semibold text-rose-700">{progress.errors.length} failed messages</summary>
                      <div className="mt-3 space-y-2">
                        {progress.errors.map((item, index) => (
                          <div key={`${item.mobile}-${index}`} className="rounded-xl bg-white/70 px-3 py-2 text-sm text-rose-700">
                            <span className="font-mono">{item.mobile}</span>: {item.reason}
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </SurfaceCard>

            <SurfaceCard eyebrow="Safety" title="Operator checklist" description="Use these checks before every live send to avoid blocks and wasted invite volume.">
              <div className="space-y-3 text-sm text-slate-600">
                {[
                  isCloudProvider ? 'Use an approved Meta WhatsApp template for business-initiated campaign messages.' : 'Keep WhatsApp active on the phone and browser while the queue is running.',
                  'Use safe or balanced mode for larger invite lists.',
                  'Review your invite template before sending a large batch.',
                  'Keep this tab open until the run is complete or stopped manually.',
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      </div>
    </div>
  );
}
