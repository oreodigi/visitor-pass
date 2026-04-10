'use client';

import { useState, useCallback } from 'react';
import { EventSelectorBar, type EventSummary } from '@/app/admin/_components/event-selector';
import { DEFAULT_INVITE_TEMPLATE, DEFAULT_PASS_TEMPLATE, renderTemplate } from '@/lib/whatsapp';

// ── Variable token definitions ─────────────────────────────

const INVITE_VARS = [
  { key: 'event',  label: '{{event}}',  desc: 'Event title' },
  { key: 'date',   label: '{{date}}',   desc: 'Event date' },
  { key: 'venue',  label: '{{venue}}',  desc: 'Venue name' },
  { key: 'link',   label: '{{link}}',   desc: 'Invitation link' },
];

const PASS_VARS = [
  { key: 'name',    label: '{{name}}',    desc: 'Attendee name' },
  { key: 'event',   label: '{{event}}',   desc: 'Event title' },
  { key: 'date',    label: '{{date}}',    desc: 'Event date' },
  { key: 'time',    label: '{{time}}',    desc: 'Event time' },
  { key: 'venue',   label: '{{venue}}',   desc: 'Venue name' },
  { key: 'seat',    label: '{{seat}}',    desc: 'Seat number' },
  { key: 'pass',    label: '{{pass}}',    desc: 'Pass number' },
  { key: 'link',    label: '{{link}}',    desc: 'Pass link' },
  { key: 'support', label: '{{support}}', desc: 'Support contact' },
];

const INVITE_SAMPLE: Record<string, string> = {
  event:   'MSME Awareness Program 2026',
  date:    '15 Apr 2026',
  venue:   'Town Hall, Jalgaon',
  link:    'https://ticket.rimacle.com/invite/abc123',
};

const PASS_SAMPLE: Record<string, string> = {
  name:    'Rahul Sharma',
  event:   'MSME Awareness Program 2026',
  date:    '15 Apr 2026',
  time:    '10:00 AM – 5:00 PM',
  venue:   'Town Hall, Jalgaon',
  seat:    '042',
  pass:    'MSME-042',
  link:    'https://ticket.rimacle.com/p/vp_abc123',
  support: '9876543210',
};

type Tab = 'invite' | 'pass';

// ── Small section divider ──────────────────────────────────

function SDiv({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pb-0.5">
      <span className="h-[13px] w-0.5 shrink-0 rounded-full bg-brand-600" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600/80">{label}</span>
      <span className="flex-1 border-t border-slate-100" />
    </div>
  );
}

// ── Variable chip ──────────────────────────────────────────

function VarChip({ label, desc, onInsert }: { label: string; desc: string; onInsert: (v: string) => void }) {
  return (
    <button
      type="button"
      title={desc}
      onClick={() => onInsert(label)}
      className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-mono font-semibold text-brand-700 hover:bg-brand-100 transition-colors"
    >
      {label}
    </button>
  );
}

// ── WhatsApp message preview ──────────────────────────────

