'use client';

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';

// ─── Types ────────────────────────────────────────────────

type Tab = 'general' | 'smtp';

interface GeneralSettings {
  app_name: string;
  app_tagline: string;
  app_logo_url: string;
  support_email: string;
  support_phone: string;
}

interface SmtpSettings {
  smtp_host: string;
  smtp_port: string;
  smtp_secure: string;
  smtp_user: string;
  smtp_password: string;
  smtp_from_name: string;
  smtp_from_email: string;
}

const GENERAL_EMPTY: GeneralSettings = {
  app_name: '', app_tagline: '', app_logo_url: '',
  support_email: '', support_phone: '',
};

const SMTP_EMPTY: SmtpSettings = {
  smtp_host: '', smtp_port: '587', smtp_secure: 'starttls',
  smtp_user: '', smtp_password: '', smtp_from_name: '', smtp_from_email: '',
};

// ─── Helpers ──────────────────────────────────────────────

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Input({
  name, value, onChange, type = 'text', placeholder, disabled,
}: {
  name: string; value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <input
      name={name} id={name} type={type} value={value} onChange={onChange}
      placeholder={placeholder} disabled={disabled}
      className="input-field disabled:opacity-60"
    />
  );
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border-b border-slate-200 pb-3 mb-5">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
  );
}

// ─── General tab ──────────────────────────────────────────

