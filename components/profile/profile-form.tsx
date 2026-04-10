'use client';

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';

// ─── Types ────────────────────────────────────────────────

interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  mobile: string;
  role: string;
  designation: string | null;
  profile_picture_url: string | null;
  active: boolean;
  created_at: string;
}

type Section = 'profile' | 'password';

// ─── Avatar ───────────────────────────────────────────────

function Avatar({
  url, name, uploading, onUpload,
}: {
  url: string | null; name: string; uploading: boolean;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        {url ? (
          <img
            src={url} alt={name}
            className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md"
          />
        ) : (
          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center border-4 border-white shadow-md">
            <span className="text-2xl font-bold text-white">{initials}</span>
          </div>
        )}

        {/* Upload overlay */}
        <label className={`absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${uploading ? 'opacity-100 pointer-events-none' : ''}`}>
          {uploading
            ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            : <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
          }
          <input
            type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={onUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      </div>
      <p className="text-xs text-slate-500">Click photo to change · PNG/JPG · max 2MB</p>
    </div>
  );
}

// ─── Role badge ───────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const cfg: Record<string, string> = {
    admin:      'bg-violet-100 text-violet-700 ring-violet-200',
    manager:    'bg-blue-100 text-blue-700 ring-blue-200',
    gate_staff: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  const labels: Record<string, string> = {
    admin: 'Administrator', manager: 'Manager', gate_staff: 'Gate Staff',
  };
  const cls = cfg[role] ?? cfg.gate_staff;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>
      {labels[role] ?? role}
    </span>
  );
}

// ─── Field ────────────────────────────────────────────────

