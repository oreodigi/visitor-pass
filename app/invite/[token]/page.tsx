'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';

interface FormData {
  name: string;
  mobile: string;
  email: string;
  company_name: string;
}

interface EventInfo {
  title: string;
  event_date: string;
  venue_name: string;
}

interface ContactInfo {
  id: string;
  mobile: string;
  status: string;
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'already_confirmed'; pass_url?: string }
  | { kind: 'form'; contact: ContactInfo; event: EventInfo }
  | { kind: 'success'; pass_url: string; pass_number: string; seat_number: string };

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [form, setForm] = useState<FormData>({ name: '', mobile: '', email: '', company_name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvite() {
      try {
        const res = await fetch(`/api/invite/${token}`);
        const d = await res.json();

        if (!res.ok || !d.success) {
          setState({ kind: 'invalid' });
          return;
        }

        const { contact, event } = d.data;

        if (contact.status === 'confirmed') {
          setState({ kind: 'already_confirmed' });
          return;
        }

        setState({ kind: 'form', contact, event });
        setForm((f) => ({ ...f, mobile: contact.mobile || '' }));
      } catch {
        setState({ kind: 'invalid' });
      }
    }

    if (token) loadInvite();
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);

    if (!form.name.trim()) { setFieldError('Name is required'); return; }
    if (!form.mobile.trim()) { setFieldError('Mobile number is required'); return; }

    setSubmitting(true);

    try {
      const res = await fetch('/api/invite/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: form.name.trim(),
          mobile: form.mobile.trim(),
          email: form.email.trim() || undefined,
          company_name: form.company_name.trim() || undefined,
        }),
      });

      const d = await res.json();

      if (!d.success) {
        if (d.error?.code === 'ALREADY_CONFIRMED') {
          setState({ kind: 'already_confirmed' });
          return;
        }
        setFieldError(d.error?.message || 'Submission failed. Please try again.');
        return;
      }

      setState({
        kind: 'success',
        pass_url: d.data.pass_url,
        pass_number: d.data.pass_number,
        seat_number: d.data.seat_number,
      });
    } catch {
      setFieldError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ─────────────────────────────────────────────
  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-emerald-700" />
      </div>
    );
  }

  // ── Invalid ─────────────────────────────────────────────
  if (state.kind === 'invalid') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-stone-900">Invalid Invitation</h1>
          <p className="mt-1.5 text-sm text-stone-500">
            This invitation link is invalid or has expired. Please contact the event organizer for assistance.
          </p>
        </div>
      </div>
    );
  }

  // ── Already Confirmed ───────────────────────────────────
  if (state.kind === 'already_confirmed') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
            <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-stone-900">Already Confirmed</h1>
          <p className="mt-1.5 text-sm text-stone-500">
            You have already confirmed your participation. Your pass has been sent via WhatsApp. Please check your messages.
          </p>
        </div>
      </div>
    );
  }

  // ── Success ─────────────────────────────────────────────
  if (state.kind === 'success') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-stone-900">Confirmation Successful!</h1>
            <p className="mt-2 text-sm text-stone-500">
              Your participation has been confirmed. Your event pass is ready.
            </p>

            <div className="mt-5 rounded-xl bg-stone-50 border border-stone-200 p-4 text-left space-y-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Pass Number</div>
                <div className="font-mono text-sm font-bold text-emerald-800">{state.pass_number}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Seat Number</div>
                <div className="font-mono text-sm font-bold text-stone-800">{state.seat_number}</div>
              </div>
            </div>

            <a
              href={state.pass_url}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              </svg>
              View My Pass
            </a>
            <p className="mt-3 text-xs text-stone-400">
              Save the pass link — you will need to show it at the event entry.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────
  const { contact, event } = state;
  const isMobilePrefilled = !!contact.mobile;

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-800">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-stone-900">{event.title}</h1>
          <p className="mt-1 text-sm text-stone-500">{formatDate(event.event_date)}</p>
          <p className="text-xs text-stone-400">{event.venue_name}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-stone-900 mb-1">Confirm Your Participation</h2>
          <p className="text-xs text-stone-500 mb-5">
            Fill in your details below to confirm attendance and receive your event pass.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="input-label">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input-field"
                placeholder="Your full name"
                required
                autoComplete="name"
              />
            </div>

            {/* Mobile */}
            <div>
              <label className="input-label">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                className="input-field"
                placeholder="10-digit mobile number"
                required
                disabled={isMobilePrefilled}
                autoComplete="tel"
              />
              {isMobilePrefilled && (
                <p className="mt-1 text-xs text-stone-400">Mobile number is pre-filled from your invitation.</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="input-label">Email Address <span className="text-stone-400 font-normal">(optional)</span></label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="input-field"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            {/* Company */}
            <div>
              <label className="input-label">Company / Business Name <span className="text-stone-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                className="input-field"
                placeholder="Your business name"
                autoComplete="organization"
              />
            </div>

            {/* Error */}
            {fieldError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                {fieldError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-1"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Confirming…
                </span>
              ) : (
                'Confirm Participation'
              )}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-stone-400">
          MSME Awareness Program · Jalgaon
        </p>
      </div>
    </div>
  );
}
