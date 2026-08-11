import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const links = [
  { to: '/', label: 'Overview' },
  { to: '/clients', label: 'Clients & Billing' },
  { to: '/plans', label: 'Plans' },
];

export default function AdminSidebar() {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <aside className="w-64 bg-indigo-950 text-indigo-100 min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-indigo-800/60">
        <h1 className="text-lg font-bold text-white">Sales Agent AI</h1>
        <p className="text-xs text-indigo-300">Admin Control Panel</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive ? 'bg-indigo-600 text-white' : 'text-indigo-200 hover:bg-indigo-900'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-indigo-800/60">
        <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded-lg text-sm text-indigo-300 hover:bg-indigo-900">
          Logout
        </button>
      </div>
    </aside>
  );
}
