// ============================================================
// CLIENT QUESTIONS ROUTES
// ============================================================
// When the AI tells a customer "I'll confirm and get back to you", it
// logs the real question here (see messageHandler.js). The client
// answers from the dashboard, and submitting the answer:
//   1. Sends it straight to the customer on WhatsApp, automatically
//   2. Saves it into the lead's persistent AI memory, so the AI never
//      has to ask (or get asked) the same thing again
// ============================================================

import express from 'express';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireClient } from '../middleware/authMiddleware.js';
import { getProvider } from '../whatsapp/whatsappProvider.js';
import { persistResolvedLid } from '../utils/leadIdentity.js';

const router = express.Router();
router.use(requireAuth, requireClient);

// List questions (pending by default, or ?status=answered)
router.get('/', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const { data, error } = await supabaseAdmin
      .from('client_questions')
      .select('*, leads(name, phone)')
      .eq('client_id', req.clientId)
      .eq('status', status)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ questions: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit an answer - sends it to the customer on WhatsApp right away
// and remembers it for the AI going forward.
router.post('/:id/answer', async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer || !answer.trim()) return res.status(400).json({ error: 'answer is required' });

    const { data: question, error: qErr } = await supabaseAdmin
      .from('client_questions')
      .select('*, leads(*)')
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .single();
    if (qErr) throw qErr;
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const lead = question.leads;
    const { data: clientRow } = await supabaseAdmin
      .from('clients')
      .select('whatsapp_provider')
      .eq('id', req.clientId)
      .single();

    const provider = getProvider(clientRow?.whatsapp_provider || 'baileys');
    const sendTarget = lead.jid_type === 'lid' ? (lead.whatsapp_lid || lead.phone) : lead.phone;

    // Send the answer to the customer, phrased naturally
    const messageToCustomer = answer.trim();
    const sendResult = await provider.sendMessage(req.clientId, sendTarget, messageToCustomer, lead.jid_type || 'phone');
    await persistResolvedLid(lead.id, lead.whatsapp_lid, sendResult);

    await supabaseAdmin.from('conversations').insert({
      lead_id: lead.id,
      client_id: req.clientId,
      message: messageToCustomer,
      sender: 'human_agent',
      status: 'sent',
    });

    // Remember this for the AI so it's never asked again
    const memoryAddition = `Q: ${question.question_text} | A: ${answer.trim()}`;
    const combinedMemory = [lead.ai_memory, memoryAddition].filter(Boolean).join(' ');
    await supabaseAdmin.from('leads').update({ ai_memory: combinedMemory }).eq('id', lead.id);

    // Mark the question resolved
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('client_questions')
      .update({ status: 'answered', answer_text: answer.trim(), answered_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*, leads(name, phone)')
      .single();
    if (updateErr) throw updateErr;

    res.json({ question: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;