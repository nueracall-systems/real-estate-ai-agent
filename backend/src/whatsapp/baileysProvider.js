// ============================================================
// BAILEYS PROVIDER - Free/Unofficial WhatsApp connection
// ============================================================
// Used for MVP and for clients who haven't migrated to the
// official Meta Cloud API yet. Connects via QR code scan,
// same as WhatsApp Web.
//
// ANTI-BAN MEASURES BUILT IN:
// 1. Random human-like delay before every reply (see utils/delay.js)
// 2. "Typing..." indicator shown before sending (mimics human behavior)
// 3. Sessions persisted to disk so we don't force re-scans
// 4. Sequential per-client queue (utils/queue.js) so messages never
//    fire in a rapid burst
// ============================================================

import { createRequire } from 'module';
import QRCode from 'qrcode';
import { logger } from '../utils/logger.js';
import { humanDelay } from '../utils/delay.js';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { useSupabaseAuthState, clearSupabaseAuthState } from './supabaseAuthState.js';

// Baileys' export shape has changed across versions (some builds are CJS,
// some are pure ESM), which breaks a plain `import`/`require`. This tries
// dynamic import first (works for both, since Node wraps CJS transparently)
// and pulls whichever shape actually has the functions we need.
const baileysNamespace = await import('@whiskeysockets/baileys');
const baileysDefault = baileysNamespace.default ?? baileysNamespace;

function pick(name) {
  return baileysNamespace[name] ?? baileysDefault?.[name];
}

const makeWASocket =
  (typeof baileysDefault === 'function' ? baileysDefault : null) ||
  pick('makeWASocket') ||
  pick('default');
const DisconnectReason = pick('DisconnectReason');
const fetchLatestBaileysVersion = pick('fetchLatestBaileysVersion');

if (typeof makeWASocket !== 'function') {
  const require = createRequire(import.meta.url);
  let installedVersion = 'unknown';
  try {
    installedVersion = require('@whiskeysockets/baileys/package.json').version;
  } catch (e) {
    /* ignore */
  }
  throw new Error(
    `Failed to load Baileys correctly (installed version: ${installedVersion}). ` +
      `Top-level keys: [${Object.keys(baileysNamespace).join(', ')}], ` +
      `default keys: [${baileysDefault && typeof baileysDefault === 'object' ? Object.keys(baileysDefault).join(', ') : typeof baileysDefault}]. ` +
      `Fix: delete node_modules and package-lock.json, then run "npm install" again ` +
      `to get the pinned version (6.7.9) from package.json.`
  );
}

const activeSockets = new Map(); // clientId -> socket instance
const clientCallbacks = new Map(); // clientId -> { onQr, onReady, onMessage }

// Dedupe: WhatsApp/Baileys can sometimes fire the same inbound message
// twice (retries, resync overlap). We remember recently-seen message IDs
// per client and skip repeats. Capped size so it never grows unbounded.
const processedMessageIds = new Map(); // clientId -> Set of message ids
const MAX_TRACKED_IDS_PER_CLIENT = 500;

// Reconnect reliability: WhatsApp/Baileys can get stuck in a broken-session
// state where every reconnect attempt fails the same way forever (we saw
// this happen for real - "QR refs attempts ended" looping every ~2.5 min,
// non-stop, with zero visibility to the client that their AI agent was
// dead). We now back off between attempts and, after too many failures in
// a row, STOP auto-retrying and alert the client instead of looping silently.
const reconnectAttempts = new Map(); // clientId -> count
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 3000; // 3s, 6s, 12s, 24s, 48s

function alreadyProcessed(clientId, msgId) {
  if (!msgId) return false;
  let seen = processedMessageIds.get(clientId);
  if (!seen) {
    seen = new Set();
    processedMessageIds.set(clientId, seen);
  }
  if (seen.has(msgId)) return true;
  seen.add(msgId);
  if (seen.size > MAX_TRACKED_IDS_PER_CLIENT) {
    // drop the oldest entry (first inserted) to keep memory bounded
    const oldest = seen.values().next().value;
    seen.delete(oldest);
  }
  return false;
}

/**
 * Starts (or resumes) a WhatsApp session for a client.
 * callbacks: { onQr(qrDataUrl), onReady(), onMessage(fromNumber, text) }
 */
