import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import api from '../lib/api.js';

export default function EmergencyBlock() {
 const [blocks, setBlocks] = useState([]);
 const [form, setForm] = useState({ start_time: '', end_time: '', reason: '', auto_reschedule: true });
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 load();
 }, []);

 async function load() {
 const res = await api.get('/emergency-blocks');
 setBlocks(res.data.blocks || []);
 }

 // datetime-local gives "YYYY-MM-DDTHH:mm" with NO timezone info. Sending
 // that raw to the backend let Postgres store it as if it were UTC,
 // silently shifting the block by 5.5 hours from what was actually typed
 // (IST is UTC+5:30) - this was the main reason blocks looked "broken".
 // We explicitly tag it as IST here so it's stored at the correct instant.
 function toISTIso(localDateTimeStr) {
 if (!localDateTimeStr) return localDateTimeStr;
 return new Date(`${localDateTimeStr}:00+05:30`).toISOString();
 }

 async function handleCreate(e) {
 e.preventDefault();
 setSaving(true);
 try {
 await api.post('/emergency-blocks', {
 ...form,
 start_time: toISTIso(form.start_time),
 end_time: toISTIso(form.end_time),
 });
 setForm({ start_time: '', end_time: '', reason: '', auto_reschedule: true });
 load();
 } catch (err) {
 alert(err.response?.data?.error || 'Failed to create block');
 }
 setSaving(false);
 }

 async function handleDeactivate(id) {
 await api.patch(`/emergency-blocks/${id}`, { is_active: false });
 load();
 }

 return (
 <Layout>
 <h1 className="text-2xl font-bold text-indigo-700 mb-2">Emergency Block (DND)</h1>
 <p className="text-gray-500 text-sm mb-6">
 Set a time window where the AI won't book new meetings. Any existing appointment in this window will be
 automatically flagged for reschedule.
 </p>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <div className="bg-white border border-cream-200 rounded-xl p-6">
 <h3 className="font-semibold text-gray-800 mb-4">Set a New Block</h3>
 <form onSubmit={handleCreate} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
 <input
 type="datetime-local"
 required
 value={form.start_time}
 onChange={(e) => setForm({ ...form, start_time: e.target.value })}
 className="w-full border border-cream-200 rounded-lg px-3 py-2"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
 <input
 type="datetime-local"
 required
 value={form.end_time}
 onChange={(e) => setForm({ ...form, end_time: e.target.value })}
 className="w-full border border-cream-200 rounded-lg px-3 py-2"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
 <input
 value={form.reason}
 onChange={(e) => setForm({ ...form, reason: e.target.value })}
 placeholder="e.g. Family function"
 className="w-full border border-cream-200 rounded-lg px-3 py-2"
 />
 </div>
 <label className="flex items-center gap-2 text-sm text-gray-700">
 <input
 type="checkbox"
 checked={form.auto_reschedule}
 onChange={(e) => setForm({ ...form, auto_reschedule: e.target.checked })}
 />
 Auto-flag existing appointments in this window for reschedule
 </label>
 <button
 type="submit"
 disabled={saving}
 className="w-full bg-accent-500 hover:bg-accent-600 text-indigo-900 font-medium py-2.5 rounded-lg"
 >
 {saving ? 'Saving...' : 'Set Block'}
 </button>
 </form>
 </div>

 <div className="bg-white border border-cream-200 rounded-xl p-6">
 <h3 className="font-semibold text-gray-800 mb-4">Active & Past Blocks</h3>
 {blocks.length === 0 ? (
 <p className="text-sm text-gray-400">No blocks set yet.</p>
 ) : (
 <ul className="space-y-3">
 {blocks.map((b) => (
 <li key={b.id} className="border border-cream-100 rounded-lg p-3 text-sm">
 <p className="font-medium text-gray-800">
 {new Date(b.start_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
 {' → '}
 {new Date(b.end_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
 </p>
 {b.reason && <p className="text-gray-500 text-xs">{b.reason}</p>}
 <div className="flex items-center justify-between mt-1">
 <span className={`text-xs ${b.is_active ? 'text-green-600' : 'text-gray-400'}`}>
 {b.is_active ? '● Active' : '○ Inactive'}
 </span>
 {b.is_active && (
 <button onClick={() => handleDeactivate(b.id)} className="text-xs text-red-500 hover:underline">
 Deactivate
 </button>
 )}
 </div>
 </li>
 ))}
 </ul>
 )}
 </div>
 </div>
 </Layout>
 );
}