import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, CheckCircle2, Circle, Clock } from 'lucide-react';

const STATUS = [
  { value: 'todo', label: 'To Do', icon: Circle, color: 'text-gray-400' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-blue-500' },
  { value: 'done', label: 'Done', icon: CheckCircle2, color: 'text-green-500' },
];
const PRIORITY = [
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-600' },
];
const priorityStyle = (p) => PRIORITY.find(x => x.value === p)?.color ?? '';

export default function Actions() {
  const { user } = useAuth();
  const [actions, setActions] = useState([]);
  const [users, setUsers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', owner: '' });
  const [modal, setModal] = useState(null); // null | 'new' | action

  const load = useCallback(() =>
    Promise.all([api.get('/actions'), api.get('/users'), api.get('/goals')])
      .then(([a, u, g]) => { setActions(a); setUsers(u); setGoals(g); })
      .finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (action, status) => {
    await api.put(`/actions/${action.id}`, { status });
    load();
  };

  const deleteAction = async (id) => {
    if (!confirm('Delete this action?')) return;
    await api.delete(`/actions/${id}`);
    load();
  };

  const filtered = actions.filter(a => {
    if (filter.status && a.status !== filter.status) return false;
    if (filter.owner === 'me' && a.owner_id !== user?.id) return false;
    if (filter.owner && filter.owner !== 'me' && a.owner_id !== parseInt(filter.owner)) return false;
    return true;
  });

  const grouped = STATUS.reduce((acc, s) => {
    acc[s.value] = filtered.filter(a => a.status === s.value);
    return acc;
  }, {});

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Actions</h2>
          <p className="text-gray-500 mt-1 text-sm">{actions.filter(a => a.status !== 'done').length} open actions</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-1.5">
          <Plus size={15} /> Add Action
        </button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <select className="input w-auto text-sm" value={filter.status} onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}>
          <option value="">All statuses</option>
          {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="input w-auto text-sm" value={filter.owner} onChange={e => setFilter(p => ({ ...p, owner: e.target.value }))}>
          <option value="">All owners</option>
          <option value="me">Assigned to me</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {(filter.status || filter.owner) && (
          <button onClick={() => setFilter({ status: '', owner: '' })} className="text-sm text-indigo-600 hover:text-indigo-800">Clear</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {STATUS.map(({ value, label, icon: Icon, color }) => (
          <div key={value} className="bg-gray-100/70 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon size={16} className={color} />
              <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
              <span className="ml-auto text-xs text-gray-400 bg-white rounded-full px-2 py-0.5">{grouped[value].length}</span>
            </div>
            <div className="space-y-2">
              {grouped[value].length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No actions</p>
              )}
              {grouped[value].map(action => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onStatusChange={(s) => updateStatus(action, s)}
                  onEdit={() => setModal(action)}
                  onDelete={() => deleteAction(action.id)}
                  statuses={STATUS}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {modal !== null && (
        <ActionModal
          action={modal === 'new' ? null : modal}
          users={users}
          goals={goals}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function ActionCard({ action, onStatusChange, onEdit, onDelete, statuses }) {
  const isOverdue = action.due_date && new Date(action.due_date + 'T00:00:00') < new Date() && action.status !== 'done';
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 hover:border-indigo-200 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-gray-900 leading-snug">{action.title}</p>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="p-0.5 text-gray-300 hover:text-gray-600 transition-colors"><Pencil size={12} /></button>
          <button onClick={onDelete} className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${['high','medium','low'].includes(action.priority) ? (['bg-red-100 text-red-700','bg-amber-100 text-amber-700','bg-gray-100 text-gray-600'][['high','medium','low'].indexOf(action.priority)]) : ''}`}>
          {action.priority}
        </span>
        {action.owner_name && <span className="text-xs text-gray-400">{action.owner_name}</span>}
        {action.due_date && (
          <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {isOverdue ? 'Overdue · ' : ''}{action.due_date}
          </span>
        )}
      </div>
      {action.goal_title && <p className="text-xs text-indigo-500 mt-1 truncate">↗ {action.goal_title}</p>}
      <div className="mt-2 pt-2 border-t border-gray-50">
        <select
          className="text-xs border-0 bg-transparent text-gray-500 cursor-pointer focus:outline-none w-full"
          value={action.status}
          onChange={e => onStatusChange(e.target.value)}
        >
          {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function ActionModal({ action, users, goals, onClose, onSave }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: action?.title ?? '',
    description: action?.description ?? '',
    owner_id: action?.owner_id ?? user?.id ?? '',
    goal_id: action?.goal_id ?? '',
    due_date: action?.due_date ?? '',
    status: action?.status ?? 'todo',
    priority: action?.priority ?? 'medium',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const body = { ...form, owner_id: form.owner_id || null, goal_id: form.goal_id || null };
      if (action) await api.put(`/actions/${action.id}`, body);
      else await api.post('/actions', body);
      onSave();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal title={action ? 'Edit Action' : 'New Action'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <Field label="Title *">
          <input className="input" value={form.title} onChange={f('title')} required autoFocus />
        </Field>
        <Field label="Description">
          <textarea className="input" rows={2} value={form.description} onChange={f('description')} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Owner">
            <select className="input" value={form.owner_id} onChange={f('owner_id')}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" value={form.priority} onChange={f('priority')}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={f('status')}>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </Field>
          <Field label="Due Date">
            <input type="date" className="input" value={form.due_date} onChange={f('due_date')} />
          </Field>
          <Field label="Linked Goal" className="col-span-2">
            <select className="input" value={form.goal_id} onChange={f('goal_id')}>
              <option value="">None</option>
              {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
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
