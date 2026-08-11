# WhatsApp AI Real Estate Sales Agent — Full System

Multi-tenant WhatsApp AI sales assistant for real estate agents. One codebase, sellable to multiple clients.

## What's New (Latest Update)
- Fixed inbound message handling (was silently dropping real WhatsApp replies wrapped in ephemeral/view-once format)
- Dark sidebar theme + colorful stat cards on both dashboards
- Real-time graphs on client dashboard (leads over time, status breakdown, AI activity)
- New "All Conversations" page for the client to see every chat in one place
- Admin: Plans management (define pricing plans), Clients & Billing page with due-date tracking and payment recording, revenue graph on Overview

## What's Inside

```
project/
├── supabase_schema.sql      # Run this in Supabase SQL Editor first
├── backend/                 # Node.js + Express API (Baileys + Groq + Supabase)
├── admin-dashboard/         # React app - only for you (add/manage clients)
└── client-dashboard/        # React app - for your paying clients
```

## Prerequisites

- Node.js 18+ installed
- A free [Supabase](https://supabase.com) account
- A free [Groq](https://console.groq.com) API key
- VS Code (or any editor)

---

## STEP 1 — Supabase Setup

1. Create a new project at supabase.com
2. Go to **SQL Editor**, paste the entire contents of `supabase_schema.sql`, and run it
3. Then paste the entire contents of `schema_update_v2.sql` (adds Plans + Payments + billing tracking) and run it too
4. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key (keep this secret, backend only)

## STEP 2 — Create Your Admin Account

Since there's no public admin signup (for security), create it manually:

1. In Supabase, go to **Authentication → Users → Add User** — create yourself a user with email/password
2. Go to **Table Editor → profiles** → insert a new row:
   - `id`: paste the UUID of the user you just created (from Authentication tab)
   - `role`: `admin`
   - `full_name`: your name
   - `email`: your email

## STEP 3 — Backend Setup

```bash
cd backend
npm install
```

A `.env` file is already included — just open it and fill in:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (from Step 1)
- `GROQ_API_KEY` (get free at console.groq.com)

Run it:
```bash
npm run dev
```
Backend runs at `http://localhost:5000`

## STEP 4 — Admin Dashboard Setup

```bash
cd admin-dashboard
npm install
```

A `.env` file is already included — open it and fill in:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the anon key, NOT service role)
- `VITE_API_URL=http://localhost:5000/api`

Run it:
```bash
npm run dev
```
Opens at `http://localhost:5173` — log in with the admin account you made in Step 2.

## STEP 5 — Client Dashboard Setup

```bash
cd client-dashboard
npm install
```

Same `.env` values as admin-dashboard (a `.env` file is already included — just fill it in).

Run it:
```bash
npm run dev
```
Opens at `http://localhost:5174`

---

## How The Full Flow Works

1. **You (admin)** log into admin-dashboard → click "Add Client" → fill business details → an **access code** is generated (e.g. `RE-8X92KP`)
2. Share that access code with your client (WhatsApp/call)
3. **Client** opens client-dashboard → clicks "Use your access code" → enters the code → sets their email/password
4. Client is guided through **Onboarding** (business info, AI tone, working hours)
5. Client goes to **WhatsApp Connect** → scans QR code with their WhatsApp number
6. Client adds their **Properties** (one by one or bulk CSV upload)
7. AI now automatically handles incoming WhatsApp messages using the client's property data
8. Client uses **Quick Send** / **Bulk Send** for outbound campaigns
9. Client can set **Emergency Block** windows, view **Leads/Inbox**, take over conversations manually, book **Appointments**, save **Templates**

---

## IMPORTANT: WhatsApp Ban Risk (Baileys)

This MVP uses **Baileys**, an unofficial WhatsApp Web automation library. It's free but carries a ban risk if used carelessly. Built-in protections:
- Random 3-8 second delay + typing indicator before every AI reply
- Random 5-15 second gap between bulk messages
- Sequential per-client message queue (never fires messages in a burst)

**Recommended:** Once a client signs and pays, migrate their number to the **official Meta WhatsApp Cloud API** (see `backend/src/whatsapp/cloudApiProvider.js`) — it's still very cheap in India (₹0.01–0.02 per message) and eliminates ban risk entirely. To switch a client, just update their `whatsapp_provider` field to `cloud_api` in the `clients` table and fill in their Meta credentials.

## Groq Rate Limits

Free Groq tier has rate limits. The system tracks daily AI reply usage per client (`usage_tracking` table) and caps it at `MAX_AI_REPLIES_PER_CLIENT_PER_DAY` (set in backend `.env`, default 300/day) — if hit, a safe fallback message is sent instead of failing silently, and the client gets a notification.

---

## Deploying to Render (once tested locally)

1. Push this project to a GitHub repo (three services: backend, admin-dashboard, client-dashboard)
2. On Render: create a **Web Service** for `backend` (Node), and **Static Sites** for both dashboards (Vite build)
3. Add all `.env` values as environment variables in Render's dashboard for each service
4. Update `VITE_API_URL` in both dashboards to point to your deployed backend URL
5. Update `FRONTEND_ADMIN_URL` / `FRONTEND_CLIENT_URL` in backend to your deployed dashboard URLs (for CORS)

**Note on Baileys sessions:** Render's free tier has an ephemeral filesystem — session files in `backend/sessions/` may be wiped on redeploy, forcing clients to re-scan the QR code. For a more permanent solution later, store session data in Supabase instead of local disk, or upgrade to a Render persistent disk.

---

## What To Test Before Selling

- [ ] Add a test client from admin dashboard, get access code
- [ ] Sign up as that client, complete onboarding
- [ ] Connect WhatsApp (use a spare/test number first, NOT your main number)
- [ ] Add 2-3 test properties
- [ ] Message the connected number from another phone, confirm AI replies correctly and only uses real property data
- [ ] Test Quick Send, Bulk Send (to your own numbers first)
- [ ] Test Emergency Block window
- [ ] Test human takeover toggle in Leads inbox
