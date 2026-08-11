// ============================================================
// WHATSAPP CONNECTION ROUTES
// ============================================================
// Client dashboard calls /connect to start a Baileys session and
// streams the QR code back via Server-Sent Events until they scan it.
// ============================================================

import express from 'express';
import { requireAuth, requireClient } from '../middleware/authMiddleware.js';
import { getProvider } from '../whatsapp/whatsappProvider.js';
import { handleIncomingMessage } from '../services/messageHandler.js';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { parseIncomingWebhook } from '../whatsapp/cloudApiProvider.js';

const router = express.Router();

// SSE stream: sends QR code image (data URL) as it's generated, then "ready" event
router.get('/connect-stream', requireAuth, requireClient, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = req.clientId;
  const provider = getProvider('baileys');

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await provider.startSession(clientId, {
      onQr: (qrDataUrl) => sendEvent('qr', { qr: qrDataUrl }),
      onReady: () => {
        sendEvent('ready', { connected: true });
        res.end();
      },
      onMessage: (fromNumber, text, opts) => {
        handleIncomingMessage(clientId, fromNumber, text, opts?.jidType);
      },
    });
  } catch (err) {
    sendEvent('error', { message: err.message });
    res.end();
  }

  req.on('close', () => res.end());
});

router.get('/status', requireAuth, requireClient, async (req, res) => {
  try {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('whatsapp_connected, whatsapp_provider, whatsapp_status')
      .eq('id', req.clientId)
      .single();
    const provider = getProvider(client?.whatsapp_provider || 'baileys');
    const status = provider.getStatus(req.clientId);
    res.json({ ...status, dbStatus: client });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/disconnect', requireAuth, requireClient, async (req, res) => {
  try {
    const { data: client } = await supabaseAdmin.from('clients').select('whatsapp_provider').eq('id', req.clientId).single();
    const provider = getProvider(client?.whatsapp_provider || 'baileys');
    await provider.logout(req.clientId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// META CLOUD API WEBHOOK (public, no auth - Meta calls this directly)
// Used only once a client has been migrated to official Cloud API.
// Configure this URL in Meta App Dashboard -> WhatsApp -> Configuration.
// ============================================================
router.get('/cloud-webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

router.post('/cloud-webhook/:clientId', express.json(), async (req, res) => {
  try {
    const { clientId } = req.params;
    const parsed = parseIncomingWebhook(req.body);
    if (parsed) {
      handleIncomingMessage(clientId, parsed.fromNumber, parsed.text);
    }
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(200); // always ack to Meta even on internal error
  }
});

export default router;