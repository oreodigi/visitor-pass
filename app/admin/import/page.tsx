'use client';

import { useState, ChangeEvent } from 'react';
import { EventSelectorBar, type EventSummary } from '@/app/admin/_components/event-selector';

interface ImportResult {
  total_rows: number;
  valid_rows: number;
  inserted: number;
  duplicates_skipped: number;
  invalid_rows: number;
  errors: Array<{ row: number; reason: string }>;
}

export default function ImportPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  function handleEventChange(ev: EventSummary | null) {
    setSelectedEvent(ev);
    setFile(null);
    setResult(null);
    setError('');
  }

  const eventId = selectedEvent?.id ?? null;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setError('');
  }

  async function handleUpload() {
    if (!file || !eventId) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.txt')) { setError('Please upload a .csv or .txt file'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('File too large (max 5MB)'); return; }
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('event_id', eventId);
      formData.append('file', file);
      const res = await fetch('/api/contacts/import', { method: 'POST', body: formData });
      const d = await res.json();
      if (!d.success) setError(d.error?.message || 'Import failed');
      else setResult(d.data);
    } catch {
      setError('Network error during upload');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <EventSelectorBar onChange={handleEventChange} />

      {!selectedEvent && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        </div>
      )}

      {selectedEvent && (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:py-8">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Upload Contacts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Import mobile numbers into{' '}
          <span className="font-semibold text-slate-700">{selectedEvent.title}</span>.{' '}
          Each contact receives a unique invitation link.
        </p>
      </div>

      {/* CSV format guide */}
      <div className="card p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">CSV Format</h2>
        <p className="text-sm text-slate-600 mb-3">
          Your CSV must have a header row with a{' '}
          <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-700">mobile</code>{' '}
          column. That is the only required column.
        </p>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 font-mono text-xs text-slate-700 overflow-x-auto">
          <div className="text-brand-600 font-semibold">mobile</div>
          <div>9876543210</div>
          <div>8765432109</div>
          <div>7654321098</div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Also accepts column aliases:{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono">phone</code>,{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono">contact</code>.{' '}
          Duplicate mobiles are automatically skipped. After upload, invitation
          links are ready to send from the{' '}
          <a href="/admin/contacts" className="text-brand-600 underline font-medium">Contacts page</a>.
        </p>
      </div>

      {/* Upload section */}
      <div className="card p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Upload File</h2>
        <div className="space-y-4">
          <div
            className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              file
                ? 'border-brand-300 bg-brand-50/40'
                : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50/20'
            }`}
          >
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            {file ? (
              <div>
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">
                  <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB · Click to change file</p>
              </div>
            ) : (
              <div>
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <p className="text-sm text-slate-600 font-medium">Click to select a CSV file</p>
                <p className="text-xs text-slate-400 mt-0.5">.csv or .txt · max 5MB</p>
              </div>
            )}
          </div>

          <button onClick={handleUpload} disabled={!file || uploading} className="btn-primary w-full">
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Importing…
              </span>
            ) : 'Upload Contacts'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {result && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Import Results</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
              <div className="text-xl font-bold text-slate-900 tabular-nums">{result.total_rows}</div>
              <div className="text-xs text-slate-500 mt-0.5">Total Rows</div>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
              <div className="text-xl font-bold text-emerald-700 tabular-nums">{result.inserted}</div>
              <div className="text-xs text-emerald-600 mt-0.5">Imported</div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
              <div className="text-xl font-bold text-amber-700 tabular-nums">{result.duplicates_skipped}</div>
              <div className="text-xs text-amber-600 mt-0.5">Duplicates</div>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-center">
              <div className="text-xl font-bold text-red-700 tabular-nums">{result.invalid_rows}</div>
              <div className="text-xs text-red-600 mt-0.5">Invalid</div>
            </div>
          </div>

          {result.inserted > 0 && (
            <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-sm text-brand-800 mb-4">
              Successfully imported {result.inserted} contact{result.inserted !== 1 ? 's' : ''}.{' '}
              <a href="/admin/contacts" className="underline font-semibold">Send invitations →</a>
            </div>
          )}

          {result.errors.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Issues ({result.errors.length})</h3>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="table-header">
                      <th className="px-3 py-2 text-left w-16">Row</th>
                      <th className="px-3 py-2 text-left">Issue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.errors.map((err, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-slate-600">{err.row || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={() => { setFile(null); setResult(null); setError(''); }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
      )}
    </div>
  );
}
