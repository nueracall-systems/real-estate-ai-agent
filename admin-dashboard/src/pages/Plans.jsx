import { useEffect, useState } from 'react';
import api from '../lib/api.js';

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({ name: '', price: '', duration_months: 1, description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get('/admin/plans');
    setPlans(res.data.plans || []);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/plans', form);
      setForm({ name: '', price: '', duration_months: 1, description: '' });
      load();
    } catch (err) {
      alert('Failed to create plan');
    }
    setSaving(false);
  }

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this plan? Existing clients keep their pricing.')) return;
    await api.delete(`/admin/plans/${id}`);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Plans</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-cream-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-800 mb-4">New Plan</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Plan Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Price (₹)</label>
              <input
                required
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Billing Cycle (months)</label>
              <input
                required
                type="number"
                value={form.duration_months}
                onChange={(e) => setForm({ ...form, duration_months: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium">
              {saving ? 'Saving...' : 'Create Plan'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
          {plans.map((p) => (
            <div key={p.id} className={`bg-white border rounded-xl p-5 ${p.is_active ? 'border-cream-200' : 'border-gray-200 opacity-50'}`}>
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-gray-800">{p.name}</h3>
                {p.is_active && (
                  <button onClick={() => handleDeactivate(p.id)} className="text-xs text-red-500 hover:underline">
                    Deactivate
                  </button>
                )}
              </div>
              <p className="text-2xl font-bold text-indigo-700 mt-1">₹{p.price.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-400">every {p.duration_months} month(s)</p>
              {p.description && <p className="text-sm text-gray-500 mt-2">{p.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
