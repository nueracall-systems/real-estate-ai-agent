// ============================================================
// NOTIFICATIONS ROUTES
// ============================================================

import express from 'express';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireClient } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth, requireClient);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('client_id', req.clientId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ notifications: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select()
      .single();
    if (error) throw error;
    res.json({ notification: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/mark-all-read', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('notifications').update({ is_read: true }).eq('client_id', req.clientId).eq('is_read', false);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
