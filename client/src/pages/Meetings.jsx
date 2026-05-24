import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Users, Clock } from 'lucide-react';

const TYPES = ['team', 'department', 'one_on_one', 'all_hands'];
const STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [expanded, setExpanded] = useState({});
  const [modal, setModal] = useState(null);
  const [agendaModal, setAgendaModal] = useState(null); // { meetingId, item? }

  const load = useCallback(() =>
    Promise.all([api.get('/meetings'), api.get('/users')])
      .then(([m, u]) => { setMeetings(m); setUsers(u); })
      .finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);

  const deleteMeeting = async (id) => {
    if (!confirm('Delete this meeting?')) return;
    await api.delete(`/meetings/${id}`);
    load();
  };

  const deleteItem = async (meetingId, itemId) => {
    await api.delete(`/meetings/${meetingId}/agenda/${itemId}`);
    load();
  };

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const now = new Date();
  const displayed = meetings.filter(m => {
    const d = new Date(m.date);
    return tab === 'upcoming' ? d >= now || m.status === 'in_progress' : d < now && m.status !== 'in_progress';
  });

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Meetings</h2>
          <p className="text-gray-500 mt-1 text-sm">{meetings.length} total meetings</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-1.5">
          <Plus size={15} /> Schedule Meeting
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {['upcoming', 'past'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {displayed.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📅</div>
          <p>No {tab} meetings.</p>
        </div>
      )}

      <div className="space-y-3">
        {displayed.map(meeting => (
          <div key={meeting.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <button onClick={() => toggle(meeting.id)} className="mt-0.5 text-gray-300 hover:text-gray-500 shrink-0">
                  {expanded[meeting.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{meeting.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{new Date(meeting.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="flex items-center gap-1"><Clock size={11} /> {meeting.duration_minutes}min</span>
                        <span className="flex items-center gap-1"><Users size={11} /> {meeting.attendees?.length ?? 0}</span>
                        <span className="capitalize">{meeting.type.replace('_', ' ')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={meeting.status} />
                      <button onClick={() => setModal(meeting)} className="p-1.5 text-gray-300 hover:text-gray-600 rounded"><Pencil size={14} /></button>
                      <button onClick={() => deleteMeeting(meeting.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {expanded[meeting.id] && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-5 space-y-4">
                {meeting.attendees?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Attendees</h4>
                    <div className="flex flex-wrap gap-2">
                      {meeting.attendees.map(a => (
                        <span key={a.id} className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1">{a.name}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agenda</h4>
                    <button onClick={() => setAgendaModal({ meetingId: meeting.id })} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      <Plus size={11} /> Add item
                    </button>
                  </div>
                  {(meeting.agendaItems?.length ?? 0) === 0 ? (
                    <p className="text-sm text-gray-400">No agenda items yet.</p>
                  ) : (
                    <ol className="space-y-2">
                      {meeting.agendaItems.map((item, i) => (
                        <li key={item.id} className="bg-white rounded-lg border border-gray-100 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-gray-400 font-mono mt-0.5 shrink-0">{i + 1}.</span>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                                {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                                {item.duration_minutes && <p className="text-xs text-gray-400 mt-0.5">{item.duration_minutes} min</p>}
                                {item.notes && <div className="mt-2"><p className="text-xs font-medium text-gray-500 mb-0.5">Notes</p><p className="text-xs text-gray-700 whitespace-pre-wrap">{item.notes}</p></div>}
                                {item.decisions && <div className="mt-2"><p className="text-xs font-medium text-gray-500 mb-0.5">Decisions</p><p className="text-xs text-gray-700 whitespace-pre-wrap">{item.decisions}</p></div>}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => setAgendaModal({ meetingId: meeting.id, item })} className="p-1 text-gray-300 hover:text-gray-600"><Pencil size={12} /></button>
                              <button onClick={() => deleteItem(meeting.id, item.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {meeting.notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Meeting Notes</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{meeting.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {modal !== null && (
        <MeetingModal
          meeting={modal === 'new' ? null : modal}
          users={users}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
      {agendaModal !== null && (
        <AgendaItemModal
          meetingId={agendaModal.meetingId}
          item={agendaModal.item}
          onClose={() => setAgendaModal(null)}
          onSave={() => { setAgendaModal(null); load(); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    scheduled: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>{status.replace('_', ' ')}</span>;
}

function MeetingModal({ meeting, users, onClose, onSave }) {
  const [form, setForm] = useState({
    title: meeting?.title ?? '',
    type: meeting?.type ?? 'team',
    date: meeting?.date ? meeting.date.slice(0, 16) : '',
    duration_minutes: meeting?.duration_minutes ?? 60,
    facilitator_id: meeting?.facilitator_id ?? '',
    status: meeting?.status ?? 'scheduled',
    notes: meeting?.notes ?? '',
    attendees: meeting?.attendees?.map(a => a.id) ?? [],
  });
  const [saving, setSaving] = useState(false);
  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));
  const toggleAttendee = (id) => setForm(p => ({
    ...p, attendees: p.attendees.includes(id) ? p.attendees.filter(x => x !== id) : [...p.attendees, id]
  }));

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = { ...form, facilitator_id: form.facilitator_id || null, duration_minutes: parseInt(form.duration_minutes) };
      if (meeting) await api.put(`/meetings/${meeting.id}`, body);
      else await api.post('/meetings', body);
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <Modal title={meeting ? 'Edit Meeting' : 'Schedule Meeting'} onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title *">
          <input className="input" value={form.title} onChange={f('title')} required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <select className="input" value={form.type} onChange={f('type')}>
              {TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={f('status')}>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Date & Time *">
            <input type="datetime-local" className="input" value={form.date} onChange={f('date')} required />
          </Field>
          <Field label="Duration (minutes)">
            <input type="number" className="input" min={15} step={15} value={form.duration_minutes} onChange={f('duration_minutes')} />
          </Field>
          <Field label="Facilitator">
            <select className="input" value={form.facilitator_id} onChange={f('facilitator_id')}>
              <option value="">None</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Attendees">
          <div className="flex flex-wrap gap-2 mt-1">
            {users.map(u => (
              <label key={u.id} className={`flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${form.attendees.includes(u.id) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <input type="checkbox" className="sr-only" checked={form.attendees.includes(u.id)} onChange={() => toggleAttendee(u.id)} />
                {u.name}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Meeting Notes">
          <textarea className="input" rows={3} value={form.notes} onChange={f('notes')} placeholder="Notes, decisions, follow-ups…" />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AgendaItemModal({ meetingId, item, onClose, onSave }) {
  const [form, setForm] = useState({
    title: item?.title ?? '',
    description: item?.description ?? '',
    duration_minutes: item?.duration_minutes ?? '',
    notes: item?.notes ?? '',
    decisions: item?.decisions ?? '',
  });
  const [saving, setSaving] = useState(false);
  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = { ...form, duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null };
      if (item) await api.put(`/meetings/${meetingId}/agenda/${item.id}`, body);
      else await api.post(`/meetings/${meetingId}/agenda`, body);
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <Modal title={item ? 'Edit Agenda Item' : 'Add Agenda Item'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title *">
          <input className="input" value={form.title} onChange={f('title')} required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Description">
            <input className="input" value={form.description} onChange={f('description')} />
          </Field>
          <Field label="Duration (min)">
            <input type="number" className="input" min={1} value={form.duration_minutes} onChange={f('duration_minutes')} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="input" rows={3} value={form.notes} onChange={f('notes')} placeholder="Discussion notes…" />
        </Field>
        <Field label="Decisions">
          <textarea className="input" rows={2} value={form.decisions} onChange={f('decisions')} placeholder="Decisions made…" />
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
