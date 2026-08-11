import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { supabase } from '../lib/supabaseClient.js';

export default function WhatsAppConnect() {
 const [qr, setQr] = useState(null);
 const [status, setStatus] = useState('idle'); // idle | connecting | ready | error
 const [errorMsg, setErrorMsg] = useState('');
 const navigate = useNavigate();

 async function startConnection() {
 setStatus('connecting');
 setQr(null);
 setErrorMsg('');

 const { data } = await supabase.auth.getSession();
 const token = data?.session?.access_token;
 const apiUrl = import.meta.env.VITE_API_URL;

 // EventSource doesn't support custom headers, so pass token as query param.
 // Backend should also accept ?token= as a fallback if you extend requireAuth.
 const es = new EventSource(`${apiUrl}/whatsapp/connect-stream?token=${token}`);

 es.addEventListener('qr', (e) => {
 const payload = JSON.parse(e.data);
 setQr(payload.qr);
 });

 es.addEventListener('ready', () => {
 setStatus('ready');
 es.close();
 });

 es.addEventListener('error', (e) => {
 setStatus('error');
 setErrorMsg('Connection failed. Please try again.');
 es.close();
 });
 }

 return (
 <Layout>
 <div className="max-w-xl mx-auto text-center">
 <h1 className="text-2xl font-bold text-indigo-700 mb-2">Connect WhatsApp</h1>
 <p className="text-gray-500 mb-8">
 Scan this QR code with the WhatsApp account you want your AI assistant to use — just like WhatsApp Web.
 </p>

 <div className="bg-white border border-cream-200 rounded-2xl p-8">
 {status === 'idle' && (
 <button onClick={startConnection} className="bg-accent-500 hover:bg-accent-600 text-indigo-900 px-6 py-3 rounded-lg font-medium">
 Generate QR Code
 </button>
 )}

 {status === 'connecting' && !qr && <p className="text-gray-500">Generating QR code...</p>}

 {qr && status !== 'ready' && (
 <div>
 <img src={qr} alt="WhatsApp QR Code" className="mx-auto rounded-lg border border-cream-200 w-full max-w-[280px] h-auto" />
 <p className="text-sm text-gray-500 mt-4">
 Open WhatsApp Settings Linked Devices Link a Device, then scan this code.
 </p>
 </div>
 )}

 {status === 'ready' && (
 <div className="text-green-600">
 <p className="font-medium">WhatsApp Connected!</p>
 <button onClick={() => navigate('/')} className="mt-4 bg-accent-500 hover:bg-accent-600 text-indigo-900 px-6 py-2 rounded-lg">
 Go to Dashboard
 </button>
 </div>
 )}

 {status === 'error' && (
 <div className="text-red-600">
 <p>{errorMsg}</p>
 <button onClick={startConnection} className="mt-4 text-indigo-600 underline text-sm">
 Try again
 </button>
 </div>
 )}
 </div>
 </div>
 </Layout>
 );
}