-- ============================================================
-- SCHEMA UPDATE v4
-- ============================================================
-- Keeps the customer's real phone number visible everywhere, even when
-- WhatsApp routes their replies through a "@lid" privacy ID instead of
-- their number. We store the lid separately from phone, so `phone`
-- always stays the real number the client actually contacted (shown in
-- Leads / Conversations), while whatsapp_lid is only used internally to
-- know where to actually deliver the WhatsApp message.
--
-- Run this once in Supabase SQL Editor.
-- ============================================================

alter table leads
  add column if not exists whatsapp_lid text;

create index if not exists idx_leads_whatsapp_lid on leads(whatsapp_lid);
