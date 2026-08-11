import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import api from '../lib/api.js';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'access_code' | 'set_password'
  const [accessCode, setAccessCode] = useState('');
  const [businessInfo, setBusinessInfo] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (loginErr) return setError(loginErr.message);
    navigate('/');
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-access-code', { access_code: accessCode });
      setBusinessInfo(res.data);
      setEmail(res.data.email || '');
      setMode('set_password');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid access code');
    }
    setLoading(false);
  }

  async function handleCompleteSignup(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      await api.post('/auth/complete-signup', { access_code: accessCode, email, password });
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
      if (loginErr) throw loginErr;
      navigate('/onboarding');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Signup failed');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-sm border border-cream-200">
        <h1 className="text-2xl font-bold text-indigo-700 mb-1">Welcome</h1>
        <p className="text-sm text-gray-500 mb-6">Your WhatsApp AI Sales Assistant</p>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Email" type="email" value={email} onChange={setEmail} />
            <Field label="Password" type="password" value={password} onChange={setPassword} />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <SubmitButton loading={loading} label="Login" />
            <p className="text-xs text-center text-gray-500">
              First time here?{' '}
              <button type="button" onClick={() => setMode('access_code')} className="text-indigo-600 font-medium">
                Use your access code
              </button>
            </p>
          </form>
        )}

        {mode === 'access_code' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <p className="text-sm text-gray-600">Enter the access code your agency gave you.</p>
            <Field label="Access Code" value={accessCode} onChange={(v) => setAccessCode(v.toUpperCase())} />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <SubmitButton loading={loading} label="Verify Code" />
            <p className="text-xs text-center text-gray-500">
              Already set up?{' '}
              <button type="button" onClick={() => setMode('login')} className="text-indigo-600 font-medium">
                Back to login
              </button>
            </p>
          </form>
        )}

        {mode === 'set_password' && (
          <form onSubmit={handleCompleteSignup} className="space-y-4">
            <p className="text-sm text-gray-600">
              Welcome, <strong>{businessInfo?.contact_name}</strong>! Set up your login for{' '}
              <strong>{businessInfo?.business_name}</strong>.
            </p>
            <Field label="Email" type="email" value={email} onChange={setEmail} />
            <Field label="Create Password" type="password" value={password} onChange={setPassword} />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <SubmitButton loading={loading} label="Create Account" />
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-cream-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

function SubmitButton({ loading, label }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-accent-500 hover:bg-accent-600 text-indigo-900 font-medium py-2 rounded-lg transition"
    >
      {loading ? 'Please wait...' : label}
    </button>
  );
}