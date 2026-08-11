// ============================================================
// CONVERSATIONS + ANALYTICS ROUTES (client dashboard)
// ============================================================

import express from 'express';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireClient } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth, requireClient);

// One row per lead (name, last message preview, timestamp) - powers the
// "All Conversations" list view. Clicking a lead then loads its full
// thread via the existing GET /leads/:id endpoint.
router.get('/', async (req, res) => {
  try {
    const { data: leads, error: leadsErr } = await supabaseAdmin
      .from('leads')
      .select('id, name, phone, status, last_message_at')
      .eq('client_id', req.clientId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200);

    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) return res.json({ conversations: [] });

    const leadIds = leads.map((l) => l.id);

    // Pull recent messages for these leads (newest first) and keep only
    // the most recent one per lead as the preview line.
    const { data: recentMessages, error: msgErr } = await supabaseAdmin
      .from('conversations')
      .select('lead_id, message, sender, created_at')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (msgErr) throw msgErr;

    const lastMessageByLead = {};
    for (const m of recentMessages || []) {
      if (!lastMessageByLead[m.lead_id]) lastMessageByLead[m.lead_id] = m;
    }

    const conversations = leads
      .filter((l) => lastMessageByLead[l.id]) // only show leads that actually have messages
      .map((l) => ({
        lead_id: l.id,
        name: l.name,
        phone: l.phone,
        status: l.status,
        last_message: lastMessageByLead[l.id]?.message || '',
        last_sender: lastMessageByLead[l.id]?.sender || '',
        last_message_at: lastMessageByLead[l.id]?.created_at || l.last_message_at,
      }));

    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;