-- ============================================================
-- SCHEMA UPDATE v7
-- ============================================================
-- Adds area_gaj to properties. In Indian real estate, customers
-- almost always ask plot/area size (in gaj / square yards) right
-- after asking the BHK. Instead of letting the AI guess this
-- (which would be an invented, possibly wrong number - a real
-- risk to the agency's reputation), we now store it as real data
-- per property. When it's not filled in for a property, the AI is
-- instructed to honestly say it'll confirm rather than guess.
--
-- Run this once in Supabase SQL Editor.
-- ============================================================

alter table properties
  add column if not exists area_gaj numeric;
