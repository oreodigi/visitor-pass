'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ScanStatus = 'scanning' | 'valid' | 'duplicate' | 'invalid' | 'error';
type ActiveTab = 'scan' | 'search' | 'list' | 'recent';
type ListFilter = 'pending' | 'checked_in';

interface ScanResult {
  status: ScanStatus;
  attendee?: {
    name: string | null;
    mobile: string;
    business_name: string | null;
    pass_number: string;
    seat_number: string | null;
    checked_in_at: string;
  };
  reason?: string;
}

interface EventInfo {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string;
  venue_contact_number: string | null;
}

interface Stats {
  total: number;
  checked_in: number;
  pending: number;
  today: number;
}

interface AttendeeRow {
  id: string;
  name: string | null;
  mobile: string;
  business_name: string | null;
  pass_number: string;
  seat_number: string | null;
  checked_in_at: string | null;
  qr_token: string | null;
}

interface CheckinLog {
  id: string;
  status: string;
  gate_name: string | null;
  created_at: string;
  attendees: {
    name: string | null;
    mobile: string;
    pass_number: string;
    seat_number: string | null;
  } | null;
}

// ─────────────────────────────────────────────────────────────
// Scanner result styles (semantic — keep high contrast)
// ─────────────────────────────────────────────────────────────

const RESULT_STYLE: Record<Exclude<ScanStatus, 'scanning' | 'error'>, {
  bg: string; text: string; sub: string; icon: React.ReactNode; label: string;
}> = {
  valid: {
    bg: 'bg-emerald-600',
    text: 'text-white',
    sub: 'text-emerald-100',
    label: 'Checked In ✓',
    icon: (
      <svg className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  duplicate: {
    bg: 'bg-amber-500',
    text: 'text-white',
    sub: 'text-amber-100',
    label: 'Already Checked In',
    icon: (
      <svg className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  invalid: {
    bg: 'bg-red-600',
    text: 'text-white',
    sub: 'text-red-100',
    label: 'Invalid Pass',
    icon: (
      <svg className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

// ─────────────────────────────────────────────────────────────
// Sound feedback
// ─────────────────────────────────────────────────────────────

function playTone(type: 'valid' | 'duplicate' | 'invalid') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'valid') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'duplicate') {
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
    }
  } catch { /* AudioContext not available */ }
}

// ─────────────────────────────────────────────────────────────
// QR Scanner
// ─────────────────────────────────────────────────────────────

function QrScannerView({ onScan, active }: { onScan: (text: string) => void; active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;
    let stopped = false;
    async function start() {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (stopped || !containerRef.current) return;
      const scanner = new Html5Qrcode(containerRef.current.id, { verbose: false });
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decoded) => { onScan(decoded); },
          () => {}
        );
      } catch (err) {
        if (!stopped) {
          const msg = err instanceof Error ? err.message : String(err);
          setCamError(msg.includes('permission') ? 'Camera permission denied' : `Camera error: ${msg}`);
        }
      }
    }
    start();
    return () => {
      stopped = true;
      const s = scannerRef.current as { stop?: () => Promise<void> } | null;
      s?.stop?.().catch(() => {});
      scannerRef.current = null;
    };
  }, [active, onScan]);

  if (camError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
          <svg className="h-8 w-8 text-white/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
        </div>
        <p className="text-sm text-white/80">{camError}</p>
      </div>
    );
  }

  return <div id="qr-scanner-container" ref={containerRef} className="w-full h-full" />;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function fmt12h(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function fmtDate(d: string) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); }
  catch { return d; }
}
function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────
// Bottom nav icons
// ─────────────────────────────────────────────────────────────

const NavIcons = {
  scan: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
    </svg>
  ),
  search: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  list: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  recent: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────
// Attendee row
// ─────────────────────────────────────────────────────────────

