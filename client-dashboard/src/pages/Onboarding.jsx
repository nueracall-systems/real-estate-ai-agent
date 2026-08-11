import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';

export default function Onboarding() {
  const [form, setForm] = useState({
    business_description: '',
    ai_tone: 'friendly',
    greeting_message: 'Namaste! Property ke baare mein jaankari chahiye?',
    working_hours_start: '09:00',
    working_hours_end: '19:00',
    ai_instructions: '',
  });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/client/profile', form);
      navigate('/whatsapp');
    } catch (err) {
      alert('Failed to save. Please try again.');
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-xl border border-cream-200">
        <h1 className="text-2xl font-bold text-indigo-700 mb-1">Let's set up your AI assistant</h1>
        <p className="text-sm text-gray-500 mb-6">This tells the AI how to talk to your customers on WhatsApp.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">About your business</label>
            <textarea
              rows={3}
              value={form.business_description}
              onChange={(e) => setForm({ ...form, business_description: e.target.value })}
              placeholder="e.g. We deal in 2-3BHK flats in Noida, mostly ready-to-move properties"
              className="w-full border border-cream-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI Tone</label>
            <select
              value={form.ai_tone}
              onChange={(e) => setForm({ ...form, ai_tone: e.target.value })}
              className="w-full border border-cream-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="friendly">Friendly</option>
              <option value="formal">Formal / Professional</option>
              <option value="persuasive">Persuasive / Sales-focused</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Greeting Message</label>
            <input
              value={form.greeting_message}
              onChange={(e) => setForm({ ...form, greeting_message: e.target.value })}
              className="w-full border border-cream-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Working Hours Start</label>
              <input
                type="time"
                value={form.working_hours_start}
                onChange={(e) => setForm({ ...form, working_hours_start: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Working Hours End</label>
              <input
                type="time"
                value={form.working_hours_end}
                onChange={(e) => setForm({ ...form, working_hours_end: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Special instructions for AI (optional)</label>
            <textarea
              rows={3}
              value={form.ai_instructions}
              onChange={(e) => setForm({ ...form, ai_instructions: e.target.value })}
              placeholder="e.g. Always mention we offer free legal paperwork help"
              className="w-full border border-cream-200 rounded-lg px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-accent-500 hover:bg-accent-600 text-indigo-900 font-medium py-2.5 rounded-lg transition"
          >
            {saving ? 'Saving...' : 'Continue to WhatsApp Setup →'}
          </button>
        </form>
      </div>
    </div>
  );
}