-- ============================================================
-- SCHEMA UPDATE v11
-- ============================================================
-- Caches phone-number <-> lid mappings that WhatsApp sends us during
-- history sync (a real protocol-level mapping, not a guess). This lets
-- us show the customer's REAL phone number (and match their name if
-- already saved) even when WhatsApp routes their messages through a
-- "@lid" privacy identity - for both new inbound contacts and existing
-- ones, not just contacts we messaged first.
--
-- Run this once in Supabase SQL Editor.
-- ============================================================

create table if not exists whatsapp_lid_mappings (
  client_id uuid not null references clients(id) on delete cascade,
  lid text not null,
  phone text not null,
  updated_at timestamptz default now(),
  primary key (client_id, lid)
);

create index if not exists idx_whatsapp_lid_mappings_phone on whatsapp_lid_mappings(client_id, phone);
alter table whatsapp_lid_mappings enable row level security;

create policy "whatsapp_lid_mappings_admin_all" on whatsapp_lid_mappings for all
  using (is_admin());