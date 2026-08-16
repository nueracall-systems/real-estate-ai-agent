import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import api from '../lib/api.js';
import { displayIdentity } from '../lib/displayIdentity.js';

export default function Questions() {
  const [pending, setPending] = useState([]);
  const [answered, setAnswered] = useState([]);
  const [tab, setTab] = useState('pending');
  const [drafts, setDrafts] = useState({}); // questionId -> answer text being typed
  const [sending, setSending] = useState({}); // questionId -> bool
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [pendingRes, answeredRes] = await Promise.all([
        api.get('/questions', { params: { status: 'pending' } }),
        api.get('/questions', { params: { status: 'answered' } }),
      ]);
      setPending(pendingRes.data.questions || []);
      setAnswered(answeredRes.data.questions || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function submitAnswer(id) {
    const answer = (drafts[id] || '').trim();
    if (!answer) return alert('Pehle jawab likho');
    setSending((prev) => ({ ...prev, [id]: true }));
    try {
      await api.post(`/questions/${id}/answer`, { answer });
      setDrafts((prev) => ({ ...prev, [id]: '' }));
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send answer');
    }
    setSending((prev) => ({ ...prev, [id]: false }));
  }

  const list = tab === 'pending' ? pending : answered;

  return (
    <Layout>
      <h1 className="text-xl sm:text-2xl font-bold text-indigo-900 mb-2">Questions</h1>
      <p className="text-gray-500 text-sm mb-6">
        Jab AI kisi customer se "confirm karke batata hoon" bole, wo sawaal yahan aata hai. Jawab do - turant customer ko WhatsApp par chala jaayega, aur AI usko hamesha ke liye yaad rakhega.
      </p>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium ${tab === 'pending' ? 'bg-accent-500 text-indigo-900' : 'bg-white border border-cream-200 text-gray-600'}`}
        >
          Pending ({pending.length})
        </button>
        <button
          onClick={() => setTab('answered')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium ${tab === 'answered' ? 'bg-accent-500 text-indigo-900' : 'bg-white border border-cream-200 text-gray-600'}`}
        >
          Answered ({answered.length})
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-gray-400">
            {tab === 'pending' ? 'Koi pending question nahi hai abhi.' : 'Koi answered question nahi hai abhi.'}
          </p>
        ) : (
          list.map((q) => (
            <div key={q.id} className="bg-white border border-cream-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-gray-800">{displayIdentity(q.leads)}</p>
                <p className="text-xs text-gray-400">{new Date(q.created_at).toLocaleString('en-IN')}</p>
              </div>
              <p className="text-sm text-gray-700 bg-cream-50 rounded-lg p-3">{q.question_text}</p>

              {tab === 'pending' ? (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    value={drafts[q.id] || ''}
                    onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && submitAnswer(q.id)}
                    placeholder="Yahan jawab likho..."
                    className="flex-1 border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                  <button
                    onClick={() => submitAnswer(q.id)}
                    disabled={sending[q.id]}
                    className="bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-indigo-900 font-medium px-5 py-2 rounded-lg text-sm whitespace-nowrap"
                  >
                    {sending[q.id] ? 'Sending...' : 'Send Answer'}
                  </button>
                </div>
              ) : (
                <div className="mt-3 bg-emerald-50 text-emerald-800 rounded-lg p-3 text-sm">
                  <p className="font-medium">Answer sent:</p>
                  <p>{q.answer_text}</p>
                  <p className="text-xs opacity-70 mt-1">{new Date(q.answered_at).toLocaleString('en-IN')}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}