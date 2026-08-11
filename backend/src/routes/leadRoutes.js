// ============================================================
// LEAD + CONVERSATION ROUTES
// ============================================================

import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireClient } from '../middleware/authMiddleware.js';
import { getProvider } from '../whatsapp/whatsappProvider.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
router.use(requireAuth, requireClient);

// List all leads (inbox view), optional ?status=hot filter
router.get('/', async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('leads')
      .select('*')
      .eq('client_id', req.clientId)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ leads: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single lead + full conversation history
router.get('/:id', async (req, res) => {
  try {
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .single();
    if (leadErr) throw leadErr;

    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('lead_id', req.params.id)
      .order('created_at', { ascending: true });

    res.json({ lead, conversations: conversations || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update lead (status, notes, budget etc.)
router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select()
      .single();
    if (error) throw error;
    res.json({ lead: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual reply (client can still jump in manually any time, without pausing AI)
router.post('/:id/reply', async (req, res) => {
  try {
    const { message } = req.body;
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .select('*, clients(whatsapp_provider)')
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .single();
    if (leadErr) throw leadErr;

    const provider = getProvider(lead.clients?.whatsapp_provider || 'baileys');
    const sendTarget = lead.jid_type === 'lid' ? (lead.whatsapp_lid || lead.phone) : lead.phone;
    await provider.sendMessage(req.clientId, sendTarget, message, lead.jid_type || 'phone');

    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .insert({ lead_id: lead.id, client_id: req.clientId, message, sender: 'human_agent', status: 'sent' })
      .select()
      .single();

    res.json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a lead (and its conversation/appointment history via cascade).
// Useful for removing test leads or, before this fix, a lead whose
// conversation got wrongly merged with a different customer's messages.
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('leads')
      .delete()
      .eq('id', req.params.id)
      .eq('client_id', req.clientId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk upload leads via CSV: columns -> name, phone
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const records = parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true, trim: true });

    if (!records.length) return res.status(400).json({ error: 'CSV is empty' });

    const rows = [];
    const skipped = [];
    for (const r of records) {
      const rawPhone = (r.phone || r.Phone || r.number || r.Number || '').toString().replace(/[^0-9]/g, '');
      const name = (r.name || r.Name || '').toString().trim() || null;

      if (!rawPhone || rawPhone.length < 10) {
        skipped.push({ row: r, reason: 'invalid/missing phone number' });
        continue;
      }
      // Normalize to include country code (assume India +91 if a bare 10-digit number is given)
      const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

      rows.push({
        client_id: req.clientId,
        phone,
        name,
        source: 'bulk',
        status: 'new',
        jid_type: 'phone',
      });
    }

    if (!rows.length) {
      return res.status(400).json({ error: 'No valid rows found in CSV', skipped });
    }

    // Upsert so re-uploading the same CSV doesn't create duplicate leads
    const { data, error } = await supabaseAdmin
      .from('leads')
      .upsert(rows, { onConflict: 'client_id,phone', ignoreDuplicates: false })
      .select();

    if (error) throw error;

    res.json({ inserted: data.length, skipped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Merge two leads that turned out to be the same customer (e.g. WhatsApp
// routed their reply through a different @lid than the phone number they
// were originally messaged on). Moves all conversation + appointment
// history into the target lead, combines memory, and - importantly -
// carries the lid over onto the target so future messages from this same
// contact automatically match the right lead from now on.
router.post('/:id/merge', async (req, res) => {
  try {
    const { intoLeadId } = req.body;
    if (!intoLeadId) return res.status(400).json({ error: 'intoLeadId is required' });
    if (intoLeadId === req.params.id) return res.status(400).json({ error: 'Cannot merge a lead into itself' });

    const { data: source } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .single();
    const { data: target } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', intoLeadId)
      .eq('client_id', req.clientId)
      .single();

    if (!source || !target) return res.status(404).json({ error: 'Lead not found' });

    // Move conversation + appointment history over
    await supabaseAdmin.from('conversations').update({ lead_id: intoLeadId }).eq('lead_id', source.id);
    await supabaseAdmin.from('appointments').update({ lead_id: intoLeadId }).eq('lead_id', source.id);

    const updates = { updated_at: new Date().toISOString() };

    // Combine what the AI has learned about this customer from both threads
    const combinedMemory = [target.ai_memory, source.ai_memory].filter(Boolean).join(' ');
    if (combinedMemory) updates.ai_memory = combinedMemory;

    // Carry the lid over so future messages from this contact land on the
    // target lead automatically - this is what stops it happening again.
    if (source.jid_type === 'lid' && source.whatsapp_lid && !target.whatsapp_lid) {
      updates.whatsapp_lid = source.whatsapp_lid;
    }
    // If the target didn't have a name yet but the source did, keep it
    if (!target.name && source.name) updates.name = source.name;

    await supabaseAdmin.from('leads').update(updates).eq('id', intoLeadId);
    await supabaseAdmin.from('leads').delete().eq('id', source.id);

    const { data: merged } = await supabaseAdmin.from('leads').select('*').eq('id', intoLeadId).single();
    res.json({ success: true, lead: merged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;