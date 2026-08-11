import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import api from '../lib/api.js';

export default function QuickSend() {
 const [form, setForm] = useState({ name: '', phone: '', message: '' });
 const [sending, setSending] = useState(false);
 const [result, setResult] = useState(null);

 async function handleSend(e) {
 e.preventDefault();
 setSending(true);
 setResult(null);
 try {
 await api.post('/send/quick-send', form);
 setResult({ success: true, msg: 'Message sent successfully!' });
 setForm({ name: '', phone: '', message: '' });
 } catch (err) {
 setResult({ success: false, msg: err.response?.data?.error || 'Failed to send' });
 }
 setSending(false);
 }

 return (
 <Layout>
 <h1 className="text-2xl font-bold text-indigo-700 mb-2">Quick Send</h1>
 <p className="text-gray-500 text-sm mb-6">Send a one-off WhatsApp message to a single number instantly.</p>

 <div className="bg-white border border-cream-200 rounded-xl p-6 max-w-lg">
 <form onSubmit={handleSend} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
 <input
 value={form.name}
 onChange={(e) => setForm({ ...form, name: e.target.value })}
 className="w-full border border-cream-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (with country code)</label>
 <input
 required
 placeholder="919876543210"
 value={form.phone}
 onChange={(e) => setForm({ ...form, phone: e.target.value })}
 className="w-full border border-cream-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
 <textarea
 required
 rows={4}
 value={form.message}
 onChange={(e) => setForm({ ...form, message: e.target.value })}
 className="w-full border border-cream-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
 />
 </div>

 {result && (
 <p className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>{result.msg}</p>
 )}

 <button
 type="submit"
 disabled={sending}
 className="w-full bg-accent-500 hover:bg-accent-600 text-indigo-900 font-medium py-2.5 rounded-lg transition"
 >
 {sending ? 'Sending...' : 'Send Now'}
 </button>
 </form>
 </div>
 </Layout>
 );
}