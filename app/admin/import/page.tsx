'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import { EventSelectorBar, type EventSummary } from '@/app/admin/_components/event-selector';
import { AdminHero, EmptyPanel, InlineStatus, MetricTile, SurfaceCard } from '@/app/admin/_components/admin-surface';

interface ImportResult {
  total_rows: number;
  valid_rows: number;
  inserted: number;
  duplicates_skipped: number;
  invalid_rows: number;
  errors: Array<{ row: number; reason: string }>;
}

type ImportMode = 'file' | 'paste';

const SAMPLE_CSV = 'mobile\n9876543210\n8765432109\n7654321098';

export default function ImportPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>('file');
  const [pasteValue, setPasteValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const eventId = selectedEvent?.id ?? null;
  const normalizedPasteRows = useMemo(
    () =>
      pasteValue
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter(Boolean),
    [pasteValue]
  );

  function resetState() {
    setFile(null);
    setPasteValue('');
    setResult(null);
    setError('');
  }

  function handleEventChange(ev: EventSummary | null) {
    setSelectedEvent(ev);
    resetState();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const nextFile = e.target.files?.[0] || null;
    setFile(nextFile);
    setResult(null);
    setError('');
  }

  function buildImportFile(): File | null {
    if (mode === 'file') return file;

    if (normalizedPasteRows.length === 0) return null;

    const csv = ['mobile', ...normalizedPasteRows].join('\n');
    return new File([csv], 'contacts.csv', { type: 'text/csv' });
  }

  async function handleUpload() {
    const importFile = buildImportFile();
    if (!importFile || !eventId) return;

    const name = importFile.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.txt')) {
      setError('Only .csv or .txt files are supported');
      return;
    }
    if (importFile.size > 5 * 1024 * 1024) {
      setError('File too large. Keep it under 5MB.');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('event_id', eventId);
      formData.append('file', importFile);
      const res = await fetch('/api/contacts/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || 'Import failed');
        return;
      }
      setResult(data.data);
    } catch {
      setError('Network error during import');
    } finally {
      setUploading(false);
    }
  }

  const totalReady = result?.inserted ?? 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <EventSelectorBar onChange={handleEventChange} />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 lg:px-6 lg:py-8">
        <AdminHero
          eyebrow="Contact Import"
          title={selectedEvent ? `Load contacts into ${selectedEvent.title}` : 'Upload contacts into your next event'}
          description={
            selectedEvent
              ? 'Bring CSV files or paste mobile numbers directly. The system validates duplicates, creates invite links, and gets your outreach list ready for WhatsApp.'
              : 'Select an event first. Once selected, you can bulk upload contacts, paste raw numbers, and move straight into invite sending.'
          }
          actions={
            selectedEvent ? (
              <>
                <a
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`}
                  download="sample-contacts.csv"
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                >
                  Download Sample CSV
                </a>
                <a
                  href="/admin/contacts"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  View Contacts
                </a>
              </>
            ) : undefined
          }
        >
          {selectedEvent ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile label="Import Modes" value="2" note="CSV upload or direct paste list" tone="indigo" variant="dark" />
              <MetricTile label="Validation" value="Auto" note="Invalid and duplicate numbers are filtered out before insert" tone="emerald" variant="dark" />
              <MetricTile label="Output" value={totalReady} note="Contacts ready to receive invite links after import" tone="amber" variant="dark" />
            </div>
          ) : null}
        </AdminHero>

        {!selectedEvent ? (
          <EmptyPanel
            title="Pick an event before importing"
            description="This importer is event-aware. Select the event from the top bar first so contacts are attached to the right invite workflow."
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
            <div className="space-y-6">
              <SurfaceCard
                eyebrow="Input Mode"
                title="Upload your contact source"
                description="Choose the fastest route. CSV is best for agency-style bulk operations. Paste mode is faster for last-minute lists from WhatsApp, spreadsheets, or call teams."
              >
                <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
                  {([
                    { key: 'file', label: 'CSV / TXT Upload' },
                    { key: 'paste', label: 'Paste Numbers' },
                  ] as const).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setMode(item.key);
                        setResult(null);
                        setError('');
                      }}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        mode === item.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {mode === 'file' ? (
                  <div className="mt-5 rounded-[28px] border-2 border-dashed border-slate-300 bg-slate-50/80 p-5 text-center">
                    <input type="file" accept=".csv,.txt" onChange={handleFileChange} className="hidden" id="contacts-file" />
                    <label htmlFor="contacts-file" className="block cursor-pointer">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <p className="mt-4 text-base font-semibold text-slate-900">
                        {file ? file.name : 'Select a CSV or TXT file'}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        {file ? `${(file.size / 1024).toFixed(1)} KB ready to import` : 'Supports a single mobile column. Max size 5MB.'}
                      </p>
                    </label>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-4">
                      <label className="input-label">Paste one mobile number per line</label>
                      <textarea
                        value={pasteValue}
                        onChange={(e) => {
                          setPasteValue(e.target.value);
                          setResult(null);
                          setError('');
                        }}
                        rows={10}
                        className="input-field mt-2 resize-none font-mono text-sm"
                        placeholder={'9876543210\n8765432109\n7654321098'}
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <InlineStatus tone="indigo">{normalizedPasteRows.length} rows detected</InlineStatus>
                        <InlineStatus tone="slate">CSV will be generated automatically</InlineStatus>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading || !buildImportFile()}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {uploading ? 'Importing contacts...' : 'Run Import'}
                  </button>
                  <button
                    type="button"
                    onClick={resetState}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Reset
                  </button>
                </div>
              </SurfaceCard>

              {error ? (
                <SurfaceCard title="Import blocked" description="Fix the issue below and retry the import.">
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-700">
                    {error}
                  </div>
                </SurfaceCard>
              ) : null}

              {result ? (
                <SurfaceCard
                  eyebrow="Results"
                  title="Import summary"
                  description="This import is complete. Review the outcome, then move into invite sending or upload another batch."
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricTile label="Rows Received" value={result.total_rows} note="Raw rows read from your source" tone="slate" />
                    <MetricTile label="Imported" value={result.inserted} note="Fresh contacts now stored for this event" tone="emerald" />
                    <MetricTile label="Duplicates" value={result.duplicates_skipped} note="Skipped because they already existed or repeated in the batch" tone="amber" />
                    <MetricTile label="Invalid" value={result.invalid_rows} note="Rows rejected due to missing or invalid numbers" tone="rose" />
                  </div>

                  <div className="mt-5 flex flex-col gap-3 rounded-[24px] border border-indigo-200 bg-indigo-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-indigo-900">Import completed for {selectedEvent.title}</p>
                      <p className="mt-1 text-sm text-indigo-700">
                        {result.inserted > 0
                          ? `${result.inserted} contacts are ready to receive invite links.`
                          : 'No new contacts were added in this run.'}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:flex">
                      <a href="/admin/contacts" className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
                        Open Contacts
                      </a>
                      <a href="/admin/send-invites" className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50">
                        Go to Invite Sending
                      </a>
                    </div>
                  </div>

                  {result.errors.length > 0 ? (
                    <div className="mt-5 rounded-[24px] border border-slate-200">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">Rows that need attention</p>
                        <p className="mt-1 text-xs text-slate-500">Use this list to clean the source file before the next import.</p>
                      </div>
                      <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                        {result.errors.map((item, index) => (
                          <div key={`${item.row}-${index}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Row {item.row || '-'}</span>
                            <span className="text-sm text-slate-700">{item.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </SurfaceCard>
              ) : null}
            </div>

            <div className="space-y-6">
              <SurfaceCard
                eyebrow="Format"
                title="Importer rules"
                description="Keep the import source simple. The backend only needs a mobile column and it normalizes the number automatically."
              >
                <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 font-mono text-xs text-slate-100">
                  <div className="text-emerald-300">mobile</div>
                  <div>9876543210</div>
                  <div>8765432109</div>
                  <div>7654321098</div>
                </div>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <p>Accepted aliases in CSV headers: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">mobile</code>, <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">phone</code>, <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">contact</code>.</p>
                  <p>Import is event-specific. Duplicate numbers for the same event are skipped automatically.</p>
                  <p>Best practice: upload raw contacts first, then send from the contacts or bulk-send page after reviewing the imported list.</p>
                </div>
              </SurfaceCard>

              <SurfaceCard
                eyebrow="Ops Flow"
                title="Recommended workflow"
                description="Run this sequence to keep the invite funnel clean when your team is working across import, invite sending, and confirmation."
              >
                <div className="space-y-3">
                  {[
                    'Import or paste raw mobile numbers for the selected event.',
                    'Review duplicates and invalid rows from the summary.',
                    'Open contacts and spot-check the newest entries.',
                    'Send invites from WhatsApp once the message template is finalized.',
                    'Monitor confirmed visitors from the attendees screen.',
                  ].map((step, index) => (
                    <div key={step} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-slate-600">{step}</p>
                    </div>
                  ))}
                </div>
              </SurfaceCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
