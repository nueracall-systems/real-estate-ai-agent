// ============================================================
// WHATSAPP PROVIDER ABSTRACTION LAYER
// ============================================================
// This is the key file that lets us switch a client from Baileys
// (free/unofficial) to Meta Cloud API (official) by just changing
// clients.whatsapp_provider in the database - no rewriting business
// logic anywhere else in the app.
//
// Every provider implements the same interface:
//   startSession(clientId, callbacks)
//   sendMessage(clientId, toNumber, text)
//   getStatus(clientId)
//   logout(clientId)
// ============================================================

import * as baileysProvider from './baileysProvider.js';
import * as cloudApiProvider from './cloudApiProvider.js';

export function getProvider(providerName) {
  if (providerName === 'cloud_api') return cloudApiProvider;
  return baileysProvider; // default for MVP
}
