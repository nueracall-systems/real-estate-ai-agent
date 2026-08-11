-- ============================================================
-- SCHEMA UPDATE V2 — Plans, Payments, Billing Tracking
-- Run this in Supabase SQL Editor (safe to run once, after the
-- original supabase_schema.sql already exists)
-- ============================================================

-- 1. PLANS — admin-defined pricing plans (e.g. Starter ₹15000/mo, Pro ₹25000/mo)
create table if not exists plans (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  price numeric not null,
  duration_months int not null default 1,   -- default billing cycle length
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. Extend CLIENTS table with plan + billing info
alter table clients add column if not exists plan_id uuid references plans(id) on delete set null;
alter table clients add column if not exists billing_months int default 1;         -- how many months this cycle covers
alter table clients add column if not exists next_due_date date;                    -- when next payment is due
alter table clients add column if not exists payment_status text default 'paid' check (payment_status in ('paid', 'due', 'overdue'));

-- 3. PAYMENTS — history log of every payment received
create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  plan_id uuid references plans(id) on delete set null,
  amount numeric not null,
  months_covered int not null default 1,
  paid_on date not null default current_date,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_payments_client_id on payments(client_id);
create index if not exists idx_clients_next_due_date on clients(next_due_date);

-- RLS: admin-only access (payments/plans are admin business data)
alter table plans enable row level security;
alter table payments enable row level security;

create policy "plans_admin_all" on plans for all
  using (is_admin()) with check (is_admin());

create policy "payments_admin_all" on payments for all
  using (is_admin()) with check (is_admin());

-- Let a client see their own payment history (read-only) if you show it in their dashboard later
create policy "payments_self_select" on payments for select
  using (client_id = my_client_id());

-- ============================================================
-- Seed a couple of example plans (edit/delete as you like)
-- ============================================================
insert into plans (name, price, duration_months, description) values
  ('Starter', 15000, 1, 'Basic WhatsApp AI agent - up to 1 property listing page'),
  ('Growth', 25000, 1, 'Full featured plan - unlimited properties, bulk send, analytics'),
  ('Growth - Quarterly', 22000, 3, 'Growth plan billed every 3 months at a discount')
on conflict do nothing;