function WaPreview({ text }: { text: string }) {
  if (!text.trim()) {
    return <div className="text-xs text-slate-400 italic">Preview will appear here…</div>;
  }
  return (
    <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm border border-slate-100 max-w-xs">
      <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans leading-relaxed">
        {text.split(/(\*[^*]+\*)/g).map((part, i) =>
          part.startsWith('*') && part.endsWith('*')
            ? <strong key={i}>{part.slice(1, -1)}</strong>
            : part
        )}
      </pre>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────

export default function MessageTemplatesPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const eventId = selectedEvent?.id ?? null;
  const [tab, setTab] = useState<Tab>('invite');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [inviteTemplate, setInviteTemplate] = useState('');
  const [passTemplate, setPassTemplate] = useState('');
  const [termsConditions, setTermsConditions] = useState('');

  // Track cursor position for insertion
  const [inviteRef, setInviteRef] = useState<HTMLTextAreaElement | null>(null);
  const [passRef, setPassRef] = useState<HTMLTextAreaElement | null>(null);

  async function handleEventChange(ev: EventSummary | null) {
    setSelectedEvent(ev);
    setMessage(null);
    if (!ev) { setInviteTemplate(''); setPassTemplate(''); setTermsConditions(''); return; }
    // Load this event's templates
    try {
      const res = await fetch(`/api/events?id=${ev.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setInviteTemplate(data.data.invite_message_template || '');
        setPassTemplate(data.data.pass_message_template || '');
        setTermsConditions(data.data.pass_terms_conditions || '');
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load templates' });
    }
  }

  async function handleSave() {
    if (!eventId) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: eventId,
          invite_message_template: inviteTemplate.trim() || null,
          pass_message_template: passTemplate.trim() || null,
          pass_terms_conditions: termsConditions.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Templates saved successfully' });
      } else {
        setMessage({ type: 'error', text: data.error?.message || 'Save failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  function insertVar(variable: string, textarea: HTMLTextAreaElement | null, setter: (v: string) => void, current: string) {
    if (!textarea) {
      setter(current + variable);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = current.slice(0, start) + variable + current.slice(end);
    setter(next);
    // Restore cursor after the inserted variable
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + variable.length;
      textarea.setSelectionRange(pos, pos);
    });
  }

  const invitePreview = useCallback(() => {
    const tpl = inviteTemplate.trim() || DEFAULT_INVITE_TEMPLATE;
    return renderTemplate(tpl, INVITE_SAMPLE);
  }, [inviteTemplate]);

  const passPreview = useCallback(() => {
    const tpl = passTemplate.trim() || DEFAULT_PASS_TEMPLATE;
    return renderTemplate(tpl, PASS_SAMPLE);
  }, [passTemplate]);

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 transition-colors font-mono resize-none';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <EventSelectorBar onChange={handleEventChange} />

      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <h1 className="text-sm font-bold text-slate-900">Message Templates</h1>
            <p className="text-[11px] text-slate-400">Customise WhatsApp messages and pass terms</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs"
          >
            {saving ? (
              <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
            ) : (
              <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Save Templates</>
            )}
          </button>
        </div>

        {message && (
          <div className={`border-t px-5 py-2 text-[11px] font-medium flex items-center gap-1.5 ${
            message.type === 'success'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
              : 'border-red-100 bg-red-50 text-red-700'
          }`}>
            {message.type === 'success'
              ? <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              : <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            }
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-t border-slate-100 px-5 gap-0">
          {([
            { key: 'invite', label: 'Invitation Message' },
            { key: 'pass',   label: 'Confirmation / Pass Message' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                tab === key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Editor */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {tab === 'invite' && (
            <>
              <SDiv label="Invitation Message Template" />
              <div className="rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-3 text-xs text-brand-800">
                Sent to contacts when you send an invitation. Leave blank to use the default message.
              </div>

              {/* Variable chips */}
              <div>
                <p className="mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Insert variable</p>
                <div className="flex flex-wrap gap-1.5">
                  {INVITE_VARS.map((v) => (
                    <VarChip
                      key={v.key}
                      label={v.label}
                      desc={v.desc}
                      onInsert={(val) => insertVar(val, inviteRef, setInviteTemplate, inviteTemplate)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="input-label mb-1">Template <span className="text-slate-400 font-normal">(leave blank for default)</span></label>
                <textarea
                  ref={(el) => setInviteRef(el)}
                  value={inviteTemplate}
                  onChange={(e) => setInviteTemplate(e.target.value)}
                  className={inputCls}
                  rows={14}
                  placeholder={DEFAULT_INVITE_TEMPLATE}
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Use *text* for bold in WhatsApp. Use the variable chips above to insert dynamic values.
                </p>
              </div>

              {inviteTemplate.trim() && (
                <button
                  type="button"
                  onClick={() => setInviteTemplate('')}
                  className="text-xs text-slate-400 hover:text-red-600 transition-colors"
                >
                  Reset to default
                </button>
              )}
            </>
          )}

          {tab === 'pass' && (
            <>
              <SDiv label="Confirmation / Pass Message Template" />
              <div className="rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-3 text-xs text-brand-800">
                Sent after a visitor confirms their registration and receives their pass. Leave blank for the default.
              </div>

              {/* Variable chips */}
              <div>
                <p className="mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Insert variable</p>
                <div className="flex flex-wrap gap-1.5">
                  {PASS_VARS.map((v) => (
                    <VarChip
                      key={v.key}
                      label={v.label}
                      desc={v.desc}
                      onInsert={(val) => insertVar(val, passRef, setPassTemplate, passTemplate)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="input-label mb-1">Template <span className="text-slate-400 font-normal">(leave blank for default)</span></label>
                <textarea
                  ref={(el) => setPassRef(el)}
                  value={passTemplate}
                  onChange={(e) => setPassTemplate(e.target.value)}
                  className={inputCls}
                  rows={14}
                  placeholder={DEFAULT_PASS_TEMPLATE}
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Use *text* for bold in WhatsApp. Use the variable chips above to insert dynamic values.
                </p>
              </div>

              {passTemplate.trim() && (
                <button
                  type="button"
                  onClick={() => setPassTemplate('')}
                  className="text-xs text-slate-400 hover:text-red-600 transition-colors"
                >
                  Reset to default
                </button>
              )}

              {/* Terms & Conditions */}
              <div className="pt-2">
                <SDiv label="Pass Terms &amp; Conditions" />
                <p className="mt-2 mb-3 text-xs text-slate-500">
                  Shown at the bottom of every visitor pass and the downloadable pass image.
                </p>
                <textarea
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  className={`${inputCls} font-sans`}
                  rows={6}
                  placeholder={`e.g.\n1. This pass is non-transferable and valid for one-time entry only.\n2. Please carry a valid photo ID along with this pass.\n3. The organiser reserves the right to deny entry without explanation.`}
                />
              </div>
            </>
          )}

        </div>

        {/* Right: Preview */}
        <div className="hidden lg:flex w-80 xl:w-96 shrink-0 flex-col border-l border-slate-200 bg-white overflow-y-auto">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live Preview</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Using sample data</p>
          </div>

          <div className="flex-1 p-5 bg-[#e5ddd5]">
            {tab === 'invite' && (
              <WaPreview text={invitePreview()} />
            )}
            {tab === 'pass' && (
              <div className="space-y-4">
                <WaPreview text={passPreview()} />
                {termsConditions.trim() && (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Terms &amp; Conditions (on pass)</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed whitespace-pre-line">{termsConditions}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 p-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm"
            >
              {saving ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
              ) : (
                <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Save Templates</>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
