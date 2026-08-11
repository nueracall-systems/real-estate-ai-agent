-- ============================================================
-- SCHEMA UPDATE v3
-- ============================================================
-- WhatsApp has started routing some contacts through a privacy
-- "@lid" identifier instead of their real phone number (this is
-- a WhatsApp-side rollout, not something we control). This column
-- tells the backend which kind of ID is stored in leads.phone, so
-- it can build the correct WhatsApp address when sending a reply.
--
-- Run this once in Supabase SQL Editor (same place you ran
-- supabase_schema.sql and schema_update_v2.sql).
-- ============================================================

alter table leads
  add column if not exists jid_type text default 'phone' check (jid_type in ('phone', 'lid'));
