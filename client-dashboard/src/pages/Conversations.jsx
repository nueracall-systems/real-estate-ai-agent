import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout.jsx';
import api from '../lib/api.js';
import { displayIdentity, displaySubIdentity } from '../lib/displayIdentity.js';

const statusColors = {
  hot: 'bg-red-100 text-red-700',
  warm: 'bg-yellow-100 text-yellow-700',
  cold: 'bg-blue-100 text-blue-700',
  new: 'bg-gray-100 text-gray-600',
  converted: 'bg-green-100 text-green-700',
  lost: 'bg-gray-100 text-gray-400',
};

const avatarColors = ['bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-accent-100 text-accent-700', 'bg-emerald-100 text-emerald-700'];

function avatarColorFor(id) {
  let sum = 0;
  for (const ch of id || '') sum += ch.charCodeAt(0);
  return avatarColors[sum % avatarColors.length];
}

const senderStyle = {
  lead: { label: 'Customer', bubble: 'bg-cream-100 text-gray-800', align: 'justify-start' },
  ai: { label: 'AI', bubble: 'bg-indigo-100 text-indigo-800', align: 'justify-start' },
  human_agent: { label: 'You', bubble: 'bg-accent-500 text-indigo-900', align: 'justify-end' },
};

export default function Conversations() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { lead, conversations }
  const [threadLoading, setThreadLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const selectedLeadIdRef = useRef(null);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      load(true); // silent refresh - no loading spinner flash
      if (selectedLeadIdRef.current) refreshThread(selectedLeadIdRef.current);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/conversations');
      setList(res.data.conversations || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    }
    if (!silent) setLoading(false);
  }

  // Silently refreshes the currently-open thread without showing a
  // loading state or disturbing the name-edit box if it's open.
  async function refreshThread(leadId) {
    try {
      const res = await api.get(`/leads/${leadId}`);
      setSelected((prev) => (prev && prev.lead?.id === leadId ? res.data : prev));
      setLastUpdated(new Date());
    } catch (err) {
      // silent - don't disturb the UI over a background refresh failing
    }
  }

  async function openThread(leadId) {
    setThreadLoading(true);
    setEditingName(false);
    selectedLeadIdRef.current = leadId;
    try {
      const res = await api.get(`/leads/${leadId}`);
      setSelected(res.data);
    } catch (err) {
      console.error(err);
    }
    setThreadLoading(false);
  }

  function startEditName() {
    setNameDraft(selected.lead?.name || '');
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }

  async function saveName() {
    const newName = nameDraft.trim();
    setEditingName(false);
    if (!newName || newName === selected.lead?.name) return;
    try {
      await api.patch(`/leads/${selected.lead.id}`, { name: newName });
      setSelected((prev) => ({ ...prev, lead: { ...prev.lead, name: newName } }));
      setList((prev) => prev.map((c) => (c.lead_id === selected.lead.id ? { ...c, name: newName } : c)));
    } catch (err) {
      console.error(err);
    }
  }

  const filtered = list.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <h1 className="text-xl sm:text-2xl font-bold text-indigo-900">All Conversations</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or message..."
          className="border border-cream-200 rounded-lg px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
      </div>
      <p className="text-xs text-gray-400 mb-6 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
        Live · Updated {lastUpdated.toLocaleTimeString('en-IN')}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: list of customers */}
        <div className="bg-white border border-cream-200 rounded-2xl overflow-hidden shadow-sm max-h-[75vh] overflow-y-auto">
          {loading ? (
            <p className="p-6 text-gray-400 text-sm">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-gray-400 text-sm">No conversations yet.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.lead_id}
                onClick={() => openThread(c.lead_id)}
                className={`w-full text-left px-4 py-3 border-b border-cream-100 hover:bg-cream-50 flex items-center gap-3 transition ${
                  selected?.lead?.id === c.lead_id ? 'bg-indigo-50' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${avatarColorFor(c.lead_id)}`}>
                  {displayIdentity(c).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-medium text-gray-800 text-sm truncate">{displayIdentity(c)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${statusColors[c.status] || ''}`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {c.last_sender === 'lead' ? '' : c.last_sender === 'ai' ? 'AI: ' : 'You: '}
                    {c.last_message}
                  </p>
                  <p className="text-[10px] text-gray-300 mt-0.5">
                    {c.last_message_at ? new Date(c.last_message_at).toLocaleString('en-IN') : ''}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Right: full thread for selected customer */}
        <div className="lg:col-span-2 bg-white border border-cream-200 rounded-2xl shadow-sm flex flex-col max-h-[75vh]">
          {!selected ? (
            <p className="p-6 text-sm text-gray-400">Select a customer on the left to view the full AI + customer chat.</p>
          ) : threadLoading ? (
            <p className="p-6 text-sm text-gray-400">Loading conversation...</p>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-cream-100 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${avatarColorFor(selected.lead?.id)}`}>
                  {displayIdentity(selected.lead).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  {editingName ? (
                    <input
                      ref={nameInputRef}
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={saveName}
                      onKeyDown={(e) => e.key === 'Enter' && saveName()}
                      placeholder="Customer ka naam likho..."
                      className="font-semibold text-gray-800 text-sm border border-accent-400 rounded-lg px-2 py-1 focus:outline-none w-full max-w-[220px]"
                    />
                  ) : (
                    <button onClick={startEditName} className="text-left group">
                      <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                        {displayIdentity(selected.lead)}
                        <span className="text-[10px] text-accent-600 opacity-0 group-hover:opacity-100 transition">Edit</span>
                      </p>
                    </button>
                  )}
                  <p className="text-xs text-gray-400">{displaySubIdentity(selected.lead)}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {selected.conversations.length === 0 ? (
                  <p className="text-sm text-gray-400">No messages yet.</p>
                ) : (
                  selected.conversations.map((c) => (
                    <div key={c.id} className={`flex ${senderStyle[c.sender]?.align || 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm ${senderStyle[c.sender]?.bubble || 'bg-cream-100 text-gray-800'}`}>
                        {c.message}
                        <p className="text-[10px] opacity-60 mt-1">
                          {senderStyle[c.sender]?.label || c.sender} · {new Date(c.created_at).toLocaleTimeString('en-IN')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}