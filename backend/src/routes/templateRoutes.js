// ============================================================
// MESSAGE TEMPLATES ROUTES
// ============================================================

import express from 'express';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireClient } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth, requireClient);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('message_templates').select('*').eq('client_id', req.clientId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ templates: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .insert({ client_id: req.clientId, title, content, category })
      .select()
      .single();
    if (error) throw error;
    res.json({ template: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('message_templates').delete().eq('id', req.params.id).eq('client_id', req.clientId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