function GeneralTab({
  settings, onChange, onSubmit, saving, uploading, onLogoUpload, message,
}: {
  settings: GeneralSettings;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent) => void;
  saving: boolean; uploading: boolean;
  onLogoUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  message: { type: 'success' | 'error'; text: string } | null;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-2xl">
      <SectionHeader
        title="Application Identity"
        desc="Customize the name and branding shown throughout the application."
      />

      {/* Logo upload */}
      <Field label="Application Logo" hint="PNG or JPG · max 2MB · appears in the sidebar and pass header">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {settings.app_logo_url ? (
            <img
              src={settings.app_logo_url} alt="App logo"
              className="h-14 w-14 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-sm"
            />
          ) : (
            <div className="h-14 w-14 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
              <svg className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
          )}
          <label className={`relative inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            {uploading
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />Uploading…</>
              : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>{settings.app_logo_url ? 'Replace Logo' : 'Upload Logo'}</>
            }
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={onLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
          </label>
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Application Name" hint="Shown in the sidebar header and email subjects">
          <Input name="app_name" value={settings.app_name} onChange={onChange} placeholder="Visitor Pass" />
        </Field>
        <Field label="Tagline" hint="Short description shown below the app name">
          <Input name="app_tagline" value={settings.app_tagline} onChange={onChange} placeholder="Event check-in made easy" />
        </Field>
      </div>

      <SectionHeader
        title="Support Contact"
        desc="Displayed on error pages and in the footer of system emails."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Support Email">
          <Input name="support_email" value={settings.support_email} onChange={onChange} type="email" placeholder="support@example.com" />
        </Field>
        <Field label="Support Phone">
          <Input name="support_phone" value={settings.support_phone} onChange={onChange} placeholder="+91 98765 43210" />
        </Field>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success'
            ? <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            : <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          }
          {message.text}
        </div>
      )}

      <div className="flex justify-stretch pt-2 sm:justify-end">
        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
          {saving
            ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
            : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Save General Settings</>
          }
        </button>
      </div>
    </form>
  );
}

// ─── SMTP tab ─────────────────────────────────────────────

function SmtpTab({
  settings, onChange, onSubmit, saving, message,
}: {
  settings: SmtpSettings;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: (e: FormEvent) => void;
  saving: boolean;
  message: { type: 'success' | 'error'; text: string } | null;
}) {
  const [showPwd, setShowPwd] = useState(false);

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-2xl">
      <SectionHeader
        title="SMTP Configuration"
        desc="Outgoing email settings used for sending pass invitations and notifications."
      />

      {/* Info banner */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex gap-3">
        <svg className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <div className="text-xs text-blue-800 leading-relaxed">
          <p className="font-semibold mb-0.5">For Gmail / Google Workspace</p>
          <p>Host: <code className="bg-blue-100 px-1 rounded">smtp.gmail.com</code> · Port: <code className="bg-blue-100 px-1 rounded">587</code> · Security: <code className="bg-blue-100 px-1 rounded">STARTTLS</code> · Use an App Password, not your account password.</p>
        </div>
      </div>

      {/* Server */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="col-span-2">
          <Field label="SMTP Host">
            <Input name="smtp_host" value={settings.smtp_host} onChange={onChange as (e: ChangeEvent<HTMLInputElement>) => void} placeholder="smtp.gmail.com" />
          </Field>
        </div>
        <Field label="Port">
          <Input name="smtp_port" value={settings.smtp_port} onChange={onChange as (e: ChangeEvent<HTMLInputElement>) => void} placeholder="587" />
        </Field>
      </div>

      <Field label="Security / Encryption">
        <select
          name="smtp_secure"
          value={settings.smtp_secure}
          onChange={onChange as (e: ChangeEvent<HTMLSelectElement>) => void}
          className="input-field"
        >
          <option value="starttls">STARTTLS (port 587 — recommended)</option>
          <option value="ssl">SSL / TLS (port 465)</option>
          <option value="none">None (port 25 — not recommended)</option>
        </select>
      </Field>

      {/* Auth */}
      <SectionHeader
        title="Authentication"
        desc="Credentials used to log in to the SMTP server."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="SMTP Username / Email">
          <Input name="smtp_user" value={settings.smtp_user} onChange={onChange as (e: ChangeEvent<HTMLInputElement>) => void} type="email" placeholder="you@gmail.com" />
        </Field>
        <Field label="SMTP Password / App Password">
          <div className="relative">
            <input
              name="smtp_password" id="smtp_password" type={showPwd ? 'text' : 'password'}
              value={settings.smtp_password}
              onChange={onChange as (e: ChangeEvent<HTMLInputElement>) => void}
              placeholder="••••••••••••"
              className="input-field pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPwd
                ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              }
            </button>
          </div>
        </Field>
      </div>

      {/* From */}
      <SectionHeader
        title="Sender Identity"
        desc="The name and address that will appear in the From field of outgoing emails."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="From Name">
          <Input name="smtp_from_name" value={settings.smtp_from_name} onChange={onChange as (e: ChangeEvent<HTMLInputElement>) => void} placeholder="Visitor Pass" />
        </Field>
        <Field label="From Email Address">
          <Input name="smtp_from_email" value={settings.smtp_from_email} onChange={onChange as (e: ChangeEvent<HTMLInputElement>) => void} type="email" placeholder="noreply@yourdomain.com" />
        </Field>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success'
            ? <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            : <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          }
          {message.text}
        </div>
      )}

      <div className="flex justify-stretch pt-2 sm:justify-end">
        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
          {saving
            ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
            : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Save SMTP Settings</>
          }
        </button>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [general, setGeneral] = useState<GeneralSettings>(GENERAL_EMPTY);
  const [smtp, setSmtp] = useState<SmtpSettings>(SMTP_EMPTY);
  const [genMsg, setGenMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [smtpMsg, setSmtpMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        const s = data.data as Record<string, string>;
        setGeneral({
          app_name: s.app_name || '',
          app_tagline: s.app_tagline || '',
          app_logo_url: s.app_logo_url || '',
          support_email: s.support_email || '',
          support_phone: s.support_phone || '',
        });
        setSmtp({
          smtp_host: s.smtp_host || '',
          smtp_port: s.smtp_port || '587',
          smtp_secure: s.smtp_secure || 'starttls',
          smtp_user: s.smtp_user || '',
          smtp_password: s.smtp_password || '',
          smtp_from_name: s.smtp_from_name || '',
          smtp_from_email: s.smtp_from_email || '',
        });
      }
    } catch {
      // silently fail — form stays at defaults
    } finally {
      setLoading(false);
    }
  }

  function handleGeneralChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setGeneral(prev => ({ ...prev, [name]: value }));
    setGenMsg(null);
  }

  function handleSmtpChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setSmtp(prev => ({ ...prev, [name]: value }));
    setSmtpMsg(null);
  }

  async function saveGeneral(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setGenMsg(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(general),
      });
      const data = await res.json();
      setGenMsg(data.success
        ? { type: 'success', text: 'General settings saved successfully' }
        : { type: 'error', text: data.error?.message || 'Save failed' });
    } catch {
      setGenMsg({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function saveSmtp(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSmtpMsg(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtp),
      });
      const data = await res.json();
      setSmtpMsg(data.success
        ? { type: 'success', text: 'SMTP settings saved successfully' }
        : { type: 'error', text: data.error?.message || 'Save failed' });
    } catch {
      setSmtpMsg({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setGenMsg(null);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await fetch('/api/settings', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setGeneral(prev => ({ ...prev, app_logo_url: data.data.logo_url }));
        setGenMsg({ type: 'success', text: 'Logo uploaded successfully' });
      } else {
        setGenMsg({ type: 'error', text: data.error?.message || 'Upload failed' });
      }
    } catch {
      setGenMsg({ type: 'error', text: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }

  const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    {
      id: 'general',
      label: 'General',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'smtp',
      label: 'Email / SMTP',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="px-4 py-4 sm:px-6">
          <h1 className="text-xl font-bold text-slate-900">Application Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage app identity, SMTP email configuration, and more</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 sm:px-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {tab === 'general' && (
          <GeneralTab
            settings={general}
            onChange={handleGeneralChange}
            onSubmit={saveGeneral}
            saving={saving}
            uploading={uploading}
            onLogoUpload={handleLogoUpload}
            message={genMsg}
          />
        )}
        {tab === 'smtp' && (
          <SmtpTab
            settings={smtp}
            onChange={handleSmtpChange}
            onSubmit={saveSmtp}
            saving={saving}
            message={smtpMsg}
          />
        )}
      </div>
    </div>
  );
}
