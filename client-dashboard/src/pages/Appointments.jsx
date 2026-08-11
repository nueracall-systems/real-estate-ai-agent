import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import api from '../lib/api.js';
import { displayIdentity } from '../lib/displayIdentity.js';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get('/appointments');
    setAppointments(res.data.appointments || []);
  }

  async function updateStatus(id, status) {
    await api.patch(`/appointments/${id}`, { status });
    load();
  }

  const statusColors = {
    booked: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    rescheduled: 'bg-orange-100 text-orange-700',
  };

  return (
    <Layout>
      <h1 className="text-xl sm:text-2xl font-bold text-indigo-700 mb-6">Appointments</h1>

      <div className="bg-white border border-cream-200 rounded-xl overflow-hidden">
        {appointments.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No appointments booked yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-cream-100 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-t border-cream-100">
                  <td className="px-4 py-3 font-medium text-gray-800">{displayIdentity(a.leads)}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(a.scheduled_time).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-600">{a.location || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[a.status]}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    {a.status === 'booked' && (
                      <>
                        <button onClick={() => updateStatus(a.id, 'completed')} className="text-green-600 text-xs hover:underline">
                          Mark Done
                        </button>
                        <button onClick={() => updateStatus(a.id, 'cancelled')} className="text-red-500 text-xs hover:underline">
                          Cancel
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </Layout>
  );
}