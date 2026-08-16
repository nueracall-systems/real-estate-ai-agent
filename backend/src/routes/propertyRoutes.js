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
    const {
      title, property_type, bhk_type, location, price, area_gaj, description, images,
      listing_category, land_area_bigha, developer_name, possession_date, rera_number, total_units, amenities,
    } = req.body;
    const { data, error } = await supabaseAdmin
      .from('properties')
      .insert({
        client_id: req.clientId,
        title, property_type, bhk_type, location,
        price: price !== '' && price != null ? parseFloat(price) : 0,
        area_gaj: area_gaj !== '' && area_gaj != null ? parseFloat(area_gaj) : null,
        description, images: images || [],
        listing_category: listing_category || 'unit',
        land_area_bigha: land_area_bigha !== '' && land_area_bigha != null ? parseFloat(land_area_bigha) : null,
        developer_name: developer_name || null,
        possession_date: possession_date !== '' ? possession_date : null,
        rera_number: rera_number || null,
        total_units: total_units !== '' && total_units != null ? parseInt(total_units) : null,
        amenities: amenities || null,
      })
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

// Bulk upload via CSV: columns -> title, property_type, bhk_type, location, price, area_gaj, description,
// listing_category (unit/project), land_area_bigha, developer_name, possession_date, rera_number, total_units, amenities
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
      listing_category: r.listing_category && r.listing_category.trim() === 'project' ? 'project' : 'unit',
      land_area_bigha: r.land_area_bigha && r.land_area_bigha.trim() !== '' ? parseFloat(r.land_area_bigha) : null,
      developer_name: r.developer_name && r.developer_name.trim() !== '' ? r.developer_name.trim() : null,
      possession_date: r.possession_date && r.possession_date.trim() !== '' ? r.possession_date.trim() : null,
      rera_number: r.rera_number && r.rera_number.trim() !== '' ? r.rera_number.trim() : null,
      total_units: r.total_units && r.total_units.trim() !== '' ? parseInt(r.total_units) : null,
      amenities: r.amenities && r.amenities.trim() !== '' ? r.amenities.trim() : null,
    }));

    const { data, error } = await supabaseAdmin.from('properties').insert(rows).select();
    if (error) throw error;

    res.json({ inserted: data.length, properties: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;