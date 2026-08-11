// ============================================================
// EMERGENCY BLOCK (DND) ROUTES
// ============================================================

import express from 'express';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireClient } from '../middleware/authMiddleware.js';
import { createEmergencyBlock } from '../services/emergencyBlockService.js';

const router = express.Router();
router.use(requireAuth, requireClient);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('emergency_blocks')
      .select('*')
      .eq('client_id', req.clientId)
      .order('start_time', { ascending: false });
    if (error) throw error;
    res.json({ blocks: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { start_time, end_time, reason, auto_reschedule } = req.body;
    const block = await createEmergencyBlock(req.clientId, { start_time, end_time, reason, auto_reschedule });
    res.json({ block });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('emergency_blocks')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select()
      .single();
    if (error) throw error;
    res.json({ block: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('emergency_blocks').delete().eq('id', req.params.id).eq('client_id', req.clientId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
