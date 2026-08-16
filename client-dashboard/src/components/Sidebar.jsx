import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import ThemeToggle from './ThemeToggle.jsx';
import api from '../lib/api.js';

const links = [
  { to: '/', label: 'Home' },
  { to: '/whatsapp', label: 'WhatsApp Connect' },
  { to: '/properties', label: 'Properties' },
  { to: '/leads', label: 'Leads / Inbox' },
  { to: '/conversations', label: 'All Conversations' },
  { to: '/quick-send', label: 'Quick Send' },
  { to: '/bulk-send', label: 'Bulk Send' },
  { to: '/emergency-block', label: 'Emergency Block' },
  { to: '/appointments', label: 'Appointments' },
  { to: '/templates', label: 'Templates' },
  { to: '/questions', label: 'Questions' },
  { to: '/settings', label: 'Settings' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState({ businessName: '', email: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email || '';
      let businessName = '';
      try {
        const res = await api.get('/client/me');
        businessName = res.data?.client?.business_name || '';
      } catch {
        // profile fetch failing isn't critical - sidebar still works without it
      }
      setProfile({ businessName, email });
    } catch {
      // not critical if this fails - sidebar still works without it
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  const currentLabel = links.find((l) => (l.to === '/' ? location.pathname === '/' : location.pathname.startsWith(l.to)))?.label || 'Menu';
  const initial = (profile.businessName || profile.email || 'A').charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile top bar - only visible below md breakpoint */}
      <div className="md:hidden sticky top-0 z-30 bg-indigo-950 text-white flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 -ml-2 rounded-lg hover:bg-indigo-900"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="text-sm font-semibold truncate">{currentLabel}</span>
        <span className="w-8" /> {/* spacer to keep title centered */}
      </div>

      {/* Backdrop when mobile drawer is open */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar: fixed drawer on mobile (slides in), static column on desktop */}
      <aside
        className={`fixed md:static top-0 left-0 h-full md:h-auto md:min-h-screen w-72 md:w-64 bg-indigo-950 text-indigo-100 flex flex-col z-50 transform transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="px-5 py-6 border-b border-indigo-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-accent-500 text-indigo-900 flex items-center justify-center font-bold text-lg flex-shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{profile.businessName || 'Sales Agent AI'}</p>
              <p className="text-xs text-indigo-300 truncate">{profile.email || 'Client Dashboard'}</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="md:hidden p-1.5 rounded-lg hover:bg-indigo-900 flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive ? 'bg-accent-500 text-indigo-900' : 'text-indigo-200 hover:bg-indigo-900'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-indigo-800/60 space-y-1">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-indigo-300 hover:bg-indigo-900"
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}