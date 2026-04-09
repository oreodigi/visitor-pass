'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────

interface StaffUser {
  id: string;
  name: string;
  email: string | null;
  mobile: string;
  role: 'manager' | 'gate_staff';
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

interface StaffForm {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: 'manager' | 'gate_staff';
  designation: string;
  active: boolean;
}

const EMPTY_FORM: StaffForm = {
  name: '', email: '', mobile: '', password: '',
  role: 'gate_staff', designation: '', active: true,
};

// ─── Badges ───────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (role === 'manager') return <span className="badge badge-amber">Manager</span>;
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

// ─── Page ─────────────────────────────────────────────────

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<'all' | 'manager' | 'gate_staff'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<FormMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const [assignPanelOpen, setAssignPanelOpen] = useState(false);
  const [assignStaff, setAssignStaff] = useState<StaffUser | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [assignEventId, setAssignEventId] = useState('');
  const [assignRole, setAssignRole] = useState<'manager' | 'gate_staff'>('gate_staff');
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState('');

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
    setForm(EMPTY_FORM); setFormError(''); setPanelMode('add'); setEditingId(null); setPanelOpen(true);
  }

  function openEdit(s: StaffUser) {
    setForm({ name: s.name, email: s.email || '', mobile: s.mobile, password: '', role: s.role, designation: s.designation || '', active: s.active });
    setFormError(''); setPanelMode('edit'); setEditingId(s.id); setPanelOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormSaving(true);
    try {
      let res: Response;
      if (panelMode === 'add') {
        res = await fetch('/api/admin/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      } else {
        const payload: Record<string, unknown> = { ...form };
        if (!payload.password) delete payload.password;
        res = await fetch(`/api/admin/staff/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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

  async function toggleActive(s: StaffUser) {
    await fetch(`/api/admin/staff/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !s.active }) });
    fetchStaff();
  }

  async function openAssignments(s: StaffUser) {
    setAssignStaff(s); setAssignError(''); setAssignEventId('');
    setAssignRole(s.role === 'manager' ? 'manager' : 'gate_staff');
    const [asgRes, evtRes] = await Promise.all([fetch(`/api/admin/staff/${s.id}`), fetch('/api/events')]);
    const asgData = await asgRes.json();
    const evtData = await evtRes.json();
    if (asgData.success) setAssignments(asgData.data.assignments);
    if (evtData.success) setEvents(evtData.data.event ? [evtData.data.event] : []);
    setAssignPanelOpen(true);
  }

  async function handleAddAssignment() {
    if (!assignEventId || !assignStaff) return;
    setAssignSaving(true); setAssignError('');
    const res = await fetch('/api/admin/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: assignStaff.id, event_id: assignEventId, assigned_role: assignRole }) });
    const data = await res.json();
    if (!data.success) { setAssignError(data.error?.message || 'Failed to assign'); }
    else {
      const asgRes = await fetch(`/api/admin/staff/${assignStaff.id}`);
      const asgData = await asgRes.json();
      if (asgData.success) setAssignments(asgData.data.assignments);
      fetchStaff(); setAssignEventId('');
    }
    setAssignSaving(false);
  }

  async function handleRemoveAssignment(assignmentId: string) {
    await fetch(`/api/admin/assignments/${assignmentId}`, { method: 'DELETE' });
    if (assignStaff) {
      const asgRes = await fetch(`/api/admin/staff/${assignStaff.id}`);
      const asgData = await asgRes.json();
      if (asgData.success) setAssignments(asgData.data.assignments);
    }
    fetchStaff();
  }

  const ROLE_TABS = [
    { value: 'all', label: 'All Staff' },
    { value: 'manager', label: 'Managers' },
    { value: 'gate_staff', label: 'Event Staff' },
  ] as const;

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 transition-colors';

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Staff Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} team member{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd} className="btn-primary inline-flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Staff
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 gap-0.5">
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
            <p className="text-sm text-slate-500">No staff members found</p>
            <button onClick={openAdd} className="text-sm font-semibold text-brand-600 hover:underline">Add your first staff member</button>
          </div>
        ) : (
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
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-xs font-bold text-white shadow-soft">
                        {(s.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{s.name}</div>
                        {s.designation && <div className="text-xs text-slate-400">{s.designation}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-slate-700 text-sm">{s.email}</div>
                    <div className="text-xs text-slate-400 font-mono">{s.mobile}</div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={s.role} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <button
                      onClick={() => openAssignments(s)}
                      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                      </svg>
                      {s.assignment_count} event{s.assignment_count !== 1 ? 's' : ''}
                    </button>
                  </td>
                  <td className="px-4 py-3"><StatusBadge active={s.active} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        title="Edit"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openAssignments(s)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        title="Manage assignments"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => toggleActive(s)}
                        className={`rounded-lg p-1.5 transition-colors ${
                          s.active
                            ? 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                            : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                        title={s.active ? 'Deactivate' : 'Activate'}
                      >
                        {s.active ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm">
          <div className="relative h-full w-full max-w-md bg-white shadow-panel flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                {panelMode === 'add' ? 'Add Staff Member' : 'Edit Staff Member'}
              </h2>
              <button onClick={() => setPanelOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col p-6 gap-4">
              <div>
                <label className="input-label">Full Name *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Pradeep Sharma" />
              </div>
              <div>
                <label className="input-label">Email *</label>
                <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="staff@example.com" />
              </div>
              <div>
                <label className="input-label">Mobile *</label>
                <input type="tel" required value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} className={inputCls} placeholder="9876543210" />
              </div>
              <div>
                <label className="input-label">
                  Password {panelMode === 'edit' ? '(leave blank to keep unchanged)' : '*'}
                </label>
                <input type="password" required={panelMode === 'add'} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} placeholder="Min. 6 characters" />
              </div>
              <div>
                <label className="input-label">Role *</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'manager' | 'gate_staff' }))} className={inputCls}>
                  <option value="gate_staff">Event Staff</option>
                  <option value="manager">Manager</option>
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  {form.role === 'manager'
                    ? 'Can monitor event operations, view attendees and check-in stats.'
                    : 'Can scan passes and manage gate check-in for assigned events.'}
                </p>
              </div>
              <div>
                <label className="input-label">Designation</label>
                <input type="text" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} className={inputCls} placeholder="e.g. Gate Supervisor" />
              </div>

              {panelMode === 'edit' && (
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

              <div className="flex gap-3 mt-auto pt-2">
                <button type="button" onClick={() => setPanelOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={formSaving} className="flex-1 btn-primary py-2.5 text-sm">
                  {formSaving ? 'Saving…' : panelMode === 'add' ? 'Add Staff' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignments Panel */}
      {assignPanelOpen && assignStaff && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm">
          <div className="relative h-full w-full max-w-md bg-white shadow-panel flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Event Assignments</h2>
                <p className="text-xs text-slate-500 mt-0.5">{assignStaff.name}</p>
              </div>
              <button onClick={() => setAssignPanelOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 p-6 flex flex-col gap-5">
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
