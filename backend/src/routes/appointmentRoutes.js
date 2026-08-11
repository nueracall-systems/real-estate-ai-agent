// ============================================================
// APPOINTMENT ROUTES
// ============================================================

import express from 'express';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireClient } from '../middleware/authMiddleware.js';
import { isInEmergencyBlock } from '../services/emergencyBlockService.js';

const router = express.Router();
router.use(requireAuth, requireClient);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select('*, leads(name, phone)')
      .eq('client_id', req.clientId)
      .order('scheduled_time', { ascending: true });
    if (error) throw error;
    res.json({ appointments: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { lead_id, property_id, scheduled_time, location, notes } = req.body;

    const blocked = await isInEmergencyBlock(req.clientId, scheduled_time);
    if (blocked) {
      return res.status(400).json({ error: 'This time falls in your emergency block (DND) window. Please choose another time.' });
    }

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .insert({ client_id: req.clientId, lead_id, property_id, scheduled_time, location, notes, status: 'booked' })
      .select()
      .single();
    if (error) throw error;
    res.json({ appointment: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select()
      .single();
    if (error) throw error;
    res.json({ appointment: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
