import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Target, CheckSquare, Calendar, TrendingUp, ArrowRight } from 'lucide-react';

const STATUS_COLOR = {
  on_track: 'bg-green-100 text-green-700',
  at_risk: 'bg-amber-100 text-amber-700',
  behind: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-600',
};
const PRIORITY_COLOR = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState({ goals: [], actions: [], meetings: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/goals'), api.get('/actions'), api.get('/meetings')])
      .then(([goals, actions, meetings]) => setData({ goals, actions, meetings }))
      .finally(() => setLoading(false));
  }, []);

  const { goals, actions, meetings } = data;
  const myActions = actions.filter(a => a.owner_id === user?.id && a.status !== 'done');
  const openActions = actions.filter(a => a.status !== 'done');
  const upcoming = meetings
    .filter(m => m.status === 'scheduled' && new Date(m.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  const onTrack = goals.filter(g => g.status === 'on_track').length;
  const completed = goals.filter(g => g.status === 'completed').length;

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Good {timeOfDay()}, {user?.name?.split(' ')[0]}
        </h2>
        <p className="text-gray-500 mt-1 text-sm">Here's your strategy overview.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Target size={20} className="text-indigo-600" />} label="Strategic Goals" value={goals.length} sub={`${onTrack} on track`} />
        <StatCard icon={<CheckSquare size={20} className="text-indigo-600" />} label="Open Actions" value={openActions.length} sub={`${myActions.length} assigned to me`} />
        <StatCard icon={<Calendar size={20} className="text-indigo-600" />} label="Upcoming Meetings" value={upcoming.length} sub="scheduled" />
        <StatCard icon={<TrendingUp size={20} className="text-indigo-600" />} label="Goals Completed" value={completed} sub={`of ${goals.length} total`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="My Open Actions" link="/actions" linkLabel="All actions">
          {myActions.length === 0 ? (
            <Empty>No actions assigned to you.</Empty>
          ) : (
            <ul className="divide-y divide-gray-50">
              {myActions.slice(0, 7).map(a => (
                <li key={a.id} className="flex items-start gap-3 py-2.5">
                  <span className={`mt-0.5 shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLOR[a.priority]}`}>{a.priority}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 leading-snug">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.due_date ? `Due ${formatDate(a.due_date)}` : 'No due date'}
                      {a.goal_title ? ` · ${a.goal_title}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Upcoming Meetings" link="/meetings" linkLabel="All meetings">
          {upcoming.length === 0 ? (
            <Empty>No upcoming meetings scheduled.</Empty>
          ) : (
            <ul className="divide-y divide-gray-50">
              {upcoming.map(m => (
                <li key={m.id} className="flex items-start gap-3 py-2.5">
                  <div className="text-center shrink-0 w-10">
                    <div className="text-xs font-medium text-indigo-600 uppercase">{formatMonthDay(m.date).month}</div>
                    <div className="text-lg font-bold text-gray-900 leading-tight">{formatMonthDay(m.date).day}</div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{m.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{m.type.replace('_', ' ')} · {m.duration_minutes}min</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Strategy Status" link="/strategy" linkLabel="View strategy">
          {goals.length === 0 ? (
            <Empty>No strategic goals yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {goals.slice(0, 5).map(g => (
                <li key={g.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-900 truncate mr-2">{g.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLOR[g.status]}`}>
                      {g.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${g.progress}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{g.progress}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">{icon}<span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span></div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function Section({ title, link, linkLabel, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <Link to={link} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
          {linkLabel} <ArrowRight size={12} />
        </Link>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }) {
  return <p className="text-sm text-gray-400 py-4 text-center">{children}</p>;
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatMonthDay(dateStr) {
  const d = new Date(dateStr);
  return {
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
    day: d.getDate(),
  };
}