export async function startSession(clientId, callbacks = {}) {
  clientCallbacks.set(clientId, callbacks);

  // Session credentials/keys are stored in Supabase (whatsapp_sessions
  // table), not on local disk - this survives server restarts, redeploys,
  // and even switching hosting providers entirely.
  const { state, saveCreds, clearCreds } = await useSupabaseAuthState(clientId);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['RealEstate AI Agent', 'Chrome', '1.0'],
    // Ping WhatsApp's servers every 20s (default is higher) so a dead
    // connection is detected and reconnected quickly instead of sitting
    // silently broken - directly improves 24/7 inbound reliability.
    keepAliveIntervalMs: 20000,
    // Give slow mobile/shared networks more room before giving up on a
    // request, instead of erroring out on a momentary blip.
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    syncFullHistory: false, // we don't need old chat history, keeps startup fast and light
  });

  activeSockets.set(clientId, sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr);
      const cb = clientCallbacks.get(clientId);
      if (cb?.onQr) cb.onQr(qrDataUrl);
    }

    if (connection === 'open') {
      logger.info(`WhatsApp connected for client ${clientId}`);
      reconnectAttempts.set(clientId, 0); // reset - we're healthy again

      await supabaseAdmin
        .from('clients')
        .update({ whatsapp_connected: true, whatsapp_provider: 'baileys', whatsapp_status: 'connected' })
        .eq('id', clientId);

      const cb = clientCallbacks.get(clientId);
      if (cb?.onReady) cb.onReady();
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn(`WhatsApp connection closed for client ${clientId}. Reconnect: ${shouldReconnect}`);

      await supabaseAdmin
        .from('clients')
        .update({ whatsapp_connected: false })
        .eq('id', clientId);

      const attempts = (reconnectAttempts.get(clientId) || 0) + 1;
      reconnectAttempts.set(clientId, attempts);

      if (shouldReconnect && attempts <= MAX_RECONNECT_ATTEMPTS) {
        // Exponential backoff so we don't hammer WhatsApp's servers
        // (repeated rapid reconnects is itself a ban risk) and give a
        // flaky network a real chance to recover.
        const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, attempts - 1);
        logger.warn(`Reconnect attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS} for client ${clientId} in ${delay}ms`);
        await supabaseAdmin.from('clients').update({ whatsapp_status: 'reconnecting' }).eq('id', clientId);
        setTimeout(() => startSession(clientId, clientCallbacks.get(clientId)), delay);
      } else {
        // Either WhatsApp logged this device out, or we've retried too many
        // times in a row and something is genuinely broken (corrupted
        // session, etc). Stop looping silently - this is exactly the kind
        // of failure that must NEVER go unnoticed, since inbound/outbound
        // reliability is the entire paid product.
        activeSockets.delete(clientId);
        reconnectAttempts.set(clientId, 0);
        const reason = shouldReconnect ? 'repeated_connection_failures' : 'logged_out';
        logger.error(`Giving up auto-reconnect for client ${clientId} (reason: ${reason}). Manual QR re-scan required.`);

        if (reason === 'logged_out') {
          // WhatsApp explicitly logged this device out - the stored
          // credentials are dead, clear them so the next connect attempt
          // starts a genuinely fresh QR pairing instead of retrying with
          // creds that will never work again.
          await clearCreds();
        }

        await supabaseAdmin.from('clients').update({ whatsapp_status: 'needs_reconnect' }).eq('id', clientId);
        try {
          await supabaseAdmin.from('notifications').insert({
            client_id: clientId,
            type: 'whatsapp_disconnected',
            title: 'WhatsApp Disconnected',
            message:
              reason === 'logged_out'
                ? 'Your WhatsApp was logged out (e.g. removed as a linked device from your phone). Go to WhatsApp Connect and scan the QR code again to resume replying to leads.'
                : 'WhatsApp keeps failing to reconnect. Go to WhatsApp Connect and scan the QR code again to resume replying to leads.',
          });
        } catch (err) {
          logger.error(`Failed to write disconnect notification for client ${clientId}:`, err.message);
        }
      }
    }
  });

  // Incoming message listener.
  // IMPORTANT: Baileys tags each batch with a `type`. 'notify' = delivered
  // live in real time. 'append' = delivered because WhatsApp's server
  // marked it `offline: true` - i.e. this message arrived WHILE OUR
  // CONNECTION WAS DOWN/RECONNECTING, and WhatsApp queued it and delivered
  // it the moment we came back online. This is exactly the "customer
  // replied after some time" scenario - it is a completely genuine new
  // message, not old history (history resync is a totally separate event,
  // `messaging-history.set`, and never touches this listener). We must
  // process both types the same way, with no time cutoff, so a lead NEVER
  // gets silence just because they replied while we briefly reconnected.
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;

    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue; // ignore our own sent messages
        if (!msg.message) continue;
        if (msg.key.remoteJid === 'status@broadcast') continue; // ignore status updates
        if (msg.key.remoteJid?.endsWith('@g.us')) continue; // ignore group messages (MVP: 1-on-1 only)

        // Dedupe: Baileys/WhatsApp occasionally deliver the exact same
        // message twice. Skip anything we've already handled.
        if (alreadyProcessed(clientId, msg.key.id)) {
          logger.info(`Duplicate inbound message ${msg.key.id} for client ${clientId} - skipping.`);
          continue;
        }

        const rawJid = msg.key.remoteJid || '';
        // WhatsApp is rolling out "@lid" privacy IDs for some contacts -
        // these replace the phone number with an opaque linked-ID. When
        // that happens the message no longer carries the real phone
        // number at all, so we track it as a stable pseudo-ID instead
        // (still unique per contact, just not a dialable number).
        const isLid = rawJid.endsWith('@lid');
        const fromNumber = rawJid.replace('@s.whatsapp.net', '').replace('@lid', '');
        const jidType = isLid ? 'lid' : 'phone';
        const text = extractMessageText(msg.message);

        if (!fromNumber || !text) {
          logger.info(`Skipped inbound message for client ${clientId}: no extractable text (type keys: ${Object.keys(msg.message || {}).join(',')})`);
          continue;
        }

        if (isLid) {
          logger.info(`Inbound message for client ${clientId} from LID ${fromNumber} (WhatsApp privacy ID, not a phone number): "${text}"`);
        } else {
          logger.info(`Inbound message for client ${clientId} from ${fromNumber}: "${text}"`);
        }

        const cb = clientCallbacks.get(clientId);
        if (cb?.onMessage) {
          cb.onMessage(fromNumber, text, { jidType });
        } else {
          logger.warn(`No onMessage callback registered for client ${clientId} - message will not get an AI reply. This usually means the session was resumed without callbacks wired up.`);
        }
      } catch (err) {
        logger.error(`Error processing inbound message for client ${clientId}:`, err);
      }
    }
  });

  // Best-effort: if WhatsApp ever shares the real phone number behind a
  // @lid contact (this happens via an explicit in-app action on their
  // side), backfill it onto the matching lead so the dashboard can show
  // a real number instead of the opaque ID.
  sock.ev.on('chats.phoneNumberShare', async ({ lid, jid }) => {
    try {
      const lidNumber = lid?.replace('@lid', '');
      const phoneNumber = jid?.replace('@s.whatsapp.net', '');
      if (!lidNumber || !phoneNumber) return;

      logger.info(`Client ${clientId}: WhatsApp shared real number ${phoneNumber} for LID ${lidNumber}`);

      await supabaseAdmin
        .from('leads')
        .update({ phone: phoneNumber, jid_type: 'phone' })
        .eq('client_id', clientId)
        .eq('phone', lidNumber)
        .eq('jid_type', 'lid');
    } catch (err) {
      logger.error(`Error handling phoneNumberShare for client ${clientId}:`, err);
    }
  });

  return sock;
}

