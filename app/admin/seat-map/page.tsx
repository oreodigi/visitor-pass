'use client';

import { useState, useEffect, useCallback } from 'react';
import { EventSelectorBar, type EventSummary } from '@/app/admin/_components/event-selector';

// ── Types ─────────────────────────────────────────────────

interface SeatRow {
  id: string; // local React key only
  label: string;
  start_from: number;
  count: number;
  category: 'Gold' | 'Silver' | 'Platinum';
  aisle_after: number | null;
}

interface SeatMapConfig {
  rows: Array<Omit<SeatRow, 'id'>>;
  blocked: string[];
}

type SeatState = 'available' | 'blocked' | 'occupied';

// ── Helpers ───────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2);
}

function getNextLabel(rows: SeatRow[]): string {
  // Find the last used letter-based label and increment
  const letterLabels = rows
    .map((r) => r.label)
    .filter((l) => /^[A-Z]$/.test(l))
    .sort();
  if (letterLabels.length === 0) return 'A';
  const last = letterLabels[letterLabels.length - 1];
  const next = String.fromCharCode(last.charCodeAt(0) + 1);
  return next <= 'Z' ? next : 'A';
}

/** Seat end number (inclusive) */
function rowEnd(row: SeatRow): number {
  return row.start_from + row.count - 1;
}

