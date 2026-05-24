import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

const ITEM_TYPES = ['discussion', 'update', 'feedback', 'action', 'recognition'];

export default function OneOnOnes() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [modal, setModal] = useState(null);
  const [itemModal, setItemModal] = useState(null);

  const load = useCallback(() =>
    Promise.all([api.get('/one-on-ones'), api.get('/users')])
      .then(([r, u]) => { setRecords(r); setUsers(u); })
      .finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);

  const deleteRecord = async (id) => {
    if (!confirm('Delete this 1-on-1?')) return;
    await api.delete(`/one-on-ones/${id}`);
    load();
  };

  const deleteItem = async (ooId, itemId) => {
    await api.delete(`/one-on-ones/${ooId}/items/${itemId}`);
    load();
  };

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const otherPerson = (oo) => oo.manager_id === user?.id ? oo.report_name : oo.manager_name;
  const role = (oo) => oo.manager_id === user?.id ? 'Manager' : 'Report';

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">1-on-1s</h2>
          <p className="text-gray-500 mt-1 text-sm">{records.length} session{records.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-1.5">
          <Plus size={15} /> Schedule 1-on-1
        </button>
      </div>

      {records.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🤝</div>
          <p>No 1-on-1s scheduled yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {records.map(oo => (
          <div key={oo.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <button onClick={() => toggle(oo.id)} className="mt-0.5 text-gray-300 hover:text-gray-500 shrink-0">
                  {expanded[oo.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {oo.manager_name} & {oo.report_name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{new Date(oo.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span>Your role: {role(oo)}</span>
                        <span className="capitalize">{oo.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setModal(oo)} className="p-1.5 text-gray-300 hover:text-gray-600 rounded"><Pencil size={14} /></button>
                      <button onClick={() => deleteRecord(oo.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {expanded[oo.id] && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agenda / Topics</h4>
                    <button onClick={() => setItemModal({ ooId: oo.id })} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      <Plus size={11} /> Add topic
                    </button>
                  </div>
                  {oo.items.length === 0 ? (
                    <p className="text-sm text-gray-400">No topics added yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {oo.items.map(item => (
                        <li key={item.id} className="bg-white rounded-lg border border-gray-100 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className={`mt-0.5 shrink-0 text-xs px-1.5 py-0.5 rounded font-medium capitalize ${typeStyle(item.type)}`}>{item.type}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                                {item.notes && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{item.notes}</p>}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => setItemModal({ ooId: oo.id, item })} className="p-1 text-gray-300 hover:text-gray-600"><Pencil size={12} /></button>
                              <button onClick={() => deleteItem(oo.id, item.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {oo.notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Session Notes</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{oo.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {modal !== null && (
        <OOModal
          record={modal === 'new' ? null : modal}
          users={users}
          currentUser={user}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
      {itemModal !== null && (
        <OOItemModal
          ooId={itemModal.ooId}
          item={itemModal.item}
          onClose={() => setItemModal(null)}
          onSave={() => { setItemModal(null); load(); }}
        />
      )}
    </div>
  );
}

function typeStyle(t) {
  const map = {
    discussion: 'bg-blue-100 text-blue-700',
    update: 'bg-indigo-100 text-indigo-700',
    feedback: 'bg-purple-100 text-purple-700',
    action: 'bg-amber-100 text-amber-700',
    recognition: 'bg-green-100 text-green-700',
  };
  return map[t] ?? 'bg-gray-100 text-gray-600';
}

function OOModal({ record, users, currentUser, onClose, onSave }) {
  const [form, setForm] = useState({
    manager_id: record?.manager_id ?? currentUser?.id ?? '',
    report_id: record?.report_id ?? '',
    date: record?.date ? record.date.slice(0, 16) : '',
    status: record?.status ?? 'scheduled',
    notes: record?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (record) await api.put(`/one-on-ones/${record.id}`, form);
      else await api.post('/one-on-ones', form);
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <Modal title={record ? 'Edit 1-on-1' : 'Schedule 1-on-1'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Manager *">
            <select className="input" value={form.manager_id} onChange={f('manager_id')} required>
              <option value="">Select…</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Report *">
            <select className="input" value={form.report_id} onChange={f('report_id')} required>
              <option value="">Select…</option>
              {users.filter(u => u.id !== parseInt(form.manager_id)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Date & Time *">
            <input type="datetime-local" className="input" value={form.date} onChange={f('date')} required />
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={f('status')}>
              {['scheduled', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="input" rows={3} value={form.notes} onChange={f('notes')} placeholder="Session notes…" />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function OOItemModal({ ooId, item, onClose, onSave }) {
  const [form, setForm] = useState({ title: item?.title ?? '', type: item?.type ?? 'discussion', notes: item?.notes ?? '' });
  const [saving, setSaving] = useState(false);
  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (item) await api.put(`/one-on-ones/${ooId}/items/${item.id}`, form);
      else await api.post(`/one-on-ones/${ooId}/items`, form);
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <Modal title={item ? 'Edit Topic' : 'Add Topic'} onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title *">
          <input className="input" value={form.title} onChange={f('title')} required autoFocus />
        </Field>
        <Field label="Type">
          <select className="input" value={form.type} onChange={f('type')}>
            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Notes">
          <textarea className="input" rows={3} value={form.notes} onChange={f('notes')} />
        </Field>
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
