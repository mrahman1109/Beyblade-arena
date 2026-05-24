import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { LayoutDashboard, Target, CheckSquare, Users, Calendar, UserCheck, LogOut } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/strategy', label: 'Strategy', icon: Target },
  { to: '/actions', label: 'Actions', icon: CheckSquare },
  { to: '/meetings', label: 'Meetings', icon: Calendar },
  { to: '/one-on-ones', label: '1-on-1s', icon: UserCheck },
  { to: '/people', label: 'People', icon: Users },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-60 bg-indigo-950 text-white flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-indigo-900">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xl">🎯</span>
            <h1 className="text-base font-bold tracking-tight">Strategy Hub</h1>
          </div>
          <p className="text-indigo-400 text-xs pl-7">3C Energy Group</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-700 text-white' : 'text-indigo-300 hover:bg-indigo-900 hover:text-white'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-indigo-900">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-indigo-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-indigo-400 hover:text-white transition-colors"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
