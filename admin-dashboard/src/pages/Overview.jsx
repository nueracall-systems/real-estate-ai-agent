import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../lib/api.js';

export default function Overview() {
 const [stats, setStats] = useState(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 load();
 }, []);

 async function load() {
 setLoading(true);
 try {
 const res = await api.get('/admin/dashboard-stats');
 setStats(res.data);
 } catch (err) {
 console.error(err);
 }
 setLoading(false);
 }

 if (loading || !stats) return <p className="text-gray-400">Loading...</p>;

 const overdueClients = stats.clients.filter((c) => c.computedStatus === 'overdue' && c.status === 'active');
 const dueSoonClients = stats.clients.filter((c) => c.computedStatus === 'due' && c.status === 'active');
 const activeRevenue = stats.clients.filter((c) => c.status === 'active').reduce((s, c) => s + (c.monthly_price || 0), 0);
 const disconnectedClients = stats.clients.filter((c) => c.status === 'active' && c.whatsapp_status === 'needs_reconnect');

 return (
 <div>
 <h1 className="text-2xl font-bold text-gray-800 mb-6">Overview</h1>

 {disconnectedClients.length > 0 && (
 <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
 <p className="font-semibold text-red-700 mb-2">
 {disconnectedClients.length} client{disconnectedClients.length > 1 ? 's' : ''} ka WhatsApp disconnected hai - unke leads ko AI reply nahi mil raha abhi
 </p>
 <div className="flex flex-wrap gap-2">
 {disconnectedClients.map((c) => (
 <span key={c.id} className="bg-white border border-red-200 text-red-700 text-xs font-medium px-3 py-1.5 rounded-lg">
 {c.business_name}
 </span>
 ))}
 </div>
 </div>
 )}

 {/* Colorful stat cards */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
 <StatCard label="Total Clients" value={stats.totalClients} color="bg-sky-50 text-sky-700" icon="" />
 <StatCard label="Active Clients" value={stats.activeClients} color="bg-emerald-50 text-emerald-700" icon="" />
 <StatCard label="Monthly Revenue" value={`₹${activeRevenue.toLocaleString('en-IN')}`} color="bg-violet-50 text-violet-700" icon="" />
 <StatCard
 label="Pending / Overdue"
 value={`₹${stats.totalPendingAmount.toLocaleString('en-IN')}`}
 color="bg-rose-50 text-rose-700"
 icon="️"
 />
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Revenue chart */}
 <div className="lg:col-span-2 bg-white border border-cream-200 rounded-xl p-5">
 <h2 className="font-semibold text-gray-800 mb-4">Revenue (Last 6 Months)</h2>
 {stats.revenueChartData.length === 0 ? (
 <p className="text-sm text-gray-400">No payment history yet.</p>
 ) : (
 <ResponsiveContainer width="100%" height={260}>
 <LineChart data={stats.revenueChartData}>
 <CartesianGrid strokeDasharray="3 3" stroke="#f5eed6" />
 <XAxis dataKey="month" tick={{ fontSize: 12 }} />
 <YAxis tick={{ fontSize: 12 }} />
 <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
 <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 4 }} />
 </LineChart>
 </ResponsiveContainer>
 )}
 </div>

 {/* Due / overdue alerts */}
 <div className="bg-white border border-cream-200 rounded-xl p-5">
 <h2 className="font-semibold text-gray-800 mb-4">Payment Alerts</h2>
 {overdueClients.length === 0 && dueSoonClients.length === 0 ? (
 <p className="text-sm text-gray-400">All caught up! No pending payments.</p>
 ) : (
 <div className="space-y-3">
 {overdueClients.map((c) => (
 <div key={c.id} className="bg-rose-50 rounded-lg p-3 text-sm">
 <p className="font-medium text-rose-700">{c.business_name}</p>
 <p className="text-xs text-rose-500">
 Overdue by {Math.abs(c.daysUntilDue)} day(s) · ₹{c.monthly_price?.toLocaleString('en-IN')}
 </p>
 </div>
 ))}
 {dueSoonClients.map((c) => (
 <div key={c.id} className="bg-amber-50 rounded-lg p-3 text-sm">
 <p className="font-medium text-amber-700">{c.business_name}</p>
 <p className="text-xs text-amber-600">
 Due in {c.daysUntilDue} day(s) · ₹{c.monthly_price?.toLocaleString('en-IN')}
 </p>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

function StatCard({ label, value, color, icon }) {
 return (
 <div className={`rounded-xl p-5 ${color}`}>
 <div className="text-xl mb-1">{icon}</div>
 <p className="text-2xl font-bold">{value}</p>
 <p className="text-xs opacity-80 mt-0.5">{label}</p>
 </div>
 );
}