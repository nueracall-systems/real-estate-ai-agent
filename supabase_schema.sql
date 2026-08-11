-- ============================================================
-- WHATSAPP AI SALES AGENT - COMPLETE SUPABASE SCHEMA
-- Real Estate Multi-Tenant SaaS System
-- ============================================================
-- Run this entire file in Supabase SQL Editor (one go)
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES (links Supabase Auth users to role: admin/client)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'client')),
  full_name text,
  email text,
  created_at timestamptz default now()
);

-- ============================================================
-- 2. CLIENTS (core client/business record)
-- ============================================================
create table clients (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete set null, -- null until first login
  business_name text not null,
  contact_name text not null,
  phone text not null,
  email text,
  access_code text unique not null,          -- one-time code admin generates
  access_code_used boolean default false,     -- becomes true after first login/signup
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  monthly_price numeric default 25000,
  plan_start_date date,
  plan_renewal_date date,

  -- WhatsApp connection info
  whatsapp_connected boolean default false,
  whatsapp_provider text default 'baileys' check (whatsapp_provider in ('baileys', 'cloud_api')),
  whatsapp_number text,
  whatsapp_session_data jsonb,               -- stores Baileys session/auth state

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 3. CLIENT_PROFILE (business settings / AI persona config)
-- ============================================================
create table client_profile (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid unique not null references clients(id) on delete cascade,

  ai_tone text default 'friendly',            -- friendly / formal / persuasive
  ai_instructions text,                       -- custom instructions for AI behavior
  greeting_message text default 'Namaste! Kaise madad kar sakta hoon?',
  business_description text,

  working_hours_start time default '09:00',
  working_hours_end time default '19:00',
  working_days text[] default array['Mon','Tue','Wed','Thu','Fri','Sat'],

  updated_at timestamptz default now()
);

-- ============================================================
-- 4. PROPERTIES (listings, individual or bulk uploaded)
-- ============================================================
create table properties (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  title text not null,
  property_type text check (property_type in ('sale', 'rent')),
  bhk_type text,                              -- e.g. '2BHK', '3BHK', 'Plot', 'Commercial'
  location text not null,
  price numeric not null,
  status text default 'available' check (status in ('available', 'sold', 'rented', 'hold')),
  description text,
  images jsonb default '[]',                  -- array of image URLs

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 5. LEADS (potential customers, inbound or outbound)
-- ============================================================
create table leads (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  name text,
  phone text not null,
  source text default 'inbound' check (source in ('inbound', 'outbound', 'bulk', 'quick_send')),
  status text default 'new' check (status in ('new', 'hot', 'warm', 'cold', 'converted', 'lost')),

  budget_min numeric,
  budget_max numeric,
  preferred_location text,
  notes text,

  ai_handling boolean default true,           -- false = human has taken over this chat
  last_message_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (client_id, phone)                   -- one lead entry per phone per client
);

-- ============================================================
-- 6. CONVERSATIONS (chat history / message log)
-- ============================================================
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,

  message text not null,
  sender text not null check (sender in ('ai', 'lead', 'human_agent')),
  message_type text default 'text' check (message_type in ('text', 'template', 'image', 'document')),
  status text default 'sent' check (status in ('sent', 'delivered', 'read', 'failed')),

  created_at timestamptz default now()
);

-- ============================================================
-- 7. APPOINTMENTS (site visits / meetings)
-- ============================================================
create table appointments (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,

  scheduled_time timestamptz not null,
  status text default 'booked' check (status in ('booked', 'completed', 'cancelled', 'rescheduled')),
  location text,
  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 8. EMERGENCY_BLOCKS (DND — AI won't book meetings in this window)
-- ============================================================
create table emergency_blocks (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  start_time timestamptz not null,
  end_time timestamptz not null,
  reason text,
  auto_reschedule boolean default true,       -- auto reschedule existing bookings in this window
  is_active boolean default true,

  created_at timestamptz default now()
);

-- ============================================================
-- 9. MESSAGE_TEMPLATES (quick reusable messages)
-- ============================================================
create table message_templates (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  title text not null,
  content text not null,
  category text default 'general',            -- follow_up / site_visit / price_update / general

  created_at timestamptz default now()
);

-- ============================================================
-- 10. NOTIFICATIONS (alerts for client dashboard)
-- ============================================================
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  type text not null,                         -- hot_lead / appointment / system / usage_limit
  title text not null,
  message text,
  is_read boolean default false,

  created_at timestamptz default now()
);

-- ============================================================
-- 11. USAGE_TRACKING (Groq API / message usage per day per client)
-- ============================================================
create table usage_tracking (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  usage_date date not null default current_date,
  ai_replies_count int default 0,
  messages_sent_count int default 0,

  unique (client_id, usage_date)
);

-- ============================================================
-- 12. ADMIN_LOGS (audit trail of admin actions)
-- ============================================================
create table admin_logs (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references profiles(id) on delete set null,
  action text not null,                       -- e.g. 'client_added', 'client_suspended'
  target_client_id uuid references clients(id) on delete set null,
  details jsonb,

  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES (for faster queries as data grows)
-- ============================================================
create index idx_leads_client_id on leads(client_id);
create index idx_leads_status on leads(status);
create index idx_conversations_lead_id on conversations(lead_id);
create index idx_conversations_client_id on conversations(client_id);
create index idx_properties_client_id on properties(client_id);
create index idx_appointments_client_id on appointments(client_id);
create index idx_appointments_scheduled_time on appointments(scheduled_time);
create index idx_clients_access_code on clients(access_code);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — data isolation between clients
-- ============================================================

alter table profiles enable row level security;
alter table clients enable row level security;
alter table client_profile enable row level security;
alter table properties enable row level security;
alter table leads enable row level security;
alter table conversations enable row level security;
alter table appointments enable row level security;
alter table emergency_blocks enable row level security;
alter table message_templates enable row level security;
alter table notifications enable row level security;
alter table usage_tracking enable row level security;
alter table admin_logs enable row level security;

-- Helper function: check if logged-in user is admin
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- Helper function: get client_id belonging to logged-in user
create or replace function my_client_id()
returns uuid as $$
  select id from clients where profile_id = auth.uid();
$$ language sql security definer;

-- PROFILES: user can see own profile, admin sees all
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or is_admin());

-- CLIENTS: admin full access; client can see/update only their own row
create policy "clients_admin_all" on clients for all
  using (is_admin()) with check (is_admin());

create policy "clients_self_select" on clients for select
  using (profile_id = auth.uid());

create policy "clients_self_update" on clients for update
  using (profile_id = auth.uid());

-- Generic pattern for client-owned tables: admin full access + client sees own data only
create policy "client_profile_admin_all" on client_profile for all
  using (is_admin()) with check (is_admin());
create policy "client_profile_self" on client_profile for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

create policy "properties_admin_all" on properties for all
  using (is_admin()) with check (is_admin());
create policy "properties_self" on properties for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

create policy "leads_admin_all" on leads for all
  using (is_admin()) with check (is_admin());
create policy "leads_self" on leads for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

create policy "conversations_admin_all" on conversations for all
  using (is_admin()) with check (is_admin());
create policy "conversations_self" on conversations for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

create policy "appointments_admin_all" on appointments for all
  using (is_admin()) with check (is_admin());
create policy "appointments_self" on appointments for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

create policy "emergency_blocks_admin_all" on emergency_blocks for all
  using (is_admin()) with check (is_admin());
create policy "emergency_blocks_self" on emergency_blocks for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

create policy "message_templates_admin_all" on message_templates for all
  using (is_admin()) with check (is_admin());
create policy "message_templates_self" on message_templates for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

create policy "notifications_admin_all" on notifications for all
  using (is_admin()) with check (is_admin());
create policy "notifications_self" on notifications for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

create policy "usage_tracking_admin_all" on usage_tracking for all
  using (is_admin()) with check (is_admin());
create policy "usage_tracking_self_select" on usage_tracking for select
  using (client_id = my_client_id());

-- ADMIN_LOGS: only admin can see/write
create policy "admin_logs_admin_only" on admin_logs for all
  using (is_admin()) with check (is_admin());

-- ============================================================
-- DONE. Tables created: profiles, clients, client_profile,
-- properties, leads, conversations, appointments,
-- emergency_blocks, message_templates, notifications,
-- usage_tracking, admin_logs
-- ============================================================
