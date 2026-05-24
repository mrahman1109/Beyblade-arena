import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Shield, User } from 'lucide-react';

export default function People() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(() =>
    api.get('/users').then(setUsers).finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);

  const deleteUser = async (id) => {
    if (!confirm('Delete this user?')) return;
    await api.delete(`/users/${id}`);
    load();
  };

  const displayed = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.department && u.department.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">People</h2>
          <p className="text-gray-500 mt-1 text-sm">{users.length} team member{users.length !== 1 ? 's' : ''}</p>
        </div>
        {currentUser?.role === 'admin' && (
          <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-1.5">
            <Plus size={15} /> Add Person
          </button>
        )}
      </div>

      <div className="mb-4">
        <input
          className="input max-w-sm"
          placeholder="Search by name, email or department…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {displayed.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No people found.</div>
        )}
        <ul className="divide-y divide-gray-100">
          {displayed.map(u => (
            <li key={u.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 shrink-0">
                {u.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  {u.role === 'admin' && <Shield size={13} className="text-indigo-500" />}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{u.email}{u.department ? ` · ${u.department}` : ''}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                {currentUser?.role === 'admin' && (
                  <>
                    <button onClick={() => setModal(u)} className="p-1.5 text-gray-300 hover:text-gray-600 rounded transition-colors"><Pencil size={14} /></button>
                    {u.id !== currentUser.id && (
                      <button onClick={() => deleteUser(u.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors"><Trash2 size={14} /></button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {modal !== null && (
        <UserModal
          user={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'member',
    department: user?.department ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const body = { ...form };
      if (!body.password) delete body.password;
      if (user) await api.put(`/users/${user.id}`, body);
      else await api.post('/users', body);
      onSave();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal title={user ? 'Edit Person' : 'Add Person'} onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <Field label="Full Name *">
          <input className="input" value={form.name} onChange={f('name')} required autoFocus />
        </Field>
        <Field label="Email *">
          <input type="email" className="input" value={form.email} onChange={f('email')} required />
        </Field>
        <Field label={user ? 'New Password (leave blank to keep)' : 'Password *'}>
          <input type="password" className="input" value={form.password} onChange={f('password')} required={!user} autoComplete="new-password" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Role">
            <select className="input" value={form.role} onChange={f('role')}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Department">
            <input className="input" value={form.department} onChange={f('department')} placeholder="e.g. Finance" />
          </Field>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }) {
  return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>{children}</div>;
}
