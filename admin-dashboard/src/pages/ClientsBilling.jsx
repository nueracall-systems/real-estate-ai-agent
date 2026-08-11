import { useEffect, useState } from 'react';
import api from '../lib/api.js';

export default function ClientsBilling() {
 const [clients, setClients] = useState([]);
 const [plans, setPlans] = useState([]);
 const [loading, setLoading] = useState(true);
 const [showAddModal, setShowAddModal] = useState(false);
 const [newAccessCode, setNewAccessCode] = useState(null);
 const [paymentClient, setPaymentClient] = useState(null);

 useEffect(() => {
 loadAll();
 }, []);

 async function loadAll() {
 setLoading(true);
 try {
 const [clientsRes, plansRes] = await Promise.all([api.get('/admin/dashboard-stats'), api.get('/admin/plans')]);
 setClients(clientsRes.data.clients || []);
 setPlans(plansRes.data.plans || []);
 } catch (err) {
 console.error(err);
 }
 setLoading(false);
 }

 async function toggleStatus(client) {
 const newStatus = client.status === 'active' ? 'suspended' : 'active';
 await api.patch(`/admin/clients/${client.id}`, { status: newStatus });
 loadAll();
 }

 async function removeClient(client) {
 if (!confirm(`Remove ${client.business_name}? This cannot be undone.`)) return;
 await api.delete(`/admin/clients/${client.id}`);
 loadAll();
 }

 const statusBadge = {
 paid: 'bg-emerald-100 text-emerald-700',
 due: 'bg-amber-100 text-amber-700',
 overdue: 'bg-rose-100 text-rose-700',
 };

 return (
 <div>
 <div className="flex items-center justify-between mb-6">
 <h1 className="text-2xl font-bold text-gray-800">Clients & Billing</h1>
 <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
 + Add Client
 </button>
 </div>

 <div className="bg-white rounded-xl border border-cream-200 overflow-hidden overflow-x-auto">
 {loading ? (
 <p className="p-6 text-gray-500">Loading...</p>
 ) : clients.length === 0 ? (
 <p className="p-6 text-gray-500">No clients yet.</p>
 ) : (
 <table className="w-full text-sm">
 <thead className="bg-cream-100 text-gray-600 text-left">
 <tr>
 <th className="px-4 py-3">Business</th>
 <th className="px-4 py-3">Access Code</th>
 <th className="px-4 py-3">Status</th>
 <th className="px-4 py-3">Plan Price</th>
 <th className="px-4 py-3">Next Due</th>
 <th className="px-4 py-3">Payment</th>
 <th className="px-4 py-3">Actions</th>
 </tr>
 </thead>
 <tbody>
 {clients.map((c) => (
 <tr key={c.id} className="border-t border-cream-100">
 <td className="px-4 py-3 font-medium text-gray-800">
 {c.business_name}
 <br />
 <span className="text-xs text-gray-400">{c.contact_name}</span>
 </td>
 <td className="px-4 py-3">
 <code className="bg-cream-100 px-2 py-1 rounded text-xs">{c.access_code}</code>
 </td>
 <td className="px-4 py-3">
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
 {c.status}
 </span>
 </td>
 <td className="px-4 py-3 text-gray-600">₹{c.monthly_price?.toLocaleString('en-IN')}</td>
 <td className="px-4 py-3 text-gray-600">
 {c.next_due_date ? new Date(c.next_due_date).toLocaleDateString('en-IN') : '—'}
 {c.daysUntilDue !== null && (
 <div className="text-xs text-gray-400">
 {c.daysUntilDue < 0 ? `${Math.abs(c.daysUntilDue)}d overdue` : `in ${c.daysUntilDue}d`}
 </div>
 )}
 </td>
 <td className="px-4 py-3">
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge[c.computedStatus] || ''}`}>{c.computedStatus}</span>
 </td>
 <td className="px-4 py-3 space-x-2 whitespace-nowrap">
 <button onClick={() => setPaymentClient(c)} className="text-indigo-600 hover:underline text-xs">
 Record Payment
 </button>
 <button onClick={() => toggleStatus(c)} className="text-gray-500 hover:underline text-xs">
 {c.status === 'active' ? 'Suspend' : 'Activate'}
 </button>
 <button onClick={() => removeClient(c)} className="text-red-500 hover:underline text-xs">
 Remove
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>

 {showAddModal && (
 <AddClientModal
 plans={plans}
 onClose={() => {
 setShowAddModal(false);
 setNewAccessCode(null);
 }}
 onCreated={(code) => setNewAccessCode(code)}
 newAccessCode={newAccessCode}
 onSaved={loadAll}
 />
 )}

 {paymentClient && <RecordPaymentModal client={paymentClient} onClose={() => setPaymentClient(null)} onSaved={loadAll} />}
 </div>
 );
}

function AddClientModal({ onClose, onCreated, newAccessCode, plans, onSaved }) {
 const [form, setForm] = useState({
 business_name: '',
 contact_name: '',
 phone: '',
 email: '',
 plan_id: '',
 monthly_price: 25000,
 billing_months: 1,
 });
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');

 function handlePlanChange(planId) {
 const plan = plans.find((p) => p.id === planId);
 setForm({
 ...form,
 plan_id: planId,
 monthly_price: plan ? plan.price : form.monthly_price,
 billing_months: plan ? plan.duration_months : form.billing_months,
 });
 }

 async function handleSubmit(e) {
 e.preventDefault();
 setSaving(true);
 setError('');
 try {
 const res = await api.post('/admin/clients', form);
 onCreated(res.data.access_code);
 onSaved();
 } catch (err) {
 setError(err.response?.data?.error || 'Failed to add client');
 }
 setSaving(false);
 }

 return (
 <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
 <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
 {newAccessCode ? (
 <div className="text-center">
 <h3 className="text-lg font-bold text-indigo-700 mb-2">Client Added! </h3>
 <p className="text-sm text-gray-600 mb-4">Share this access code with the client for their first login:</p>
 <div className="bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl py-4 mb-4">
 <span className="text-2xl font-mono font-bold text-indigo-700">{newAccessCode}</span>
 </div>
 <button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg">
 Done
 </button>
 </div>
 ) : (
 <>
 <h3 className="text-lg font-bold text-indigo-700 mb-4">Add New Client</h3>
 <form onSubmit={handleSubmit} className="space-y-3">
 <Input label="Business Name" value={form.business_name} onChange={(v) => setForm({ ...form, business_name: v })} required />
 <Input label="Contact Person" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} required />
 <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
 <Input label="Email (optional)" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />

 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
 <select
 value={form.plan_id}
 onChange={(e) => handlePlanChange(e.target.value)}
 className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm"
 >
 <option value="">Custom (no plan)</option>
 {plans.map((p) => (
 <option key={p.id} value={p.id}>
 {p.name} — ₹{p.price.toLocaleString('en-IN')} / {p.duration_months}mo
 </option>
 ))}
 </select>
 </div>

 <div className="grid grid-cols-2 gap-3">
 <Input label="Price (₹)" type="number" value={form.monthly_price} onChange={(v) => setForm({ ...form, monthly_price: v })} />
 <Input label="Billing Months" type="number" value={form.billing_months} onChange={(v) => setForm({ ...form, billing_months: v })} />
 </div>

 {error && <p className="text-red-600 text-sm">{error}</p>}

 <div className="flex gap-2 pt-2">
 <button type="button" onClick={onClose} className="flex-1 border border-cream-200 rounded-lg py-2 text-gray-600">
 Cancel
 </button>
 <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2">
 {saving ? 'Adding...' : 'Add Client'}
 </button>
 </div>
 </form>
 </>
 )}
 </div>
 </div>
 );
}

function RecordPaymentModal({ client, onClose, onSaved }) {
 const [amount, setAmount] = useState(client.monthly_price || 25000);
 const [months, setMonths] = useState(client.billing_months || 1);
 const [saving, setSaving] = useState(false);

 async function handleSubmit(e) {
 e.preventDefault();
 setSaving(true);
 try {
 await api.post(`/admin/clients/${client.id}/record-payment`, { amount, months_covered: months });
 onSaved();
 onClose();
 } catch (err) {
 alert('Failed to record payment');
 }
 setSaving(false);
 }

 return (
 <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
 <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
 <h3 className="text-lg font-bold text-indigo-700 mb-1">Record Payment</h3>
 <p className="text-sm text-gray-500 mb-4">{client.business_name}</p>
 <form onSubmit={handleSubmit} className="space-y-3">
 <Input label="Amount Received (₹)" type="number" value={amount} onChange={setAmount} required />
 <Input label="Months Covered" type="number" value={months} onChange={setMonths} required />
 <div className="flex gap-2 pt-2">
 <button type="button" onClick={onClose} className="flex-1 border border-cream-200 rounded-lg py-2 text-gray-600">
 Cancel
 </button>
 <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2">
 {saving ? 'Saving...' : 'Confirm'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}

function Input({ label, value, onChange, type = 'text', required = false }) {
 return (
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
 <input
 type={type}
 required={required}
 value={value}
 onChange={(e) => onChange(e.target.value)}
 className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
 />
 </div>
 );
}
