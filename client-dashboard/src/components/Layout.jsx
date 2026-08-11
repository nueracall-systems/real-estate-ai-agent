import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Sidebar from './Sidebar.jsx';
import api from '../lib/api.js';

export default function Layout({ children }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [waStatus, setWaStatus] = useState(null); // 'connected' | 'reconnecting' | 'needs_reconnect' | 'disconnected' | null
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!authorized) return;
    checkWaStatus();
    const interval = setInterval(checkWaStatus, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [authorized]);

  async function checkWaStatus() {
    try {
      const res = await api.get('/whatsapp/status');
      setWaStatus(res.data?.dbStatus?.whatsapp_status || (res.data?.connected ? 'connected' : 'disconnected'));
    } catch (err) {
      // don't let a status-check failure break the page
    }
  }

  async function checkAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.session.user.id).single();
    setAuthorized(profile?.role === 'client');
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <p className="text-indigo-600">Loading...</p>
      </div>
    );
  }

  if (!authorized) return <Navigate to="/login" replace />;

  const showBanner = waStatus === 'needs_reconnect' || waStatus === 'disconnected' || waStatus === 'reconnecting';

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-cream-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {showBanner && (
          <div
            className={`px-6 py-2.5 text-sm font-medium flex items-center justify-between ${
              waStatus === 'reconnecting' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
            }`}
          >
            <span>
              {waStatus === 'reconnecting'
                ? 'WhatsApp reconnect ho raha hai... AI thodi der ke liye replies nahi bhej payega.'
                : 'WhatsApp disconnected hai - AI leads ko reply nahi kar raha! Turant reconnect karein.'}
            </span>
            {waStatus !== 'reconnecting' && (
              <button
                onClick={() => navigate('/whatsapp')}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ml-4"
              >
                Reconnect Now
              </button>
            )}
          </div>
        )}
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}