function AttendeeRowItem({
  a,
  onCheckin,
  checkinLoading,
}: {
  a: AttendeeRow;
  onCheckin?: (token: string) => void;
  checkinLoading?: boolean;
}) {
  const isIn = !!a.checked_in_at;
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0 active:bg-slate-50">
      <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'}`}>
        {(a.name || 'P')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-slate-900 truncate leading-tight">{a.name || 'Participant'}</p>
        {a.business_name && <p className="text-xs text-slate-400 truncate">{a.business_name}</p>}
        <div className="flex gap-2 mt-0.5">
          <span className="text-xs text-slate-500 font-mono">{a.mobile}</span>
          {a.seat_number && <span className="text-xs text-slate-400">· Seat {a.seat_number}</span>}
        </div>
        {isIn && a.checked_in_at && (
          <p className="text-xs text-emerald-600 font-medium mt-0.5">In at {fmtTime(a.checked_in_at)}</p>
        )}
      </div>
      <div className="shrink-0">
        {isIn ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        ) : onCheckin && a.qr_token ? (
          <button
            onClick={() => onCheckin(a.qr_token!)}
            disabled={checkinLoading}
            className="h-9 px-4 rounded-xl bg-brand-600 text-xs font-bold text-white active:bg-brand-700 disabled:opacity-40"
          >
            Check In
          </button>
        ) : (
          <span className="text-xs text-slate-400">Pending</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────

export default function StaffDashboard() {
  const [scanStatus, setScanStatus] = useState<ScanStatus>('scanning');
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [gateName] = useState('Main Gate');
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastScannedRef = useRef<string>('');

  const [activeTab, setActiveTab] = useState<ActiveTab>('scan');
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AttendeeRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [listFilter, setListFilter] = useState<ListFilter>('pending');
  const [listData, setListData] = useState<AttendeeRow[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [listTotalPages, setListTotalPages] = useState(1);

  const [recentLogs, setRecentLogs] = useState<CheckinLog[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const loadEventStats = useCallback(async () => {
    const res = await fetch('/api/staff/event');
    const d = await res.json();
    if (d.success) { setEvent(d.data.event); setStats(d.data.stats); }
  }, []);

  useEffect(() => { loadEventStats(); }, [loadEventStats]);

  const processToken = useCallback(async (token: string) => {
    if (processing || token === lastScannedRef.current) return;
    lastScannedRef.current = token;
    setProcessing(true);
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, gate_name: gateName }),
      });
      const d = await res.json();
      if (!d.success) {
        setScanStatus('error');
        setLastResult({ status: 'error', reason: d.error?.message });
        playTone('invalid');
      } else {
        const status = d.data.status as Exclude<ScanStatus, 'scanning' | 'error'>;
        setScanStatus(status);
        setLastResult({ status, attendee: d.data.attendee, reason: d.data.reason });
        setScanCount((c) => c + 1);
        playTone(status === 'valid' ? 'valid' : status === 'duplicate' ? 'duplicate' : 'invalid');
        if (status === 'valid') loadEventStats();
      }
    } catch {
      setScanStatus('error');
      setLastResult({ status: 'error', reason: 'Network error' });
      playTone('invalid');
    } finally {
      setProcessing(false);
    }
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setScanStatus('scanning');
      lastScannedRef.current = '';
    }, 3000);
  }, [processing, gateName, loadEventStats]);

  const handleCameraScan = useCallback((text: string) => {
    if (scanStatus !== 'scanning' || processing) return;
    processToken(text);
  }, [scanStatus, processing, processToken]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualToken.trim()) return;
    processToken(manualToken.trim());
    setManualToken('');
  }

  function resetNow() {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setScanStatus('scanning');
    lastScannedRef.current = '';
  }

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (searchQuery.length < 2 || !event) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/staff/search?event_id=${event.id}&q=${encodeURIComponent(searchQuery)}`);
        const d = await res.json();
        if (d.success) setSearchResults(d.data.attendees);
      } finally { setSearchLoading(false); }
    }, 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, event]);

  const loadList = useCallback(async (filter: ListFilter, page: number) => {
    if (!event) return;
    setListLoading(true);
    try {
      const res = await fetch(`/api/staff/attendees?event_id=${event.id}&status=${filter}&page=${page}`);
      const d = await res.json();
      if (d.success) { setListData(d.data.attendees); setListTotal(d.data.total); setListTotalPages(d.data.total_pages); }
    } finally { setListLoading(false); }
  }, [event]);

  const loadRecent = useCallback(async () => {
    if (!event) return;
    setRecentLoading(true);
    try {
      const res = await fetch(`/api/staff/recent-checkins?event_id=${event.id}`);
      const d = await res.json();
      if (d.success) setRecentLogs(d.data.logs);
    } finally { setRecentLoading(false); }
  }, [event]);

  useEffect(() => {
    if (!event) return;
    if (activeTab === 'list') { setListPage(1); loadList(listFilter, 1); }
    if (activeTab === 'recent') loadRecent();
    if (activeTab === 'search') setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [activeTab, event]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'list') loadList(listFilter, listPage);
  }, [listPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'list' && event) { setListPage(1); loadList(listFilter, 1); }
  }, [listFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const isScanning = scanStatus === 'scanning';
  const resultStyle = scanStatus !== 'scanning' && scanStatus !== 'error'
    ? RESULT_STYLE[scanStatus as Exclude<ScanStatus, 'scanning' | 'error'>]
    : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Stats header */}
      <div
        className="shrink-0 bg-gradient-to-r from-brand-700 to-violet-700 px-4 pt-2 pb-3 cursor-pointer"
        onClick={loadEventStats}
      >
        {event ? (
          <p className="text-[11px] font-medium text-brand-200 truncate mb-2">
            {event.title} · {fmtDate(event.event_date)} · {fmt12h(event.start_time)}
          </p>
        ) : (
          <div className="h-3 w-48 rounded bg-white/10 mb-2" />
        )}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total',   value: stats?.total,      color: 'text-white' },
            { label: 'In',      value: stats?.checked_in, color: 'text-emerald-300' },
            { label: 'Pending', value: stats?.pending,    color: 'text-amber-300' },
            { label: 'Today',   value: stats?.today,      color: 'text-sky-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-white/10 px-2 py-2 text-center">
              <div className={`text-2xl font-bold leading-none tabular-nums ${color}`}>
                {value ?? <span className="opacity-40">—</span>}
              </div>
              <div className="text-[10px] text-white/50 mt-0.5 uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 relative overflow-hidden bg-slate-100">

        {/* SCAN TAB */}
        <div className={`absolute inset-0 flex flex-col bg-slate-900 ${activeTab === 'scan' ? '' : 'hidden'}`}>
          <div className="flex-1 relative overflow-hidden">
            <QrScannerView onScan={handleCameraScan} active={activeTab === 'scan' && isScanning && !processing} />

            {/* Corner brackets */}
            {isScanning && !processing && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-64 w-64">
                  <span className="absolute top-0 left-0 h-8 w-8 border-t-4 border-l-4 border-brand-400 rounded-tl-lg" />
                  <span className="absolute top-0 right-0 h-8 w-8 border-t-4 border-r-4 border-brand-400 rounded-tr-lg" />
                  <span className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-brand-400 rounded-bl-lg" />
                  <span className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-brand-400 rounded-br-lg" />
                </div>
              </div>
            )}

            {/* Result overlay */}
            {!isScanning && resultStyle && (
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center px-6 text-center cursor-pointer ${resultStyle.bg}`}
                onClick={resetNow}
              >
                <div className="mb-4">{resultStyle.icon}</div>
                <h2 className={`text-2xl font-bold ${resultStyle.text}`}>{resultStyle.label}</h2>
                {lastResult?.attendee && (
                  <div className="mt-4 w-full max-w-xs rounded-2xl bg-black/20 px-5 py-4 space-y-1">
                    <p className={`text-lg font-bold ${resultStyle.text}`}>{lastResult.attendee.name || 'Participant'}</p>
                    {lastResult.attendee.business_name && (
                      <p className={`text-sm ${resultStyle.sub}`}>{lastResult.attendee.business_name}</p>
                    )}
                    <div className={`flex justify-center gap-4 text-sm font-mono pt-1 ${resultStyle.sub}`}>
                      <span>{lastResult.attendee.pass_number}</span>
                      {lastResult.attendee.seat_number && <span>Seat {lastResult.attendee.seat_number}</span>}
                    </div>
                    {scanStatus === 'duplicate' && lastResult.attendee.checked_in_at && (
                      <p className="text-sm text-white/70 pt-1">
                        Entered at {new Date(lastResult.attendee.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                )}
                {lastResult?.reason && !lastResult.attendee && (
                  <p className={`mt-2 text-base ${resultStyle.sub}`}>{lastResult.reason}</p>
                )}
                <p className="mt-6 text-sm text-white/50">Tap anywhere to scan next</p>
              </div>
            )}

            {/* Processing overlay */}
            {processing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                  <p className="text-sm text-white/80">Checking in…</p>
                </div>
              </div>
            )}
          </div>

          {/* Scanner bottom bar */}
          <div className="shrink-0 bg-slate-900 border-t border-white/10">
            {!manualMode ? (
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-xs text-white/40">
                  Session: <span className="text-white/70 font-semibold">{scanCount} scanned</span>
                </div>
                <button
                  onClick={() => setManualMode(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white active:bg-white/20"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  Manual Entry
                </button>
              </div>
            ) : (
              <form onSubmit={handleManualSubmit} className="flex items-center gap-2 px-3 py-3">
                <button type="button" onClick={() => setManualMode(false)} className="shrink-0 p-2 text-white/50 active:text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Enter pass token or URL…"
                  autoFocus
                  className="flex-1 h-11 rounded-xl bg-white/10 px-4 text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-brand-400/50 font-mono"
                />
                <button
                  type="submit"
                  disabled={processing || !manualToken.trim()}
                  className="h-11 px-5 rounded-xl bg-brand-600 text-sm font-bold text-white active:bg-brand-500 disabled:opacity-40"
                >
                  Go
                </button>
              </form>
            )}
          </div>
        </div>

        {/* SEARCH TAB */}
        <div className={`absolute inset-0 flex flex-col bg-slate-100 ${activeTab === 'search' ? '' : 'hidden'}`}>
          <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-3">
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, mobile, pass no., seat…"
                className="w-full h-11 rounded-xl bg-slate-100 pl-10 pr-4 text-[15px] text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-500/30"
                autoComplete="off"
              />
              {searchLoading && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {searchResults.length > 0 ? (
              <div className="bg-white">
                {searchResults.map((a) => (
                  <AttendeeRowItem key={a.id} a={a} onCheckin={!a.checked_in_at ? processToken : undefined} checkinLoading={processing} />
                ))}
              </div>
            ) : searchQuery.length >= 2 && !searchLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <svg className="h-10 w-10 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                </svg>
                <p className="text-sm">No attendees found</p>
              </div>
            ) : !searchQuery ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <svg className="h-10 w-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <p className="text-sm">Search by name, mobile or pass number</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* LIST TAB */}
        <div className={`absolute inset-0 flex flex-col bg-slate-100 ${activeTab === 'list' ? '' : 'hidden'}`}>
          <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
            <div className="flex rounded-xl bg-slate-100 p-0.5 gap-0.5">
              {(['pending', 'checked_in'] as ListFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setListFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    listFilter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {f === 'pending' ? `Pending (${stats?.pending ?? '…'})` : `Checked In (${stats?.checked_in ?? '…'})`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listLoading ? <Spinner /> : listData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <p className="text-sm">{listFilter === 'checked_in' ? 'No one checked in yet' : 'All attendees have checked in!'}</p>
              </div>
            ) : (
              <div className="bg-white">
                {listData.map((a) => (
                  <AttendeeRowItem
                    key={a.id}
                    a={a}
                    onCheckin={!a.checked_in_at && a.qr_token ? processToken : undefined}
                    checkinLoading={processing}
                  />
                ))}
                {listTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-4 border-t border-slate-100">
                    <span className="text-sm text-slate-400">{listTotal} total · page {listPage} of {listTotalPages}</span>
                    <div className="flex gap-2">
                      <button
                        disabled={listPage <= 1}
                        onClick={() => setListPage((p) => p - 1)}
                        className="h-9 px-4 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 disabled:opacity-30 active:bg-slate-200"
                      >
                        Prev
                      </button>
                      <button
                        disabled={listPage >= listTotalPages}
                        onClick={() => setListPage((p) => p + 1)}
                        className="h-9 px-4 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 disabled:opacity-30 active:bg-slate-200"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RECENT TAB */}
        <div className={`absolute inset-0 flex flex-col bg-slate-100 ${activeTab === 'recent' ? '' : 'hidden'}`}>
          <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Recent Check-ins</p>
            <button onClick={loadRecent} className="text-sm text-brand-600 font-medium active:opacity-60">
              Refresh
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {recentLoading ? <Spinner /> : recentLogs.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-sm text-slate-400">No check-ins recorded yet</p>
              </div>
            ) : (
              <div className="bg-white">
                {recentLogs.map((log) => {
                  const isNew = log.status === 'valid';
                  return (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0">
                      <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full ${isNew ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                        {isNew ? (
                          <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-slate-900 truncate">{log.attendees?.name || 'Participant'}</p>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-xs text-slate-500 font-mono">{log.attendees?.mobile}</span>
                          {log.attendees?.pass_number && <span className="text-xs text-slate-400">{log.attendees.pass_number}</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`text-[11px] font-bold uppercase tracking-wide ${isNew ? 'text-emerald-600' : 'text-amber-500'}`}>
                          {isNew ? 'New' : 'Dup'}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">{fmtTime(log.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <nav
        className="shrink-0 bg-white border-t border-slate-200 grid grid-cols-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {([
          { id: 'scan' as ActiveTab,   label: 'Scan',      icon: NavIcons.scan },
          { id: 'search' as ActiveTab, label: 'Search',    icon: NavIcons.search },
          { id: 'list' as ActiveTab,   label: 'Attendees', icon: NavIcons.list },
          { id: 'recent' as ActiveTab, label: 'Recent',    icon: NavIcons.recent },
        ]).map(({ id, label, icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                isActive ? 'text-brand-600' : 'text-slate-400 active:text-slate-600'
              }`}
            >
              <div className={`relative transition-transform ${isActive ? 'scale-110' : ''}`}>
                {icon}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-600" />
                )}
              </div>
              <span className={`text-[10px] font-medium mt-0.5 ${isActive ? 'text-brand-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
