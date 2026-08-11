import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import api from '../lib/api.js';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', category: 'general' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get('/templates');
    setTemplates(res.data.templates || []);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/templates', form);
      setForm({ title: '', content: '', category: 'general' });
      load();
    } catch (err) {
      alert('Failed to save template');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this template?')) return;
    await api.delete(`/templates/${id}`);
    load();
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-indigo-700 mb-6">Message Templates</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-cream-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-800 mb-4">New Template</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2"
              >
                <option value="general">General</option>
                <option value="follow_up">Follow-up</option>
                <option value="site_visit">Site Visit</option>
                <option value="price_update">Price Update</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message Content</label>
              <textarea
                required
                rows={4}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2"
              />
            </div>
            <button type="submit" disabled={saving} className="w-full bg-accent-500 hover:bg-accent-600 text-indigo-900 font-medium py-2.5 rounded-lg">
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </form>
        </div>

        <div className="bg-white border border-cream-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Saved Templates</h3>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-400">No templates yet.</p>
          ) : (
            <ul className="space-y-3">
              {templates.map((t) => (
                <li key={t.id} className="border border-cream-100 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-gray-800 text-sm">{t.title}</p>
                    <button onClick={() => handleDelete(t.id)} className="text-red-500 text-xs hover:underline">
                      Delete
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-1">{t.category}</p>
                  <p className="text-sm text-gray-600">{t.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}