/**
 * Pulls plain text out of a Baileys message object, unwrapping common
 * wrapper types (ephemeral / view-once messages) that regular WhatsApp
 * clients send by default when disappearing messages are involved, and
 * a couple of interactive reply types.
 */
function extractMessageText(message) {
  if (!message) return '';

  // Unwrap ephemeral / view-once wrappers (recurse one level)
  const unwrapped =
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.viewOnceMessageV2Extension?.message ||
    message.documentWithCaptionMessage?.message ||
    message;

  return (
    unwrapped.conversation ||
    unwrapped.extendedTextMessage?.text ||
    unwrapped.imageMessage?.caption ||
    unwrapped.videoMessage?.caption ||
    unwrapped.buttonsResponseMessage?.selectedDisplayText ||
    unwrapped.listResponseMessage?.title ||
    ''
  ).trim();
}

/**
 * Sends a text message with a human-like typing delay (anti-ban).
 */
export async function sendMessage(clientId, toNumber, text, jidType = 'phone') {
  const sock = activeSockets.get(clientId);
  if (!sock) {
    throw new Error('WhatsApp is not connected right now. Please go to WhatsApp Connect and scan the QR code again, then retry.');
  }

  // IMPORTANT: contacts routed through WhatsApp's "@lid" privacy ID must be
  // messaged using an @lid JID, not @s.whatsapp.net - using the wrong suffix
  // silently fails to deliver (no error, message just never arrives).
  let jid;
  if (toNumber.includes('@lid') || toNumber.includes('@s.whatsapp.net')) {
    jid = toNumber;
  } else if (jidType === 'lid') {
    jid = `${toNumber}@lid`;
  } else {
    jid = `${toNumber}@s.whatsapp.net`;
  }

  // Anti-ban: random delay + typing indicator before sending
  const minDelay = parseInt(process.env.MIN_REPLY_DELAY_MS || '3000');
  const maxDelay = parseInt(process.env.MAX_REPLY_DELAY_MS || '8000');

  await sock.presenceSubscribe(jid);
  await sock.sendPresenceUpdate('composing', jid);
  await humanDelay(minDelay, maxDelay);
  await sock.sendPresenceUpdate('paused', jid);

  await sock.sendMessage(jid, { text });
  return true;
}

export function getStatus(clientId) {
  const sock = activeSockets.get(clientId);
  return { connected: !!sock, provider: 'baileys' };
}

export async function logout(clientId) {
  const sock = activeSockets.get(clientId);
  if (sock) {
    await sock.logout();
    activeSockets.delete(clientId);
  }
  await clearSupabaseAuthState(clientId);
  await supabaseAdmin
    .from('clients')
    .update({ whatsapp_connected: false, whatsapp_status: 'disconnected' })
    .eq('id', clientId);
}