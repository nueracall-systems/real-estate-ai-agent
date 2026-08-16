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
  const [activeJob, setActiveJob] = useState(null);
  const pollRef = useRef(null);

  const [templates, setTemplates] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({ template_id: '', send_time: '10:00' });
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    loadLeads();
    loadTemplates();
    loadSchedules();
  }, []);

  async function loadTemplates() {
    const res = await api.get('/templates');
    setTemplates(res.data.templates || []);
  }

  async function loadSchedules() {
    const res = await api.get('/scheduled-bulk-sends');
    setSchedules(res.data.schedules || []);
  }

  async function createSchedule(e) {
    e.preventDefault();
    if (!scheduleForm.template_id) return alert('Pehle ek template select karo');
    setSavingSchedule(true);
    try {
      await api.post('/scheduled-bulk-sends', {
        template_id: scheduleForm.template_id,
        send_time: `${scheduleForm.send_time}:00`,
      });
      setScheduleForm({ template_id: '', send_time: '10:00' });
      loadSchedules();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save schedule');
    }
    setSavingSchedule(false);
  }

  async function toggleSchedule(schedule) {
    await api.patch(`/scheduled-bulk-sends/${schedule.id}`, { is_active: !schedule.is_active });
    loadSchedules();
  }

  async function deleteSchedule(id) {
    if (!window.confirm('Yeh daily auto-send schedule delete karna hai?')) return;
    await api.delete(`/scheduled-bulk-sends/${id}`);
    loadSchedules();
  }

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
    setActiveJob(null);
    try {
      const res = await api.post('/send/bulk-send-existing', {
        leadIds: Array.from(selected),
        message,
      });
      setResult({ success: true, msg: res.data.message });
      setMessage('');
      if (res.data.jobId) startPollingJob(res.data.jobId);
    } catch (err) {
      setResult({ success: false, msg: err.response?.data?.error || 'Failed to start bulk send' });
    }
    setSending(false);
  }

  function startPollingJob(jobId) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/send/bulk-send-jobs/${jobId}`);
        setActiveJob(res.data.job);
        if (res.data.job?.status === 'completed') {
          clearInterval(pollRef.current);
        }
      } catch (err) {
        clearInterval(pollRef.current);
      }
    }, 3000);
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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

      {/* Daily Auto-Send using a Template */}
      <div className="bg-white border border-cream-200 rounded-xl p-4 sm:p-5 mb-6">
        <p className="font-medium text-gray-800 mb-1 text-sm">Daily Auto-Send (Template)</p>
        <p className="text-xs text-gray-400 mb-4">
          Ek template aur time set karo - us waqt AI har din apne aap sabhi leads ko wo message bhej dega, koi manual kaam nahi. Template Templates page se banao.
        </p>

        {templates.length === 0 ? (
          <p className="text-sm text-gray-400">
            Pehle ek template banao <a href="/templates" className="text-accent-600 underline">Templates page</a> pe, uske baad yahan schedule set kar sakte ho.
          </p>
        ) : (
          <form onSubmit={createSchedule} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end mb-4">
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">Template</label>
              <select
                value={scheduleForm.template_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, template_id: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              >
                <option value="">Select template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-40">
              <label className="block text-xs font-medium text-gray-600 mb-1">Daily Time</label>
              <input
                type="time"
                value={scheduleForm.send_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, send_time: e.target.value })}
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
            <button
              type="submit"
              disabled={savingSchedule}
              className="bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-indigo-900 font-medium px-5 py-2 rounded-lg text-sm w-full sm:w-auto"
            >
              {savingSchedule ? 'Saving...' : 'Add Schedule'}
            </button>
          </form>
        )}

        {schedules.length > 0 && (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 border border-cream-100 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {s.message_templates?.title || 'Template deleted'} - roz {s.send_time?.slice(0, 5)} baje
                  </p>
                  <p className="text-xs text-gray-400">{s.is_active ? 'Active' : 'Paused'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleSchedule(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium ${s.is_active ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
                  >
                    {s.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => deleteSchedule(s.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery Report */}
      {activeJob && (
        <div className="bg-white border border-cream-200 rounded-xl p-4 sm:p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-medium text-gray-800 text-sm">
              Delivery Report {activeJob.status === 'running' ? '(Sending...)' : '(Complete)'}
            </p>
            <p className="text-xs text-gray-400">
              {activeJob.sent_count} sent / {activeJob.failed_count} failed / {activeJob.total_recipients} total
            </p>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {(activeJob.results || []).map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm border-b border-cream-100 pb-1.5 last:border-0">
                <span className="text-gray-700 truncate">{r.name || r.phone}</span>
                {r.status === 'sent' ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 flex-shrink-0">Sent</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex-shrink-0" title={r.reason}>
                    Failed - {r.reason}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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