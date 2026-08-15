// ============================================================
// SCHEDULED BULK SEND ROUTES
// ============================================================

import express from 'express';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireClient } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth, requireClient);

// List this client's schedules (usually just one, but supports more)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('scheduled_bulk_sends')
      .select('*, message_templates(title, content)')
      .eq('client_id', req.clientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ schedules: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new daily schedule
router.post('/', async (req, res) => {
  try {
    const { template_id, send_time } = req.body;
    if (!template_id || !send_time) {
      return res.status(400).json({ error: 'template_id and send_time are required' });
    }
    const { data, error } = await supabaseAdmin
      .from('scheduled_bulk_sends')
      .insert({ client_id: req.clientId, template_id, send_time, is_active: true })
      .select('*, message_templates(title, content)')
      .single();
    if (error) throw error;
    res.json({ schedule: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update (change template/time, or toggle on/off)
router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('scheduled_bulk_sends')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select('*, message_templates(title, content)')
      .single();
    if (error) throw error;
    res.json({ schedule: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('scheduled_bulk_sends')
      .delete()
      .eq('id', req.params.id)
      .eq('client_id', req.clientId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;