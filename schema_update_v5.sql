-- ============================================================
-- SCHEMA UPDATE v5
-- ============================================================
-- Adds granular WhatsApp connection status to clients, so the
-- dashboard can show "Connected" / "Reconnecting..." / "Needs
-- Reconnect" instead of just a plain true/false. Paired with the
-- new backoff+alert reconnect logic in baileysProvider.js - a
-- client should NEVER silently sit disconnected for hours without
-- knowing, since inbound/outbound reliability is the entire paid
-- product.
--
-- Run this once in Supabase SQL Editor.
-- ============================================================

alter table clients
  add column if not exists whatsapp_status text default 'disconnected'
  check (whatsapp_status in ('connected', 'reconnecting', 'needs_reconnect', 'disconnected'));
