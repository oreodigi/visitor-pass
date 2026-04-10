'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────

type UserRole = 'admin' | 'manager' | 'gate_staff';

interface TeamUser {
  id: string;
  name: string;
  email: string | null;
  mobile: string;
  role: UserRole;
  active: boolean;
  designation: string | null;
  assignment_count: number;
  created_at: string;
}

interface EventOption {
  id: string;
  title: string;
  event_date: string;
  status: string;
}

interface Assignment {
  id: string;
  event_id: string;
  assigned_role: string;
  events: { id: string; title: string; event_date: string; status: string } | null;
}

type FormMode = 'add' | 'edit';

interface UserForm {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: UserRole;
  designation: string;
  active: boolean;
}

const EMPTY_FORM: UserForm = {
  name: '', email: '', mobile: '', password: '',
  role: 'gate_staff', designation: '', active: true,
};

// ─── Badges ───────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (role === 'admin')      return <span className="badge badge-purple">Admin</span>;
  if (role === 'manager')    return <span className="badge badge-amber">Manager</span>;
  return <span className="badge badge-blue">Event Staff</span>;
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="badge badge-green inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active
    </span>
  ) : (
    <span className="badge badge-slate inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />Inactive
    </span>
  );
}

// ─── Avatar initials ──────────────────────────────────────

