-- ============================================================
-- SCHEMA UPDATE v8
-- ============================================================
-- Stores WhatsApp session data (Baileys auth state) in the
-- database instead of local disk files. This means the WhatsApp
-- connection survives server restarts, redeploys, and even
-- switching hosting providers entirely - no more re-scanning the
-- QR code just because the host's disk got wiped.
--
-- Run this once in Supabase SQL Editor.
-- ============================================================

create table if not exists whatsapp_sessions (
  client_id uuid not null references clients(id) on delete cascade,
  session_key text not null,   -- e.g. 'creds', 'app-state-sync-key-abc123'
  data jsonb not null,
  updated_at timestamptz default now(),
  primary key (client_id, session_key)
);

create index if not exists idx_whatsapp_sessions_client on whatsapp_sessions(client_id);

alter table whatsapp_sessions enable row level security;

-- Backend only (service role key bypasses RLS) - no client-facing access needed
create policy "whatsapp_sessions_admin_all" on whatsapp_sessions for all
  using (is_admin());
