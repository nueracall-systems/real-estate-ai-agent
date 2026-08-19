import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout.jsx';
import api from '../lib/api.js';
import { displayIdentity, displaySubIdentity } from '../lib/displayIdentity.js';

export default function Leads() {
 const [leads, setLeads] = useState([]);
 const [selectedLead, setSelectedLead] = useState(null);
 const [conversations, setConversations] = useState([]);
 const [reply, setReply] = useState('');
 const [filter, setFilter] = useState('');
 const [sending, setSending] = useState(false);
 const [uploading, setUploading] = useState(false);
 const fileInputRef = useRef(null);
 const [lastUpdated, setLastUpdated] = useState(new Date());
 const selectedLeadIdRef = useRef(null);

 useEffect(() => {
 loadLeads();
 }, [filter]);

 useEffect(() => {
 const interval = setInterval(() => {
 loadLeads(true);
 if (selectedLeadIdRef.current) refreshThread(selectedLeadIdRef.current);
 }, 5000);
 return () => clearInterval(interval);
 }, [filter]);

 async function loadLeads(silent = false) {
 const res = await api.get('/leads', { params: filter ? { status: filter } : {} });
 setLeads(res.data.leads || []);
 if (silent) setLastUpdated(new Date());
 }

 async function refreshThread(leadId) {
 try {
 const res = await api.get(`/leads/${leadId}`);
 if (selectedLeadIdRef.current === leadId) {
 setSelectedLead(res.data.lead);
 setConversations(res.data.conversations || []);
 setLastUpdated(new Date());
 }
 } catch (err) {
 // silent - don't disturb the UI over a background refresh failing
 }
 }

 async function openLead(leadId) {
 selectedLeadIdRef.current = leadId;
 const res = await api.get(`/leads/${leadId}`);
 setSelectedLead(res.data.lead);
 setConversations(res.data.conversations || []);
 }

 async function deleteLead() {
 if (!selectedLead) return;
 if (!window.confirm(`Delete "${displayIdentity(selectedLead)}" and its entire conversation history? This cannot be undone.`)) return;
 await api.delete(`/leads/${selectedLead.id}`);
 setSelectedLead(null);
 setConversations([]);
 loadLeads();
 }

 async function deleteLeadFromList(e, lead) {
 e.stopPropagation(); // don't trigger openLead
 if (!window.confirm(`Delete "${displayIdentity(lead)}" and its entire conversation history? This cannot be undone.`)) return;
 await api.delete(`/leads/${lead.id}`);
 if (selectedLead?.id === lead.id) {
 setSelectedLead(null);
 setConversations([]);
 }
 loadLeads();
 }

 async function handleBulkUpload(e) {
 const file = e.target.files?.[0];
 if (!file) return;
 setUploading(true);
 try {
 const formData = new FormData();
 formData.append('file', file);
 const res = await api.post('/leads/bulk-upload', formData, {
 headers: { 'Content-Type': 'multipart/form-data' },
 });
 const skippedCount = res.data.skipped?.length || 0;
 alert(`${res.data.inserted} leads uploaded successfully.${skippedCount ? ` ${skippedCount} rows skipped (invalid phone number).` : ''}`);
 loadLeads();
 } catch (err) {
 alert(err.response?.data?.error || 'Failed to upload CSV');
 }
 setUploading(false);
 if (fileInputRef.current) fileInputRef.current.value = '';
 }

 async function sendReply() {
 if (!reply.trim()) return;
 setSending(true);
 try {
 await api.post(`/leads/${selectedLead.id}/reply`, { message: reply });
 setReply('');
 openLead(selectedLead.id);
 } catch (err) {
 alert('Failed to send message');
 }
 setSending(false);
 }

 const statusColors = { hot: 'bg-red-100 text-red-700', warm: 'bg-yellow-100 text-yellow-700', cold: 'bg-blue-100 text-blue-700', new: 'bg-gray-100 text-gray-600', converted: 'bg-green-100 text-green-700', lost: 'bg-gray-100 text-gray-400' };

 return (
 <Layout>
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
 <h1 className="text-xl sm:text-2xl font-bold text-indigo-700">Leads / Inbox</h1>
 <div>
 <input
 ref={fileInputRef}
 type="file"
 accept=".csv"
 onChange={handleBulkUpload}
 className="hidden"
 id="lead-csv-upload"
 />
 <button
 onClick={() => fileInputRef.current?.click()}
 disabled={uploading}
 className="bg-accent-500 hover:bg-accent-600 text-indigo-900 text-sm font-medium px-4 py-2 rounded-lg w-full sm:w-auto"
 >
 {uploading ? 'Uploading...' : 'Bulk Upload (CSV)'}
 </button>
 </div>
 </div>

 <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
 Live · Updated {lastUpdated.toLocaleTimeString('en-IN')}
 </p>

 <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
 {['', 'hot', 'warm', 'cold', 'new'].map((s) => (
 <button
 key={s}
 onClick={() => setFilter(s)}
 className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${filter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-cream-200 text-gray-600'}`}
 >
 {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
 </button>
 ))}
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 {/* Lead list */}
 <div className="bg-white border border-cream-200 rounded-xl overflow-hidden max-h-[70vh] overflow-y-auto">
 {leads.length === 0 && <p className="p-4 text-sm text-gray-400">No leads yet. Use "Bulk Upload" above or wait for inbound messages.</p>}
 {leads.map((l) => (
 <div
 key={l.id}
 onClick={() => openLead(l.id)}
 className={`w-full text-left px-4 py-3 border-b border-cream-100 hover:bg-cream-50 cursor-pointer flex items-center justify-between gap-2 ${selectedLead?.id === l.id ? 'bg-indigo-50' : ''}`}
 >
 <div className="min-w-0 flex-1">
 <div className="flex justify-between items-center gap-2">
 <span className="font-medium text-gray-800 text-sm truncate">{displayIdentity(l)}</span>
 <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[l.status] || ''}`}>{l.status}</span>
 </div>
 <p className="text-xs text-gray-400 truncate">{displaySubIdentity(l)}</p>
 </div>
 <button
 onClick={(e) => deleteLeadFromList(e, l)}
 className="flex-shrink-0 text-xs px-2 py-1 rounded-md text-red-500 hover:bg-red-50"
 title="Delete this lead"
 >
 Delete
 </button>
 </div>
 ))}
 </div>

 {/* Conversation view */}
 <div className="lg:col-span-2 bg-white border border-cream-200 rounded-xl flex flex-col max-h-[70vh]">
 {!selectedLead ? (
 <p className="p-6 text-sm text-gray-400">Select a lead to view conversation.</p>
 ) : (
 <>
 <div className="px-4 py-3 border-b border-cream-100 flex items-center justify-between">
 <div>
 <p className="font-semibold text-gray-800">{displayIdentity(selectedLead)}</p>
 <p className="text-xs text-gray-400">{displaySubIdentity(selectedLead)}</p>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs px-3 py-1.5 rounded-lg font-medium bg-indigo-100 text-indigo-700">
 AI handling this lead
 </span>
 <button
 onClick={deleteLead}
 className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100"
 title="Delete this lead and its conversation history"
 >
 Delete
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
 {conversations.map((c) => (
 <div key={c.id} className={`flex ${c.sender === 'lead' ? 'justify-start' : 'justify-end'}`}>
 <div
 className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
 c.sender === 'lead'
 ? 'bg-cream-100 text-gray-800'
 : c.sender === 'ai'
 ? 'bg-indigo-100 text-indigo-800'
 : 'bg-indigo-600 text-white'
 }`}
 >
 {c.message}
 <p className="text-[10px] opacity-60 mt-1">{c.sender} · {new Date(c.created_at).toLocaleTimeString('en-IN')}</p>
 </div>
 </div>
 ))}
 </div>

 <div className="px-4 py-3 border-t border-cream-100 flex gap-2">
 <input
 value={reply}
 onChange={(e) => setReply(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && sendReply()}
 placeholder="Type a manual reply..."
 className="flex-1 border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
 />
 <button onClick={sendReply} disabled={sending} className="bg-accent-500 hover:bg-accent-600 text-indigo-900 px-4 py-2 rounded-lg text-sm">
 Send
 </button>
 </div>
 </>
 )}
 </div>
 </div>
 </Layout>
 );
}