function FormField({
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

// ─── Alert ────────────────────────────────────────────────

function Alert({ msg }: { msg: { type: 'success' | 'error'; text: string } }) {
  return (
    <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
      msg.type === 'success'
        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      {msg.type === 'success'
        ? <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
        : <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
      }
      {msg.text}
    </div>
  );
}

// ─── Main ProfileForm ─────────────────────────────────────

export default function ProfileForm() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>('profile');

  // Profile form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [designation, setDesignation] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password form state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Avatar
  const [uploading, setUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.success) {
        const p: UserProfile = data.data;
        setProfile(p);
        setName(p.name);
        setEmail(p.email || '');
        setMobile(p.mobile);
        setDesignation(p.designation || '');
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, mobile, designation }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile(prev => prev ? { ...prev, ...data.data } : null);
        setProfileMsg({ type: 'success', text: 'Profile updated successfully' });
      } else {
        setProfileMsg({ type: 'error', text: data.error?.message || 'Update failed' });
      }
    } catch {
      setProfileMsg({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSavePassword(e: FormEvent) {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (newPwd.length < 6) {
      setPwdMsg({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setSavingPwd(true);
    setPwdMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      });
      const data = await res.json();
      if (data.success) {
        setPwdMsg({ type: 'success', text: 'Password changed successfully' });
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
      } else {
        setPwdMsg({ type: 'error', text: data.error?.message || 'Password change failed' });
      }
    } catch {
      setPwdMsg({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSavingPwd(false);
    }
  }

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setAvatarMsg(null);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await fetch('/api/profile', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setProfile(prev => prev ? { ...prev, profile_picture_url: data.data.avatar_url } : null);
        setAvatarMsg({ type: 'success', text: 'Profile picture updated' });
      } else {
        setAvatarMsg({ type: 'error', text: data.error?.message || 'Upload failed' });
      }
    } catch {
      setAvatarMsg({ type: 'error', text: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-xl">
        <div className="flex justify-center"><div className="h-24 w-24 animate-pulse rounded-full bg-slate-200" /></div>
        {[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-200" />)}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-sm text-slate-500">Unable to load profile. Please refresh.</div>
    );
  }

  const joined = new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <h1 className="text-xl font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account details and password</p>
      </div>

      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

          {/* ── Left card — avatar + identity ──────── */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              {/* Gradient banner */}
              <div className="h-20 bg-gradient-to-br from-brand-600 to-violet-600" />
              <div className="px-5 pb-5 -mt-12 flex flex-col items-center text-center">
                <Avatar
                  url={profile.profile_picture_url}
                  name={profile.name}
                  uploading={uploading}
                  onUpload={handleAvatarUpload}
                />
                {avatarMsg && (
                  <div className={`mt-2 text-xs font-medium ${avatarMsg.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {avatarMsg.text}
                  </div>
                )}
                <h2 className="mt-3 text-base font-bold text-slate-900">{profile.name}</h2>
                {profile.designation && (
                  <p className="text-xs text-slate-500 mt-0.5">{profile.designation}</p>
                )}
                <div className="mt-2">
                  <RoleBadge role={profile.role} />
                </div>
              </div>
            </div>

            {/* Meta info */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</p>
                <p className="text-sm text-slate-700 mt-0.5 truncate">{profile.email || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mobile</p>
                <p className="text-sm text-slate-700 font-mono mt-0.5">{profile.mobile}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Member Since</p>
                <p className="text-sm text-slate-700 mt-0.5">{joined}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold mt-0.5 ${profile.active ? 'text-emerald-700' : 'text-red-600'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${profile.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {profile.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Right — forms ──────────────────────── */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            {/* Section tabs */}
            <div className="flex overflow-x-auto border-b border-slate-200">
              {([
                { id: 'profile' as Section, label: 'Account Info' },
                { id: 'password' as Section, label: 'Change Password' },
              ] as const).map(s => (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`flex-1 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                    section === s.id
                      ? 'border-brand-600 text-brand-700 bg-brand-50/40'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* ── Account Info ── */}
              {section === 'profile' && (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <FormField label="Full Name">
                    <input
                      value={name} onChange={e => { setName(e.target.value); setProfileMsg(null); }}
                      className="input-field" placeholder="Your full name" required
                    />
                  </FormField>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="Email Address">
                      <input
                        type="email" value={email}
                        onChange={e => { setEmail(e.target.value); setProfileMsg(null); }}
                        className="input-field" placeholder="you@example.com"
                      />
                    </FormField>
                    <FormField label="Mobile Number" hint="10-digit number">
                      <input
                        value={mobile} onChange={e => { setMobile(e.target.value); setProfileMsg(null); }}
                        className="input-field font-mono" placeholder="9876543210"
                      />
                    </FormField>
                  </div>

                  <FormField label="Designation / Title" hint="Optional — shown on profile card">
                    <input
                      value={designation}
                      onChange={e => { setDesignation(e.target.value); setProfileMsg(null); }}
                      className="input-field" placeholder="e.g. Event Coordinator"
                    />
                  </FormField>

                  {profileMsg && <Alert msg={profileMsg} />}

                  <div className="flex justify-stretch pt-2 sm:justify-end">
                    <button type="submit" disabled={savingProfile} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
                      {savingProfile
                        ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
                        : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Save Changes</>
                      }
                    </button>
                  </div>
                </form>
              )}

              {/* ── Change Password ── */}
              {section === 'password' && (
                <form onSubmit={handleSavePassword} className="space-y-4">
                  <FormField label="Current Password">
                    <div className="relative">
                      <input
                        type={showCurrentPwd ? 'text' : 'password'}
                        value={currentPwd}
                        onChange={e => { setCurrentPwd(e.target.value); setPwdMsg(null); }}
                        className="input-field pr-10" placeholder="Your current password" required
                      />
                      <button type="button" onClick={() => setShowCurrentPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <EyeIcon open={showCurrentPwd} />
                      </button>
                    </div>
                  </FormField>

                  <FormField label="New Password" hint="Minimum 6 characters">
                    <div className="relative">
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        value={newPwd}
                        onChange={e => { setNewPwd(e.target.value); setPwdMsg(null); }}
                        className="input-field pr-10" placeholder="New password" required
                      />
                      <button type="button" onClick={() => setShowNewPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <EyeIcon open={showNewPwd} />
                      </button>
                    </div>
                  </FormField>

                  <FormField label="Confirm New Password">
                    <input
                      type="password" value={confirmPwd}
                      onChange={e => { setConfirmPwd(e.target.value); setPwdMsg(null); }}
                      className={`input-field ${confirmPwd && confirmPwd !== newPwd ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20' : ''}`}
                      placeholder="Repeat new password" required
                    />
                    {confirmPwd && confirmPwd !== newPwd && (
                      <p className="mt-1 text-[11px] text-red-500">Passwords do not match</p>
                    )}
                  </FormField>

                  {pwdMsg && <Alert msg={pwdMsg} />}

                  <div className="flex justify-stretch pt-2 sm:justify-end">
                    <button type="submit" disabled={savingPwd} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
                      {savingPwd
                        ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Changing…</>
                        : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>Change Password</>
                      }
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tiny eye icon ────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open
    ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
    : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