function Avatar({ name, role }: { name: string; role: string }) {
  const gradients: Record<string, string> = {
    admin:      'from-violet-500 to-purple-600',
    manager:    'from-amber-500 to-orange-500',
    gate_staff: 'from-brand-500 to-violet-600',
  };
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradients[role] ?? gradients.gate_staff} text-xs font-bold text-white shadow-soft`}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Delete confirmation modal ────────────────────────────

function DeleteModal({
  user, onCancel, onConfirm, deleting,
}: {
  user: TeamUser; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  const [txt, setTxt] = useState('');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-red-600 px-5 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 shrink-0">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Delete &quot;{user.name}&quot;</h3>
            <p className="text-xs text-red-200">This action is permanent and cannot be undone</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Deleting this account will permanently remove the user and all their event assignments.
            {user.role === 'admin' && (
              <span className="block mt-1 font-semibold text-amber-700">Warning: this is an admin account.</span>
            )}
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">DELETE</span> to confirm
            </label>
            <input
              type="text" value={txt} onChange={e => setTxt(e.target.value)} autoFocus
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20"
              placeholder="DELETE"
            />
          </div>
        </div>
        <div className="flex gap-2.5 px-5 pb-5">
          <button onClick={onCancel} disabled={deleting}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={txt !== 'DELETE' || deleting}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
            {deleting
              ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Deleting…</>
              : 'Delete User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Role description ─────────────────────────────────────

const ROLE_DESC: Record<UserRole, string> = {
  admin:      'Full access to all admin pages, settings, events, staff, and every API route.',
  manager:    'Can monitor event operations, view attendees and check-in stats for assigned events.',
  gate_staff: 'Can scan passes and manage gate check-in for assigned events.',
};

// ─── Page ─────────────────────────────────────────────────

export default function TeamPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [staff, setStaff] = useState<TeamUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<FormMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TeamUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [assignPanelOpen, setAssignPanelOpen] = useState(false);
  const [assignUser, setAssignUser] = useState<TeamUser | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [assignEventId, setAssignEventId] = useState('');
  const [assignRole, setAssignRole] = useState<'manager' | 'gate_staff'>('gate_staff');
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState('');

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 transition-colors';

  // Get own ID so we can protect self-actions
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.success) setCurrentUserId(d.data.user.id);
    });
  }, []);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (roleFilter !== 'all') params.set('role', roleFilter);
    if (activeFilter !== 'all') params.set('active', activeFilter);
    const res = await fetch(`/api/admin/staff?${params}`);
    const data = await res.json();
    if (data.success) {
      setStaff(data.data.staff);
      setTotal(data.data.total);
      setTotalPages(data.data.total_pages);
    }
    setLoading(false);
  }, [page, roleFilter, activeFilter]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  useEffect(() => { setPage(1); }, [roleFilter, activeFilter]);

  function openAdd() {
    setForm(EMPTY_FORM); setFormError('');
    setPanelMode('add'); setEditingId(null); setPanelOpen(true);
  }

  function openEdit(u: TeamUser) {
    setForm({ name: u.name, email: u.email || '', mobile: u.mobile, password: '', role: u.role, designation: u.designation || '', active: u.active });
    setFormError(''); setPanelMode('edit'); setEditingId(u.id); setPanelOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormSaving(true);
    try {
      let res: Response;
      if (panelMode === 'add') {
        res = await fetch('/api/admin/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        const payload: Record<string, unknown> = { ...form };
        if (!payload.password) delete payload.password;
        res = await fetch(`/api/admin/staff/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (!data.success) { setFormError(data.error?.message || 'Something went wrong'); setFormSaving(false); return; }
      setPanelOpen(false);
      fetchStaff();
    } catch {
      setFormError('Network error. Please try again.');
    }
    setFormSaving(false);
  }

  async function toggleActive(u: TeamUser) {
    const res = await fetch(`/api/admin/staff/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error?.message || 'Could not update status');
    }
    fetchStaff();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    const res = await fetch(`/api/admin/staff/${deleteTarget.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) {
      setDeleteError(data.error?.message || 'Delete failed');
      setDeleting(false);
      return;
    }
    setDeleteTarget(null);
    setDeleting(false);
    fetchStaff();
  }

  async function openAssignments(u: TeamUser) {
    setAssignUser(u); setAssignError(''); setAssignEventId('');
    setAssignRole(u.role === 'manager' ? 'manager' : 'gate_staff');
    const [asgRes, evtRes] = await Promise.all([
      fetch(`/api/admin/staff/${u.id}`),
      fetch('/api/events'),
    ]);
    const asgData = await asgRes.json();
    const evtData = await evtRes.json();
    if (asgData.success) setAssignments(asgData.data.assignments);
    if (evtData.success) {
      const evts = evtData.data;
      setEvents(Array.isArray(evts) ? evts : evts.event ? [evts.event] : []);
    }
    setAssignPanelOpen(true);
  }

  async function handleAddAssignment() {
    if (!assignEventId || !assignUser) return;
    setAssignSaving(true); setAssignError('');
    const res = await fetch('/api/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: assignUser.id, event_id: assignEventId, assigned_role: assignRole }),
    });
    const data = await res.json();
    if (!data.success) {
      setAssignError(data.error?.message || 'Failed to assign');
    } else {
      const asgRes = await fetch(`/api/admin/staff/${assignUser.id}`);
      const asgData = await asgRes.json();
      if (asgData.success) setAssignments(asgData.data.assignments);
      fetchStaff(); setAssignEventId('');
    }
    setAssignSaving(false);
  }

  async function handleRemoveAssignment(assignmentId: string) {
    await fetch(`/api/admin/assignments/${assignmentId}`, { method: 'DELETE' });
    if (assignUser) {
      const asgRes = await fetch(`/api/admin/staff/${assignUser.id}`);
      const asgData = await asgRes.json();
      if (asgData.success) setAssignments(asgData.data.assignments);
    }
    fetchStaff();
  }

  const ROLE_TABS = [
    { value: 'all',        label: 'All' },
    { value: 'admin',      label: 'Admins' },
    { value: 'manager',    label: 'Managers' },
    { value: 'gate_staff', label: 'Event Staff' },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          user={deleteTarget}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
          onConfirm={confirmDelete}
          deleting={deleting}
        />
      )}
      {deleteError && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-red-600 px-4 py-3 text-sm text-white shadow-lg flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {deleteError}
          <button onClick={() => setDeleteError('')} className="ml-2 opacity-70 hover:opacity-100">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} user{total !== 1 ? 's' : ''} across all roles</p>
        </div>
        <button onClick={openAdd} className="btn-primary inline-flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex overflow-x-auto rounded-lg border border-slate-200 bg-white p-0.5 gap-0.5">
          {ROLE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setRoleFilter(t.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                roleFilter === t.value ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as 'all' | 'true' | 'false')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="all">All status</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
              <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">No users found</p>
            <button onClick={openAdd} className="text-sm font-semibold text-brand-600 hover:underline">Add your first user</button>
          </div>
        ) : (
          <>
          <div className="divide-y divide-slate-100 md:hidden">
            {staff.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <div key={u.id} className={`p-4 ${isSelf ? 'bg-brand-50/30' : 'bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <Avatar name={u.name} role={u.role} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {u.name}
                            {isSelf && <span className="ml-1.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-600">You</span>}
                          </p>
                          {u.designation && <p className="mt-0.5 truncate text-xs text-slate-400">{u.designation}</p>}
                        </div>
                        <StatusBadge active={u.active} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <RoleBadge role={u.role} />
                        {!isSelf && u.role !== 'admin' && (
                          <button
                            onClick={() => openAssignments(u)}
                            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                          >
                            {u.assignment_count} event{u.assignment_count !== 1 ? 's' : ''}
                          </button>
                        )}
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <p className="truncate">{u.email || 'No email'}</p>
                        <p className="font-mono">{u.mobile}</p>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button onClick={() => openEdit(u)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700">
                          Edit
                        </button>
                        {u.role !== 'admin' ? (
                          <button onClick={() => openAssignments(u)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700">
                            Events
                          </button>
                        ) : (
                          <div />
                        )}
                        {!isSelf && (
                          <button
                            onClick={() => toggleActive(u)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
                          >
                            {u.active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        {!isSelf && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Contact</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Events</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${isSelf ? 'bg-brand-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} role={u.role} />
                        <div>
                          <div className="font-semibold text-slate-900">
                            {u.name}
                            {isSelf && <span className="ml-1.5 text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">You</span>}
                          </div>
                          {u.designation && <div className="text-xs text-slate-400">{u.designation}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-slate-700 text-sm">{u.email}</div>
                      <div className="text-xs text-slate-400 font-mono">{u.mobile}</div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {u.role === 'admin' ? (
                        <span className="text-xs text-slate-400 italic">All events</span>
                      ) : (
                        <button
                          onClick={() => openAssignments(u)}
                          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                          </svg>
                          {u.assignment_count} event{u.assignment_count !== 1 ? 's' : ''}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge active={u.active} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit */}
                        <button
                          onClick={() => openEdit(u)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          title="Edit"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>

                        {/* Assignments (non-admin only) */}
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => openAssignments(u)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            title="Manage assignments"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                            </svg>
                          </button>
                        )}

                        {/* Toggle active (not self) */}
                        {!isSelf && (
                          <button
                            onClick={() => toggleActive(u)}
                            className={`rounded-lg p-1.5 transition-colors ${
                              u.active
                                ? 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                                : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                            }`}
                            title={u.active ? 'Deactivate' : 'Activate'}
                          >
                            {u.active ? (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </button>
                        )}

                        {/* Delete (not self) */}
                        {!isSelf && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete user"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
              Previous
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm md:items-start md:justify-end">
          <div className="relative flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-3xl bg-white shadow-panel md:h-full md:max-h-none md:max-w-md md:rounded-none">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                {panelMode === 'add' ? 'Add New User' : 'Edit User'}
              </h2>
              <button onClick={() => setPanelOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col gap-4 p-5 md:p-6">
              <div>
                <label className="input-label">Full Name *</label>
                <input type="text" required value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls} placeholder="e.g. Pradeep Sharma" />
              </div>
              <div>
                <label className="input-label">Email *</label>
                <input type="email" required value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputCls} placeholder="user@example.com" />
              </div>
              <div>
                <label className="input-label">Mobile *</label>
                <input type="tel" required value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                  className={inputCls} placeholder="9876543210" />
              </div>
              <div>
                <label className="input-label">
                  Password {panelMode === 'edit' ? '(leave blank to keep unchanged)' : '*'}
                </label>
                <input type="password" required={panelMode === 'add'} value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className={inputCls} placeholder="Min. 6 characters" />
              </div>

              {/* Role — disable changing own role */}
              <div>
                <label className="input-label">Role *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  disabled={panelMode === 'edit' && editingId === currentUserId}
                  className={inputCls}
                >
                  <option value="gate_staff">Event Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Administrator</option>
                </select>
                <p className="mt-1 text-xs text-slate-400">{ROLE_DESC[form.role]}</p>
                {panelMode === 'edit' && editingId === currentUserId && (
                  <p className="mt-1 text-xs text-amber-600">You cannot change your own role.</p>
                )}
              </div>

              <div>
                <label className="input-label">Designation / Title</label>
                <input type="text" value={form.designation}
                  onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                  className={inputCls} placeholder="e.g. Gate Supervisor, Event Coordinator" />
              </div>

              {panelMode === 'edit' && editingId !== currentUserId && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.active ? 'bg-brand-600' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-slate-700">{form.active ? 'Active' : 'Inactive'}</span>
                </div>
              )}

              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{formError}</div>
              )}

              <div className="mt-auto grid grid-cols-1 gap-2 pt-2 sm:flex sm:gap-3">
                <button type="button" onClick={() => setPanelOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={formSaving} className="flex-1 btn-primary py-2.5 text-sm">
                  {formSaving ? 'Saving…' : panelMode === 'add' ? 'Add User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignments Panel */}
      {assignPanelOpen && assignUser && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm md:items-start md:justify-end">
          <div className="relative flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-3xl bg-white shadow-panel md:h-full md:max-h-none md:max-w-md md:rounded-none">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Event Assignments</h2>
                <p className="text-xs text-slate-500 mt-0.5">{assignUser.name}</p>
              </div>
              <button onClick={() => setAssignPanelOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 p-5 flex flex-col gap-5 md:p-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Assign to Event</h3>
                <div className="flex flex-col gap-3">
                  <select value={assignEventId} onChange={(e) => setAssignEventId(e.target.value)} className={inputCls}>
                    <option value="">Select event…</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title} ({ev.event_date})</option>
                    ))}
                  </select>
                  <select value={assignRole} onChange={(e) => setAssignRole(e.target.value as 'manager' | 'gate_staff')} className={inputCls}>
                    <option value="gate_staff">Event Staff</option>
                    <option value="manager">Manager</option>
                  </select>
                  {assignError && <p className="text-xs text-red-600">{assignError}</p>}
                  <button
                    onClick={handleAddAssignment}
                    disabled={!assignEventId || assignSaving}
                    className="btn-primary py-2 text-sm disabled:opacity-50"
                  >
                    {assignSaving ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Current Assignments ({assignments.length})
                </h3>
                {assignments.length === 0 ? (
                  <p className="text-sm text-slate-400">No event assignments yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {assignments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{a.events?.title || 'Unknown Event'}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400">{a.events?.event_date}</span>
                            <RoleBadge role={a.assigned_role} />
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveAssignment(a.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
