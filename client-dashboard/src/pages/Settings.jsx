import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import api from '../lib/api.js';

export default function Settings() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get('/client/me');
    setForm(res.data.profile || {});
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.patch('/client/profile', form);
      setSaved(true);
    } catch (err) {
      alert('Failed to save settings');
    }
    setSaving(false);
  }

  if (!form) return <Layout><p className="text-gray-400">Loading...</p></Layout>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-indigo-700 mb-6">Settings</h1>

      <div className="bg-white border border-cream-200 rounded-xl p-6 max-w-xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Description</label>
            <textarea
              rows={3}
              value={form.business_description || ''}
              onChange={(e) => setForm({ ...form, business_description: e.target.value })}
              className="w-full border border-cream-200 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI Tone</label>
            <select
              value={form.ai_tone || 'friendly'}
              onChange={(e) => setForm({ ...form, ai_tone: e.target.value })}
              className="w-full border border-cream-200 rounded-lg px-3 py-2"
            >
              <option value="friendly">Friendly</option>
              <option value="formal">Formal / Professional</option>
              <option value="persuasive">Persuasive / Sales-focused</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Greeting Message</label>
            <input
              value={form.greeting_message || ''}
              onChange={(e) => setForm({ ...form, greeting_message: e.target.value })}
              className="w-full border border-cream-200 rounded-lg px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Working Hours Start</label>
              <input
                type="time"
                value={form.working_hours_start || '09:00'}
                onChange={(e) => setForm({ ...form, working_hours_start: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Working Hours End</label>
              <input
                type="time"
                value={form.working_hours_end || '19:00'}
                onChange={(e) => setForm({ ...form, working_hours_end: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions for AI</label>
            <textarea
              rows={3}
              value={form.ai_instructions || ''}
              onChange={(e) => setForm({ ...form, ai_instructions: e.target.value })}
              className="w-full border border-cream-200 rounded-lg px-3 py-2"
            />
          </div>

          {saved && <p className="text-green-600 text-sm">Settings saved!</p>}

          <button type="submit" disabled={saving} className="w-full bg-accent-500 hover:bg-accent-600 text-indigo-900 font-medium py-2.5 rounded-lg">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </Layout>
  );
}