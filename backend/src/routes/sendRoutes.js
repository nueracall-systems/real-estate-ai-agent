// ============================================================
// QUICK SEND + BULK SEND ROUTES
// ============================================================

import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireClient } from '../middleware/authMiddleware.js';
import { getProvider } from '../whatsapp/whatsappProvider.js';
import { startBulkSend, startBulkSendToLeads } from '../services/bulkSendService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
router.use(requireAuth, requireClient);

// QUICK SEND: single number, immediate send
router.post('/quick-send', async (req, res) => {
  try {
    const { name, phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone and message are required' });

    await supabaseAdmin
      .from('leads')
      .upsert({ client_id: req.clientId, phone, name, source: 'quick_send' }, { onConflict: 'client_id,phone', ignoreDuplicates: false });

    const { data: lead } = await supabaseAdmin.from('leads').select('id').eq('client_id', req.clientId).eq('phone', phone).single();

    const { data: clientRow } = await supabaseAdmin.from('clients').select('whatsapp_provider').eq('id', req.clientId).single();
    const provider = getProvider(clientRow?.whatsapp_provider || 'baileys');
    await provider.sendMessage(req.clientId, phone, message);

    if (lead) {
      await supabaseAdmin.from('conversations').insert({
        lead_id: lead.id,
        client_id: req.clientId,
        message,
        sender: 'human_agent',
        status: 'sent',
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BULK SEND: CSV upload (columns: name, phone) + message template with {{name}}
router.post('/bulk-send', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV file required (columns: name, phone)' });
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message template is required' });

    const records = parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true, trim: true });
    const recipients = records.map((r) => ({ name: r.name, phone: r.phone })).filter((r) => r.phone);

    if (recipients.length === 0) return res.status(400).json({ error: 'No valid recipients found in CSV' });

    const result = await startBulkSend(req.clientId, recipients, message);
    res.json({ ...result, message: `Bulk send started for ${recipients.length} recipients. Sending gradually to avoid WhatsApp bans - this may take a while.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BULK SEND TO EXISTING LEADS: no CSV needed - pick from leads already
// on file (from an earlier upload, inbound conversations, etc).
router.post('/bulk-send-existing', async (req, res) => {
  try {
    const { leadIds, message } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds array is required' });
    }
    if (!message) return res.status(400).json({ error: 'message is required' });

    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('id, name, phone, jid_type, whatsapp_lid')
      .eq('client_id', req.clientId)
      .in('id', leadIds);
    if (error) throw error;
    if (!leads || leads.length === 0) return res.status(400).json({ error: 'No matching leads found' });

    const result = await startBulkSendToLeads(req.clientId, leads, message);
    res.json({ ...result, message: `Bulk send started for ${leads.length} leads. Sending gradually to avoid WhatsApp bans - this may take a while.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;