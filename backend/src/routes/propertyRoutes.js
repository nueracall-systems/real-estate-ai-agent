// ============================================================
// PROPERTY ROUTES - listings CRUD + bulk CSV upload
// ============================================================

import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireClient } from '../middleware/authMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
router.use(requireAuth, requireClient);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('properties')
      .select('*')
      .eq('client_id', req.clientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ properties: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, property_type, bhk_type, location, price, area_gaj, description, images } = req.body;
    const { data, error } = await supabaseAdmin
      .from('properties')
      .insert({ client_id: req.clientId, title, property_type, bhk_type, location, price, area_gaj: area_gaj || null, description, images: images || [] })
      .select()
      .single();
    if (error) throw error;
    res.json({ property: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('properties')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('client_id', req.clientId) // safety: can't edit other client's property
      .select()
      .single();
    if (error) throw error;
    res.json({ property: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('properties').delete().eq('id', req.params.id).eq('client_id', req.clientId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk upload via CSV: columns -> title, property_type, bhk_type, location, price, area_gaj, description
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV file required' });

    const records = parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true, trim: true });

    const rows = records.map((r) => ({
      client_id: req.clientId,
      title: r.title,
      property_type: r.property_type || 'sale',
      bhk_type: r.bhk_type || '',
      location: r.location,
      price: parseFloat(r.price) || 0,
      area_gaj: r.area_gaj && r.area_gaj.trim() !== '' ? parseFloat(r.area_gaj) : null,
      description: r.description || '',
      images: [],
    }));

    const { data, error } = await supabaseAdmin.from('properties').insert(rows).select();
    if (error) throw error;

    res.json({ inserted: data.length, properties: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;