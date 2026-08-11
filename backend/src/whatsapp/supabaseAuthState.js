// ============================================================
// SUPABASE-BACKED WHATSAPP AUTH STATE
// ============================================================
// Drop-in replacement for Baileys' useMultiFileAuthState(). Instead of
// writing session files to local disk (backend/sessions/<clientId>/...),
// this reads/writes the exact same data to a `whatsapp_sessions` table in
// Supabase.
//
// WHY THIS MATTERS: many hosting platforms (including Render's free tier)
// wipe the local disk on every restart/redeploy. That used to mean the
// WhatsApp session got logged out and needed a fresh QR scan every time
// the server restarted. Storing the session in Supabase instead makes the
// connection survive restarts, redeploys, and even switching hosting
// providers entirely - the disk is no longer involved at all.
//
// This mirrors the exact interface useMultiFileAuthState returns
// ({ state: { creds, keys }, saveCreds }), so baileysProvider.js barely
// changes - it just calls this instead.
// ============================================================

import { logger } from '../utils/logger.js';
import { supabaseAdmin } from '../config/supabaseClient.js';

const baileysNamespace = await import('@whiskeysockets/baileys');
const baileysDefault = baileysNamespace.default ?? baileysNamespace;
function pick(name) {
  return baileysNamespace[name] ?? baileysDefault?.[name];
}

const initAuthCreds = pick('initAuthCreds');
const BufferJSON = pick('BufferJSON');
const proto = pick('proto');

async function writeData(clientId, key, data) {
  const serialized = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
  const { error } = await supabaseAdmin
    .from('whatsapp_sessions')
    .upsert({ client_id: clientId, session_key: key, data: serialized, updated_at: new Date().toISOString() }, { onConflict: 'client_id,session_key' });
  if (error) logger.error(`Failed to save WhatsApp session key "${key}" for client ${clientId}:`, error.message);
}

async function readData(clientId, key) {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_sessions')
    .select('data')
    .eq('client_id', clientId)
    .eq('session_key', key)
    .maybeSingle();
  if (error || !data) return null;
  return JSON.parse(JSON.stringify(data.data), BufferJSON.reviver);
}

async function removeData(clientId, key) {
  await supabaseAdmin.from('whatsapp_sessions').delete().eq('client_id', clientId).eq('session_key', key);
}

export async function clearSupabaseAuthState(clientId) {
  await supabaseAdmin.from('whatsapp_sessions').delete().eq('client_id', clientId);
}

export async function useSupabaseAuthState(clientId) {
  const creds = (await readData(clientId, 'creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(clientId, `${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(clientId, key, value) : removeData(clientId, key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeData(clientId, 'creds', creds),
    // Wipes this client's stored session entirely - used when WhatsApp
    // logs the device out and a completely fresh QR pairing is needed.
    clearCreds: () => clearSupabaseAuthState(clientId),
  };
}