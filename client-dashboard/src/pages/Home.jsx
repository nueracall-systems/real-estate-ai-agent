import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Layout from '../components/Layout.jsx';
import api from '../lib/api.js';

const STATUS_COLORS = { hot: '#f43f5e', warm: '#f59e0b', cold: '#38bdf8', new: '#a3a3a3', converted: '#10b981', lost: '#71717a' };

export default function Home() {
 const [stats, setStats] = useState(null);
 const [charts, setCharts] = useState(null);
 const [notifications, setNotifications] = useState([]);

 useEffect(() => {
 loadData();
 const interval = setInterval(loadData, 30000); // refresh every 30s for "real-time" feel
 return () => clearInterval(interval);
 }, []);

 async function loadData() {
 try {
 const [statsRes, chartsRes, notifRes] = await Promise.all([
 api.get('/client/stats'),
 api.get('/client/charts'),
 api.get('/notifications'),
 ]);
 setStats(statsRes.data);
 setCharts(chartsRes.data);
 setNotifications(notifRes.data.notifications || []);
 } catch (err) {
 console.error(err);
 }
 }

 return (
 <Layout>
 <h1 className="text-2xl font-bold text-indigo-900 mb-6">Dashboard</h1>

 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
 <StatCard label="Total Leads" value={stats?.totalLeads} icon="L" iconBg="bg-sky-100" iconColor="text-sky-700" />
 <StatCard label="Hot Leads" value={stats?.hotLeads} icon="H" iconBg="bg-rose-100" iconColor="text-rose-700" />
 <StatCard label="Properties Listed" value={stats?.totalProperties} icon="P" iconBg="bg-violet-100" iconColor="text-violet-700" />
 <StatCard label="Upcoming Visits" value={stats?.upcomingAppointments} icon="V" iconBg="bg-accent-100" iconColor="text-accent-700" />
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
 {/* Leads over time */}
 <div className="lg:col-span-2 bg-white border border-cream-200 rounded-xl p-5">
 <h2 className="font-semibold text-gray-800 mb-4">New Leads (Last 14 Days)</h2>
 {!charts || charts.leadsChartData.length === 0 ? (
 <p className="text-sm text-gray-400">No lead activity yet.</p>
 ) : (
 <ResponsiveContainer width="100%" height={240}>
 <LineChart data={charts.leadsChartData}>
 <CartesianGrid strokeDasharray="3 3" stroke="#f5eed6" />
 <XAxis dataKey="date" tick={{ fontSize: 11 }} />
 <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
 <Tooltip />
 <Line type="monotone" dataKey="leads" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
 </LineChart>
 </ResponsiveContainer>
 )}
 </div>

 {/* Status breakdown */}
 <div className="bg-white border border-cream-200 rounded-xl p-5">
 <h2 className="font-semibold text-gray-800 mb-4">Lead Status Breakdown</h2>
 {!charts || charts.statusChartData.length === 0 ? (
 <p className="text-sm text-gray-400">No leads yet.</p>
 ) : (
 <ResponsiveContainer width="100%" height={220}>
 <PieChart>
 <Pie data={charts.statusChartData} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={45} outerRadius={75}>
 {charts.statusChartData.map((entry, i) => (
 <Cell key={i} fill={STATUS_COLORS[entry.status] || '#a3a3a3'} />
 ))}
 </Pie>
 <Tooltip />
 <Legend wrapperStyle={{ fontSize: 12 }} />
 </PieChart>
 </ResponsiveContainer>
 )}
 </div>
 </div>

 {/* AI Activity chart */}
 <div className="bg-white border border-cream-200 rounded-xl p-5 mb-6">
 <h2 className="font-semibold text-gray-800 mb-4">AI Activity (Last 14 Days)</h2>
 {!charts || charts.activityChartData.length === 0 ? (
 <p className="text-sm text-gray-400">No AI activity yet.</p>
 ) : (
 <ResponsiveContainer width="100%" height={220}>
 <BarChart data={charts.activityChartData}>
 <CartesianGrid strokeDasharray="3 3" stroke="#f5eed6" />
 <XAxis dataKey="date" tick={{ fontSize: 11 }} />
 <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
 <Tooltip />
 <Legend wrapperStyle={{ fontSize: 12 }} />
 <Bar dataKey="aiReplies" fill="#4f46e5" name="AI Replies" radius={[4, 4, 0, 0]} />
 <Bar dataKey="messagesSent" fill="#f59e0b" name="Manual Messages" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 )}
 </div>

 <div className="bg-white border border-cream-200 rounded-xl p-5">
 <h2 className="font-semibold text-gray-800 mb-3">Recent Notifications</h2>
 {notifications.length === 0 ? (
 <p className="text-sm text-gray-400">No notifications yet.</p>
 ) : (
 <ul className="space-y-2">
 {notifications.slice(0, 8).map((n) => (
 <li key={n.id} className="text-sm border-b border-cream-100 pb-2 last:border-0">
 <span className="font-medium text-gray-800">{n.title}</span>
 <p className="text-gray-500">{n.message}</p>
 <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString('en-IN')}</span>
 </li>
 ))}
 </ul>
 )}
 </div>
 </Layout>
 );
}

function StatCard({ label, value, iconBg, iconColor, icon }) {
 return (
 <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
 <div className="flex items-center justify-between mb-3">
 <p className="text-sm text-gray-500 font-medium">{label}</p>
 <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${iconBg} ${iconColor}`}>
 {icon}
 </div>
 </div>
 <p className="text-3xl font-extrabold text-indigo-900">{value ?? '—'}</p>
 </div>
 );
}