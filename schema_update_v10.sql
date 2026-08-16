-- ============================================================
-- SCHEMA UPDATE v10
-- ============================================================
-- 1) bulk_send_jobs - tracks the result of every Quick Send / Bulk
--    Send attempt in detail (which numbers succeeded, which failed
--    and why - e.g. not on WhatsApp), so the client can actually see
--    what happened instead of just "sent".
-- 2) client_questions - when the AI tells a customer "I'll confirm
--    and get back to you", it logs the real question here. The
--    client answers it from the dashboard, and the answer is sent
--    to the customer automatically and remembered by the AI.
--
-- Run this once in Supabase SQL Editor.
-- ============================================================

create table if not exists bulk_send_jobs (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  total_recipients integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  status text default 'running' check (status in ('running', 'completed')),
  results jsonb default '[]',   -- [{ phone, name, status: 'sent'|'failed', reason }]
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_bulk_send_jobs_client on bulk_send_jobs(client_id, created_at desc);
alter table bulk_send_jobs enable row level security;

create policy "bulk_send_jobs_self" on bulk_send_jobs for all
  using (client_id = my_client_id())
  with check (client_id = my_client_id());

create policy "bulk_send_jobs_admin_all" on bulk_send_jobs for all
  using (is_admin());

create table if not exists client_questions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  question_text text not null,
  status text default 'pending' check (status in ('pending', 'answered')),
  answer_text text,
  created_at timestamptz default now(),
  answered_at timestamptz
);

create index if not exists idx_client_questions_client on client_questions(client_id, status);
alter table client_questions enable row level security;

create policy "client_questions_self" on client_questions for all
  using (client_id = my_client_id())
  with check (client_id = my_client_id());

create policy "client_questions_admin_all" on client_questions for all
  using (is_admin());