-- ============================================================
-- SCHEMA UPDATE v9
-- ============================================================
-- 1) Daily auto-send schedules for Bulk Send (pick a template + a
--    time of day, and the system sends it to every lead automatically
--    every day at that time - no manual typing needed).
-- 2) Project-level fields on properties, for large listings like a
--    whole township/society/plotted development (measured in bigha,
--    with a developer, possession date, RERA number, etc) as opposed
--    to a single flat/plot.
--
-- Run this once in Supabase SQL Editor.
-- ============================================================

create table if not exists scheduled_bulk_sends (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  template_id uuid references message_templates(id) on delete set null,
  send_time time not null,            -- time of day (IST) to send, e.g. '10:00:00'
  is_active boolean default true,
  last_sent_date date,                -- prevents sending twice in the same day
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_scheduled_bulk_sends_client on scheduled_bulk_sends(client_id);
alter table scheduled_bulk_sends enable row level security;

create policy "scheduled_bulk_sends_self" on scheduled_bulk_sends for all
  using (client_id = my_client_id())
  with check (client_id = my_client_id());

create policy "scheduled_bulk_sends_admin_all" on scheduled_bulk_sends for all
  using (is_admin());

-- ------------------------------------------------------------
-- Project-level fields on properties
-- ------------------------------------------------------------
alter table properties
  add column if not exists listing_category text default 'unit' check (listing_category in ('unit', 'project'));

alter table properties add column if not exists land_area_bigha numeric;
alter table properties add column if not exists developer_name text;
alter table properties add column if not exists possession_date date;
alter table properties add column if not exists rera_number text;
alter table properties add column if not exists total_units integer;
alter table properties add column if not exists amenities text;