-- ============================================================
-- SCHEMA UPDATE v6
-- ============================================================
-- Gives the AI a persistent "memory" per lead - a running summary
-- of key facts learned (budget, preferred location, family size,
-- urgency, commitments made, etc). This is separate from the raw
-- message history window, so the AI never "forgets" earlier
-- context even in a very long conversation, and never loses it
-- even if the recent-messages window is limited for performance.
--
-- Run this once in Supabase SQL Editor.
-- ============================================================

alter table leads
  add column if not exists ai_memory text;