const CAT_COLORS: Record<string, { seat: string; badge: string }> = {
  Gold: {
    seat: 'bg-amber-50 border-amber-400 text-amber-800 hover:bg-amber-100 hover:border-amber-500',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  Silver: {
    seat: 'bg-emerald-50 border-emerald-400 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  Platinum: {
    seat: 'bg-violet-50 border-violet-400 text-violet-800 hover:bg-violet-100 hover:border-violet-500',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
  },
};

// ── Row Config Item ───────────────────────────────────────

function RowConfigItem({
  row,
  isFirst,
  isLast,
  onChange,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  row: SeatRow;
  isFirst: boolean;
  isLast: boolean;
  onChange: (field: keyof SeatRow, val: string | number | null) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const inp =
    'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors';
  const badge = `text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${CAT_COLORS[row.category]?.badge ?? 'bg-slate-100 text-slate-600 border-slate-200'}`;

  const end = rowEnd(row);

  function handleFromChange(val: string) {
    const from = Math.max(1, parseInt(val) || 1);
    onChange('start_from', from);
    // Keep count; end shifts automatically
  }

  function handleToChange(val: string) {
    const to = parseInt(val) || row.start_from;
    const newCount = Math.max(1, to - row.start_from + 1);
    onChange('count', newCount);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
      {/* Row 1: move + label + category + actions */}
      <div className="flex items-center gap-2">
        {/* Move up/down */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-20 transition-colors"
            title="Move up"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-20 transition-colors"
            title="Move down"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* Row label */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <label className="text-[10px] font-medium text-slate-500">Row</label>
          <input
            type="text"
            value={row.label}
            onChange={(e) => onChange('label', e.target.value.toUpperCase().slice(0, 2))}
            className={`${inp} w-12 text-center font-bold uppercase`}
            maxLength={2}
          />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="text-[10px] font-medium text-slate-500">Category</label>
          <select
            value={row.category}
            onChange={(e) => onChange('category', e.target.value)}
            className={inp}
          >
            <option>Gold</option>
            <option>Silver</option>
            <option>Platinum</option>
          </select>
        </div>

        {/* Duplicate */}
        <button
          onClick={onDuplicate}
          className="mt-4 rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
          title="Duplicate row"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="mt-4 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Delete row"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>

      {/* Row 2: From / To seat numbers + Aisle */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
        {/* From */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-medium text-slate-500">From seat</label>
          <input
            type="number"
            value={row.start_from}
            min={1}
            onChange={(e) => handleFromChange(e.target.value)}
            className={`${inp} w-20`}
          />
        </div>

        <span className="text-slate-400 text-sm mb-1.5">→</span>

        {/* To */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-medium text-slate-500">To seat</label>
          <input
            type="number"
            value={end}
            min={row.start_from}
            onChange={(e) => handleToChange(e.target.value)}
            className={`${inp} w-20`}
          />
        </div>

        {/* Count badge */}
        <div className="col-span-2 mb-1.5 sm:col-span-1">
          <span className="text-xs text-slate-500 bg-slate-100 rounded-md px-2 py-1 font-mono">
            {row.count} seat{row.count !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Aisle */}
        <div className="flex flex-col gap-0.5 sm:ml-auto">
          <label className="text-[10px] font-medium text-slate-500">Aisle after</label>
          <input
            type="number"
            value={row.aisle_after ?? ''}
            min={row.start_from}
            max={end - 1}
            placeholder="none"
            onChange={(e) => {
              const v = e.target.value === '' ? null : parseInt(e.target.value);
              onChange('aisle_after', v && v >= row.start_from && v < end ? v : null);
            }}
            className={`${inp} w-20`}
          />
        </div>

        {/* Category badge */}
        <div className="mb-1.5 shrink-0">
          <span className={badge}>{row.category}</span>
        </div>
      </div>
    </div>
  );
}

// ── Seat Row Visual ───────────────────────────────────────

function SeatRowViz({
  row,
  blocked,
  occupied,
  onToggle,
}: {
  row: SeatRow;
  blocked: Set<string>;
  occupied: Set<string>;
  onToggle: (seatId: string) => void;
}) {
  const colors = CAT_COLORS[row.category] ?? CAT_COLORS.Silver;
  const seats: JSX.Element[] = [];
  const end = rowEnd(row);

  for (let i = row.start_from; i <= end; i++) {
    const seatId = `${row.label}-${i}`;
    const state: SeatState = occupied.has(seatId)
      ? 'occupied'
      : blocked.has(seatId)
        ? 'blocked'
        : 'available';

    let cls = '';
    let title = seatId;
    if (state === 'occupied') {
      cls = 'bg-slate-700 border-slate-800 text-white cursor-not-allowed opacity-90';
      title += ' (occupied)';
    } else if (state === 'blocked') {
      cls = 'bg-slate-200 border-slate-300 text-slate-400 cursor-pointer hover:bg-slate-300';
      title += ' (blocked — click to unblock)';
    } else {
      cls = `${colors.seat} cursor-pointer`;
      title += ' (click to block)';
    }

    // Aisle gap before this seat
    if (row.aisle_after && i === row.aisle_after + 1) {
      seats.push(<div key={`aisle-${i}`} className="w-5 shrink-0" aria-hidden="true" />);
    }

    seats.push(
      <button
        key={seatId}
        title={title}
        onClick={() => state !== 'occupied' && onToggle(seatId)}
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded border text-[10px] font-mono font-semibold transition-all duration-100 ${cls}`}
      >
        {state === 'blocked' ? (
          <span className="text-slate-400 font-bold text-[11px]">✕</span>
        ) : state === 'occupied' ? (
          <svg className="h-3 w-3 text-white/70" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        ) : (
          <span className="leading-none">{i}</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* Row label */}
      <div className="w-8 shrink-0 text-center">
        <span className="text-xs font-bold text-slate-600">{row.label}</span>
      </div>
      {/* Seats */}
      <div className="flex items-center gap-1 flex-wrap">
        {seats}
      </div>
      {/* Seat range hint */}
      <div className="shrink-0 ml-1">
        <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
          {row.start_from}–{end}
        </span>
      </div>
    </div>
  );
}

// ── Legend Item ───────────────────────────────────────────

function LegendItem({ cls, label }: { cls: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-5 w-5 rounded border ${cls}`} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────

export default function SeatMapPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const eventId = selectedEvent?.id ?? null;
  const [rows, setRows] = useState<SeatRow[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [occupied, setOccupied] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSeatMap = useCallback(async (id: string) => {
    setLoading(true);
    setRows([]);
    setBlocked(new Set());
    setOccupied(new Set());
    try {
      const smRes = await fetch(`/api/events/seat-map?event_id=${id}`);
      const smData = await smRes.json();
      if (smData.success) {
        const config = smData.data.seat_map_config;
        if (config?.rows?.length) {
          setRows(config.rows.map((r: Omit<SeatRow, 'id'>) => ({ ...r, start_from: r.start_from ?? 1, id: uid() })));
          setBlocked(new Set(config.blocked || []));
        }
        setOccupied(new Set((smData.data.occupied || []) as string[]));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleEventChange(ev: EventSummary | null) {
    setSelectedEvent(ev);
    setMessage(null);
    if (ev) loadSeatMap(ev.id);
    else { setRows([]); setBlocked(new Set()); setOccupied(new Set()); }
  }

  // ── Stats ──────────────────────────────────────────────
  const totalSeats = rows.reduce((s, r) => s + r.count, 0);
  const blockedCount = blocked.size;
  const occupiedCount = occupied.size;
  const availableCount = Math.max(0, totalSeats - blockedCount - occupiedCount);

  // ── Row management ─────────────────────────────────────

  function addRow() {
    const label = getNextLabel(rows);
    // Start where the last row of this label ends, or at 1
    const lastEnd = rows.filter((r) => r.label === label).reduce((max, r) => Math.max(max, rowEnd(r)), 0);
    setRows((prev) => [
      ...prev,
      { id: uid(), label, start_from: lastEnd + 1 || 1, count: 10, category: 'Silver', aisle_after: null },
    ]);
  }

  function duplicateRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const newRow: SeatRow = {
      ...row,
      id: uid(),
      start_from: rowEnd(row) + 1, // continue after current row's last seat
    };
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  }

  function updateRow(id: string, field: keyof SeatRow, value: string | number | null) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function deleteRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    // Collect the exact seat IDs belonging to this row instance
    const rowSeats = new Set<string>();
    for (let i = row.start_from; i <= rowEnd(row); i++) rowSeats.add(`${row.label}-${i}`);
    setRows((prev) => prev.filter((r) => r.id !== id));
    setBlocked((prev) => {
      const n = new Set(prev);
      for (const s of rowSeats) n.delete(s);
      return n;
    });
  }

  function moveRow(id: string, dir: 'up' | 'down') {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;
      const next = dir === 'up' ? idx - 1 : idx + 1;
      if (next < 0 || next >= prev.length) return prev;
      const a = [...prev];
      [a[idx], a[next]] = [a[next], a[idx]];
      return a;
    });
  }

  // ── Toggle blocked ─────────────────────────────────────

  function toggleBlock(seatId: string) {
    if (occupied.has(seatId)) return;
    setBlocked((prev) => {
      const n = new Set(prev);
      n.has(seatId) ? n.delete(seatId) : n.add(seatId);
      return n;
    });
  }

  // ── Save ───────────────────────────────────────────────

  async function handleSave() {
    if (!eventId) return;

    // Validate: no empty labels, counts > 0
    if (rows.some((r) => !r.label.trim())) {
      setMessage({ type: 'error', text: 'All rows must have a label' });
      return;
    }
    if (rows.some((r) => r.count < 1)) {
      setMessage({ type: 'error', text: 'Each row must have at least 1 seat' });
      return;
    }

    // Validate: same-label rows must not have overlapping seat ranges
    const byLabel = new Map<string, Array<{ start: number; end: number; rowIdx: number }>>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const lbl = r.label.trim();
      const start = r.start_from;
      const end = rowEnd(r);
      const existing = byLabel.get(lbl) || [];
      for (const range of existing) {
        if (start <= range.end && end >= range.start) {
          setMessage({
            type: 'error',
            text: `Row "${lbl}" has overlapping seat ranges (${start}–${end} overlaps with row ${range.rowIdx + 1})`,
          });
          return;
        }
      }
      existing.push({ start, end, rowIdx: i });
      byLabel.set(lbl, existing);
    }

    // Prune blocked seats that no longer exist
    const allSeatIds = new Set<string>();
    for (const row of rows) {
      for (let i = row.start_from; i <= rowEnd(row); i++) allSeatIds.add(`${row.label.trim()}-${i}`);
    }
    const cleanBlocked = [...blocked].filter((s) => allSeatIds.has(s));

    const config: SeatMapConfig = {
      rows: rows.map(({ label, start_from, count, category, aisle_after }) => ({
        label: label.trim(),
        start_from,
        count,
        category,
        aisle_after: aisle_after ?? null,
      })),
      blocked: cleanBlocked,
    };

    setSaving(true);
    try {
      const res = await fetch('/api/events/seat-map', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, seat_map_config: config }),
      });
      const d = await res.json();
      if (d.success) {
        setBlocked(new Set(cleanBlocked));
        setMessage({ type: 'success', text: 'Seat map saved successfully!' });
      } else {
        setMessage({ type: 'error', text: d.error?.message || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <EventSelectorBar onChange={handleEventChange} />

      {loading && (
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        </div>
      )}

      {!loading && (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 lg:py-8">

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Seat Map</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Configure your venue layout · Click any seat in the map to block or unblock it
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Toast */}
      {message && (
        <div className={`mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto opacity-50 hover:opacity-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Seats', value: totalSeats, cls: 'text-slate-800' },
          { label: 'Available', value: availableCount, cls: 'text-emerald-700' },
          { label: 'Blocked', value: blockedCount, cls: 'text-slate-500' },
          { label: 'Occupied', value: occupiedCount, cls: 'text-brand-700' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-5 xl:flex-row">

        {/* Left: Row config */}
        <div className="xl:w-96 shrink-0">
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Row Configuration</h2>

            {rows.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">
                No rows yet.<br />Click &ldquo;Add Row&rdquo; to begin.
              </p>
            ) : (
              <div className="space-y-2 mb-3">
                {rows.map((row, idx) => (
                  <RowConfigItem
                    key={row.id}
                    row={row}
                    isFirst={idx === 0}
                    isLast={idx === rows.length - 1}
                    onChange={(field, val) => updateRow(row.id, field, val)}
                    onDelete={() => deleteRow(row.id)}
                    onDuplicate={() => duplicateRow(row.id)}
                    onMoveUp={() => moveRow(row.id, 'up')}
                    onMoveDown={() => moveRow(row.id, 'down')}
                  />
                ))}
              </div>
            )}

            <button
              onClick={addRow}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Row
            </button>

            {rows.length > 0 && (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">Tips:</p>
                <ul className="space-y-1 text-blue-600">
                  <li>Use <strong>From / To</strong> to define any seat range (e.g. 11→20)</li>
                  <li>Same row label with different ranges = two sections (e.g. left &amp; right block)</li>
                  <li><strong>Duplicate</strong> copies the row and starts where it ends</li>
                  <li>Click seats in the map to block/unblock</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Right: Visual seat map */}
        <div className="flex-1 min-w-0">
          <div className="card p-4 sm:p-5">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-500">No rows configured</p>
                <p className="text-xs text-slate-400 mt-1">Add rows on the left to see the seat map here</p>
              </div>
            ) : (
              <>
                {/* Screen */}
                <div className="mb-6 text-center">
                  <div className="mx-auto max-w-xs rounded-b-xl bg-gradient-to-b from-slate-700 to-slate-800 py-2 text-center text-xs font-bold tracking-[0.25em] text-slate-300 shadow-md">
                    SCREEN
                  </div>
                  <div className="mx-8 h-2 bg-gradient-to-b from-slate-200 to-transparent" />
                </div>

                {/* Seat grid — scrollable horizontally on small screens */}
                <div className="overflow-x-auto pb-2">
                  <div className="space-y-1.5 min-w-max">
                    {rows.map((row) => (
                      <SeatRowViz
                        key={row.id}
                        row={row}
                        blocked={blocked}
                        occupied={occupied}
                        onToggle={toggleBlock}
                      />
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                  <span className="text-xs font-semibold text-slate-500">Legend:</span>
                  <LegendItem cls="bg-amber-50 border-amber-400" label="Gold" />
                  <LegendItem cls="bg-emerald-50 border-emerald-400" label="Silver" />
                  <LegendItem cls="bg-violet-50 border-violet-400" label="Platinum" />
                  <LegendItem cls="bg-slate-200 border-slate-300" label="Blocked" />
                  <LegendItem cls="bg-slate-700 border-slate-800" label="Occupied" />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
      )}
    </div>
  );
}
