// ============================================================
// META WHATSAPP CLOUD API PROVIDER (Official)
// ============================================================
// Use this once a client has signed and you've completed Meta
// Business verification for their number. This talks directly
// to Meta's official Graph API - no QR code needed, no ban risk.
//
// Setup needed before this works:
// 1. Create a Meta Business Manager account
// 2. Create a WhatsApp Business Account (WABA) + verify business
// 3. Get a permanent access token + phone_number_id
// 4. Set META_CLOUD_API_TOKEN and META_PHONE_NUMBER_ID in .env
//    (or store per-client in clients table for true multi-tenant use)
// ============================================================
 
import { logger } from '../utils/logger.js';
 
const GRAPH_API_VERSION = 'v20.0';
 
export async function startSession(clientId, callbacks = {}) {
  // Cloud API has no QR/session concept - it's just API calls.
  // Webhook setup (done once in Meta dashboard) handles incoming messages.
  // This function exists only so the interface matches baileysProvider.
  logger.info(`Cloud API "session" ready for client ${clientId} (no QR needed).`);
  if (callbacks.onReady) callbacks.onReady();
}
 
export async function sendMessage(clientId, toNumber, text, jidType = 'phone') {
  // jidType is not relevant for the official Cloud API - it only ever
  // uses real phone numbers - accepted here just so both providers share
  // the same call signature.
  const token = process.env.META_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
 
  if (!token || !phoneNumberId) {
    throw new Error('Meta Cloud API credentials not configured for this client yet.');
  }
 
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
 
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'text',
      text: { body: text },
    }),
  });
 
  const data = await res.json();
  if (!res.ok) {
    logger.error('Cloud API send failed:', data);
    throw new Error(data?.error?.message || 'Failed to send via Cloud API');
  }
  return data;
}
 
export function getStatus(clientId) {
  const configured = !!(process.env.META_CLOUD_API_TOKEN && process.env.META_PHONE_NUMBER_ID);
  return { connected: configured, provider: 'cloud_api' };
}
 
export async function logout(clientId) {
  // Nothing to log out of - just informational.
  logger.info(`Cloud API provider does not require logout for client ${clientId}.`);
}
 
// ============================================================
// Webhook handler - call this from routes/whatsappRoutes.js when
// Meta POSTs an incoming message to your webhook endpoint.
// ============================================================
export function parseIncomingWebhook(body) {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message) return null;
 
    return {
      fromNumber: message.from,
      text: message.text?.body || '',
    };
  } catch (err) {
    logger.error('Failed to parse Cloud API webhook body:', err);
    return null;
  }
}