import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'on_track', label: 'On Track', color: 'bg-green-100 text-green-700' },
  { value: 'at_risk', label: 'At Risk', color: 'bg-amber-100 text-amber-700' },
  { value: 'behind', label: 'Behind', color: 'bg-red-100 text-red-700' },
  { value: 'completed', label: 'Completed', color: 'bg-gray-100 text-gray-500' },
];

const statusStyle = (s) => STATUS_OPTIONS.find(o => o.value === s)?.color ?? 'bg-gray-100 text-gray-500';
const statusLabel = (s) => STATUS_OPTIONS.find(o => o.value === s)?.label ?? s;

export default function Strategy() {
  const [goals, setGoals] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [goalModal, setGoalModal] = useState(null); // null | 'new' | goal object
  const [krModal, setKRModal] = useState(null);     // null | { goalId, kr? }

  const load = useCallback(() =>
    Promise.all([api.get('/goals'), api.get('/users')])
      .then(([g, u]) => { setGoals(g); setUsers(u); })
      .finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);

  const deleteGoal = async (id) => {
    if (!confirm('Delete this goal and all its key results?')) return;
    await api.delete(`/goals/${id}`);
    load();
  };

  const deleteKR = async (goalId, krId) => {
    if (!confirm('Delete this key result?')) return;
    await api.delete(`/goals/${goalId}/key-results/${krId}`);
    load();
  };

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Strategy</h2>
          <p className="text-gray-500 mt-1 text-sm">{goals.length} strategic goal{goals.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setGoalModal('new')} className="btn-primary flex items-center gap-1.5">
          <Plus size={15} /> Add Goal
        </button>
      </div>

      {goals.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🎯</div>
          <p>No strategic goals yet. Add your first goal to get started.</p>
        </div>
      )}

      <div className="space-y-3">
        {goals.map(goal => (
          <div key={goal.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <button onClick={() => toggle(goal.id)} className="mt-0.5 text-gray-300 hover:text-gray-500 transition-colors shrink-0">
                  {expanded[goal.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                      {goal.description && <p className="text-sm text-gray-500 mt-0.5">{goal.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyle(goal.status)}`}>{statusLabel(goal.status)}</span>
                      <button onClick={() => setGoalModal(goal)} className="p-1.5 text-gray-300 hover:text-gray-600 rounded transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => deleteGoal(goal.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${goal.progress}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-600 tabular-nums w-10 text-right">{goal.progress}%</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                    {goal.owner_name && <span>Owner: {goal.owner_name}</span>}
                    {goal.target_date && <span>Due: {goal.target_date}</span>}
                    <span>{goal.keyResults?.length || 0} key result{goal.keyResults?.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </div>

            {expanded[goal.id] && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-5 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">Key Results</h4>
                  <button onClick={() => setKRModal({ goalId: goal.id })} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    <Plus size={12} /> Add KR
                  </button>
                </div>
                {(goal.keyResults?.length ?? 0) === 0 ? (
                  <p className="text-sm text-gray-400">No key results. Add one to track measurable outcomes.</p>
                ) : (
                  <ul className="space-y-3">
                    {goal.keyResults.map(kr => {
                      const pct = Math.min(100, Math.round((kr.current_value / kr.target_value) * 100));
                      return (
                        <li key={kr.id} className="bg-white rounded-lg border border-gray-100 p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-sm text-gray-800 font-medium">{kr.title}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-gray-500 tabular-nums">
                                {kr.current_value} / {kr.target_value}{kr.unit ? ` ${kr.unit}` : ''}
                              </span>
                              <button onClick={() => setKRModal({ goalId: goal.id, kr })} className="p-1 text-gray-300 hover:text-gray-600 rounded"><Pencil size={12} /></button>
                              <button onClick={() => deleteKR(goal.id, kr.id)} className="p-1 text-gray-300 hover:text-red-500 rounded"><Trash2 size={12} /></button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {goalModal !== null && (
        <GoalModal
          goal={goalModal === 'new' ? null : goalModal}
          users={users}
          onClose={() => setGoalModal(null)}
          onSave={() => { setGoalModal(null); load(); }}
        />
      )}
      {krModal !== null && (
        <KRModal
          goalId={krModal.goalId}
          kr={krModal.kr}
          onClose={() => setKRModal(null)}
          onSave={() => { setKRModal(null); load(); }}
        />
      )}
    </div>
  );
}

function GoalModal({ goal, users, onClose, onSave }) {
  const [form, setForm] = useState({
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    owner_id: goal?.owner_id ?? '',
    status: goal?.status ?? 'on_track',
    progress: goal?.progress ?? 0,
    target_date: goal?.target_date ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const body = { ...form, owner_id: form.owner_id || null, progress: parseInt(form.progress) };
      if (goal) await api.put(`/goals/${goal.id}`, body);
      else await api.post('/goals', body);
      onSave();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal title={goal ? 'Edit Goal' : 'New Strategic Goal'} onClose={onClose}>
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
          <Field label="Status">
            <select className="input" value={form.status} onChange={f('status')}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Progress (%)">
            <input type="number" className="input" min={0} max={100} value={form.progress} onChange={f('progress')} />
          </Field>
          <Field label="Target Date">
            <input type="date" className="input" value={form.target_date} onChange={f('target_date')} />
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

function KRModal({ goalId, kr, onClose, onSave }) {
  const [form, setForm] = useState({ title: kr?.title ?? '', current_value: kr?.current_value ?? 0, target_value: kr?.target_value ?? 100, unit: kr?.unit ?? '' });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (kr) await api.put(`/goals/${goalId}/key-results/${kr.id}`, form);
      else await api.post(`/goals/${goalId}/key-results`, form);
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <Modal title={kr ? 'Edit Key Result' : 'Add Key Result'} onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title *">
          <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required autoFocus />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Current">
            <input type="number" className="input" value={form.current_value} onChange={e => setForm(p => ({ ...p, current_value: parseFloat(e.target.value) || 0 }))} />
          </Field>
          <Field label="Target">
            <input type="number" className="input" value={form.target_value} onChange={e => setForm(p => ({ ...p, target_value: parseFloat(e.target.value) || 0 }))} />
          </Field>
          <Field label="Unit">
            <input className="input" placeholder="%, $…" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} />
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
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
