import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout.jsx';
import api from '../lib/api.js';

export default function Properties() {
 const [properties, setProperties] = useState([]);
 const [showAdd, setShowAdd] = useState(false);
 const [uploading, setUploading] = useState(false);
 const fileRef = useRef();

 useEffect(() => {
 load();
 }, []);

 async function load() {
 const res = await api.get('/properties');
 setProperties(res.data.properties || []);
 }

 async function handleDelete(id) {
 if (!confirm('Delete this property?')) return;
 await api.delete(`/properties/${id}`);
 load();
 }

 async function handleBulkUpload(e) {
 const file = e.target.files[0];
 if (!file) return;
 setUploading(true);
 const formData = new FormData();
 formData.append('file', file);
 try {
 const res = await api.post('/properties/bulk-upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
 alert(`${res.data.inserted} properties uploaded successfully.`);
 load();
 } catch (err) {
 alert(err.response?.data?.error || 'Upload failed');
 }
 setUploading(false);
 fileRef.current.value = '';
 }

 return (
 <Layout>
 <div className="flex items-center justify-between mb-6">
 <h1 className="text-2xl font-bold text-indigo-700">Properties</h1>
 <div className="flex gap-2">
 <label className="bg-white border border-indigo-300 text-indigo-700 px-4 py-2 rounded-lg text-sm cursor-pointer hover:bg-indigo-50">
 {uploading ? 'Uploading...' : 'Bulk Upload (CSV)'}
 <input type="file" accept=".csv" ref={fileRef} onChange={handleBulkUpload} className="hidden" />
 </label>
 <button onClick={() => setShowAdd(true)} className="bg-accent-500 hover:bg-accent-600 text-indigo-900 px-4 py-2 rounded-lg text-sm">
 + Add Property
 </button>
 </div>
 </div>

 <p className="text-xs text-gray-400 mb-4">
 CSV columns needed: <code>title, property_type, bhk_type, location, price, area_gaj, description</code>. For big society/township listings, also add: <code>listing_category</code> (write "project"), <code>land_area_bigha, developer_name, possession_date, rera_number, total_units, amenities</code> - all optional, leave blank if not applicable.
 </p>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {properties.map((p) => (
 <div key={p.id} className="bg-white border border-cream-200 rounded-xl p-4">
 <div className="flex justify-between items-start gap-2">
 <h3 className="font-semibold text-gray-800">{p.title}</h3>
 <div className="flex flex-col items-end gap-1 flex-shrink-0">
 {p.listing_category === 'project' && (
 <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Project</span>
 )}
 <span
 className={`text-xs px-2 py-0.5 rounded-full ${
 p.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
 }`}
 >
 {p.status}
 </span>
 </div>
 </div>
 <p className="text-sm text-gray-500 mt-1">
 {p.bhk_type} {p.property_type} · {p.location}
 </p>
 {p.area_gaj && <p className="text-xs text-gray-500 mt-0.5">{p.area_gaj} Gaj</p>}
 {p.listing_category === 'project' && (
 <div className="text-xs text-gray-500 mt-1 space-y-0.5">
 {p.developer_name && <p>Developer: {p.developer_name}</p>}
 {p.land_area_bigha && <p>Land Area: {p.land_area_bigha} Bigha</p>}
 {p.total_units && <p>Total Units: {p.total_units}</p>}
 {p.possession_date && <p>Possession: {p.possession_date}</p>}
 {p.rera_number && <p>RERA: {p.rera_number}</p>}
 {p.amenities && <p>Amenities: {p.amenities}</p>}
 </div>
 )}
 <p className="text-lg font-bold text-indigo-700 mt-2">₹{Number(p.price).toLocaleString('en-IN')}{p.listing_category === 'project' ? ' onwards' : ''}</p>
 {p.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.description}</p>}
 <button onClick={() => handleDelete(p.id)} className="text-red-500 text-xs mt-3 hover:underline">
 Delete
 </button>
 </div>
 ))}
 {properties.length === 0 && <p className="text-gray-400 text-sm">No properties yet. Add one to get started.</p>}
 </div>

 {showAdd && <AddPropertyModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
 </Layout>
 );
}

function AddPropertyModal({ onClose, onSaved }) {
 const [form, setForm] = useState({
 listing_category: 'unit',
 title: '', property_type: 'sale', bhk_type: '', location: '', price: '', area_gaj: '', description: '',
 land_area_bigha: '', developer_name: '', possession_date: '', rera_number: '', total_units: '', amenities: '',
 });
 const [saving, setSaving] = useState(false);

 async function handleSubmit(e) {
 e.preventDefault();
 setSaving(true);
 try {
 await api.post('/properties', form);
 onSaved();
 } catch (err) {
 alert('Failed to save property');
 }
 setSaving(false);
 }

 return (
 <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
 <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
 <h3 className="text-lg font-bold text-indigo-700 mb-4">Add Property</h3>
 <form onSubmit={handleSubmit} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">Listing Type</label>
 <div className="flex gap-2">
 <button
 type="button"
 onClick={() => setForm({ ...form, listing_category: 'unit' })}
 className={`flex-1 py-2 rounded-lg text-sm font-medium border ${form.listing_category === 'unit' ? 'bg-accent-500 border-accent-500 text-indigo-900' : 'border-cream-200 text-gray-600'}`}
 >
 Single Unit (Flat/Plot)
 </button>
 <button
 type="button"
 onClick={() => setForm({ ...form, listing_category: 'project' })}
 className={`flex-1 py-2 rounded-lg text-sm font-medium border ${form.listing_category === 'project' ? 'bg-accent-500 border-accent-500 text-indigo-900' : 'border-cream-200 text-gray-600'}`}
 >
 Big Project (Society/Township)
 </button>
 </div>
 <p className="text-[11px] text-gray-400 mt-1">
 {form.listing_category === 'project'
 ? 'Use this for a big land/society project (e.g. a 150 bigha township with many units).'
 : 'Use this for one specific flat, floor, or plot.'}
 </p>
 </div>

 <Input label={form.listing_category === 'project' ? 'Project Name' : 'Title'} value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
 <select
 value={form.property_type}
 onChange={(e) => setForm({ ...form, property_type: e.target.value })}
 className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm"
 >
 <option value="sale">Sale</option>
 <option value="rent">Rent</option>
 </select>
 </div>
 <Input
 label={form.listing_category === 'project' ? 'Unit Types Available' : 'BHK Type'}
 value={form.bhk_type}
 onChange={(v) => setForm({ ...form, bhk_type: v })}
 placeholder={form.listing_category === 'project' ? 'e.g. 2/3/4 BHK + Plots' : 'e.g. 2BHK'}
 />
 </div>
 <Input label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} required />
 <div className="grid grid-cols-2 gap-3">
 <Input
 label={form.listing_category === 'project' ? 'Starting Price (₹)' : 'Price (₹)'}
 type="number"
 value={form.price}
 onChange={(v) => setForm({ ...form, price: v })}
 required
 />
 <Input label="Area (Gaj) - optional" type="number" value={form.area_gaj} onChange={(v) => setForm({ ...form, area_gaj: v })} placeholder="e.g. 100" />
 </div>

 {form.listing_category === 'project' && (
 <div className="border border-cream-200 rounded-lg p-3 space-y-3 bg-cream-50">
 <p className="text-xs font-semibold text-gray-600">Project Details (all optional)</p>
 <div className="grid grid-cols-2 gap-3">
 <Input label="Total Land Area (Bigha)" type="number" value={form.land_area_bigha} onChange={(v) => setForm({ ...form, land_area_bigha: v })} placeholder="e.g. 150" />
 <Input label="Total Units" type="number" value={form.total_units} onChange={(v) => setForm({ ...form, total_units: v })} placeholder="e.g. 120" />
 </div>
 <Input label="Developer / Builder Name" value={form.developer_name} onChange={(v) => setForm({ ...form, developer_name: v })} />
 <div className="grid grid-cols-2 gap-3">
 <Input label="Possession Date" type="date" value={form.possession_date} onChange={(v) => setForm({ ...form, possession_date: v })} />
 <Input label="RERA Number" value={form.rera_number} onChange={(v) => setForm({ ...form, rera_number: v })} placeholder="e.g. UPRERAPRJ12345" />
 </div>
 <Input label="Amenities" value={form.amenities} onChange={(v) => setForm({ ...form, amenities: v })} placeholder="e.g. Clubhouse, Park, 24x7 Security, Swimming Pool" />
 </div>
 )}

 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
 <textarea
 rows={3}
 value={form.description}
 onChange={(e) => setForm({ ...form, description: e.target.value })}
 className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm"
 />
 </div>
 <div className="flex gap-2 pt-2">
 <button type="button" onClick={onClose} className="flex-1 border border-cream-200 rounded-lg py-2 text-gray-600">
 Cancel
 </button>
 <button type="submit" disabled={saving} className="flex-1 bg-accent-500 hover:bg-accent-600 text-indigo-900 rounded-lg py-2">
 {saving ? 'Saving...' : 'Save'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}

function Input({ label, value, onChange, type = 'text', required = false, placeholder = '' }) {
 return (
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
 <input
 type={type}
 required={required}
 value={value}
 placeholder={placeholder}
 onChange={(e) => onChange(e.target.value)}
 className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
 />
 </div>
 );
}