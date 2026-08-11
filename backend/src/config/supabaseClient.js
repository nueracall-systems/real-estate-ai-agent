import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Node.js versions below 22 don't have a native WebSocket global, but
// @supabase/supabase-js's realtime client expects one. This polyfills it
// using the 'ws' package so the app works on Node 18/20 too.
if (typeof globalThis.WebSocket === 'undefined') {
  const { default: WebSocket } = await import('ws');
  globalThis.WebSocket = WebSocket;
}

// Service role client - used by backend only (bypasses RLS, so backend must
// always manually filter by client_id in queries to keep tenants isolated).
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
