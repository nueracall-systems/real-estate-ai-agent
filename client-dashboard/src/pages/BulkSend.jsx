import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout.jsx';
import api from '../lib/api.js';
import { displayIdentity, displaySubIdentity } from '../lib/displayIdentity.js';

export default function BulkSend() {
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    const res = await api.get('/leads');
    const list = res.data.leads || [];
    setLeads(list);
    // Default: everyone selected, so "Send to All" needs zero extra clicks
    setSelected(new Set(list.map((l) => l.id)));
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/leads/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const skippedCount = res.data.skipped?.length || 0;
      setResult({ success: true, msg: `${res.data.inserted} leads added.${skippedCount ? ` ${skippedCount} rows skipped (invalid phone).` : ''}` });
      await loadLeads();
    } catch (err) {
      setResult({ success: false, msg: err.response?.data?.error || 'Failed to upload CSV' });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filteredLeads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredLeads.map((l) => l.id)));
    }
  }

  async function deleteLead(e, id) {
    e.stopPropagation();
    if (!window.confirm('Delete this lead?')) return;
    await api.delete(`/leads/${id}`);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    loadLeads();
  }

  async function handleSend() {
    if (selected.size === 0) return setResult({ success: false, msg: 'Select at least one lead' });
    if (!message.trim()) return setResult({ success: false, msg: 'Write a message first' });

    setSending(true);
    setResult(null);
    try {
      const res = await api.post('/send/bulk-send-existing', {
        leadIds: Array.from(selected),
        message,
      });
      setResult({ success: true, msg: res.data.message });
      setMessage('');
    } catch (err) {
      setResult({ success: false, msg: err.response?.data?.error || 'Failed to start bulk send' });
    }
    setSending(false);
  }

  const filteredLeads = leads.filter((l) => {
    const q = search.toLowerCase();
    return l.name?.toLowerCase().includes(q) || l.phone?.includes(q);
  });

  return (
    <Layout>
      <h1 className="text-xl sm:text-2xl font-bold text-indigo-700 mb-2">Bulk Send</h1>
      <p className="text-gray-500 text-sm mb-6">
        Add leads once (CSV), then message any of them anytime below - no need to re-upload every time. Messages send
        gradually with random gaps to avoid WhatsApp bans, so a large batch may take a while.
      </p>

      {/* Add leads */}
      <div className="bg-white border border-cream-200 rounded-xl p-4 sm:p-5 mb-6">
        <p className="font-medium text-gray-800 mb-2 text-sm">Add Leads (CSV: name, phone)</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleUpload}
          disabled={uploading}
          className="text-sm w-full sm:w-auto"
        />
        {uploading && <p className="text-xs text-indigo-500 mt-2">Uploading...</p>}
      </div>

      {/* Message box */}
      <div className="bg-white border border-cream-200 rounded-xl p-4 sm:p-5 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Message (use <code>{'{{name}}'}</code> to personalize)
        </label>
        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Namaste {{name}}, humare paas ek naya 2BHK listing aaya hai..."
          className="w-full border border-cream-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        />
        {result && (
          <p className={`text-sm mt-2 ${result.success ? 'text-green-600' : 'text-red-600'}`}>{result.msg}</p>
        )}
        <button
          onClick={handleSend}
          disabled={sending || selected.size === 0}
          className="mt-3 w-full sm:w-auto bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-indigo-900 font-medium px-6 py-2.5 rounded-lg transition"
        >
          {sending ? 'Sending...' : `Send to Selected (${selected.size})`}
        </button>
      </div>

      {/* Leads list */}
      <div className="bg-white border border-cream-200 rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 border-b border-cream-100">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={filteredLeads.length > 0 && selected.size === filteredLeads.length}
                onChange={toggleAll}
              />
              Select All ({filteredLeads.length})
            </label>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone..."
            className="border border-cream-200 rounded-lg px-3 py-1.5 text-sm w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {filteredLeads.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">No leads yet. Upload a CSV above to add some.</p>
          ) : (
            filteredLeads.map((l) => (
              <div
                key={l.id}
                onClick={() => toggleOne(l.id)}
                className="flex items-center justify-between gap-3 px-4 py-3 border-b border-cream-100 hover:bg-cream-50 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleOne(l.id)} onClick={(e) => e.stopPropagation()} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{displayIdentity(l)}</p>
                    <p className="text-xs text-gray-400 truncate">{displaySubIdentity(l)}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => deleteLead(e, l.id)}
                  className="flex-shrink-0 text-xs px-2 py-1 rounded-md text-red-500 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}