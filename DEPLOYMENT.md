# Deployment Guide — WhatsApp AI Real Estate Agent (Render)

Everything deploys on **Render** — backend as a Web Service (Starter plan, $7/month, always-on), both dashboards as free Static Sites. One platform, one dashboard to manage.

Do this in order — each step needs info from the one before it.

---

## Step 0 — Push your code to GitHub

Render deploys from a GitHub repo.

1. Create a new **private** repo on GitHub (e.g. `real-estate-ai-agent`).
2. In your project folder (the one with `backend/`, `admin-dashboard/`, `client-dashboard/`):
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/real-estate-ai-agent.git
   git push -u origin main
   ```
3. **Before pushing**, make sure `.env` files (backend/.env, admin-dashboard/.env, client-dashboard/.env) are in `.gitignore` in every folder — never put real API keys on GitHub, even a private repo. Only `.env.example` (no real values) should be committed.

---

## Step 1 — Deploy the backend (Web Service)

1. Go to [render.com](https://render.com), sign up/log in.
2. **New** → **Web Service** → connect your GitHub repo.
3. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: **Starter** ($7/month — do NOT use Free, WhatsApp needs to stay connected 24/7 and Free spins down after inactivity)
4. Add Environment Variables (copy real values from your local `backend/.env`):

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | your Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service role key |
   | `SUPABASE_ANON_KEY` | your Supabase anon key |
   | `GROQ_API_KEY` | your Groq API key |
   | `GROQ_MODEL` | `llama-3.3-70b-versatile` |
   | `NODE_ENV` | `production` |
   | `DEFAULT_WHATSAPP_PROVIDER` | `baileys` |
   | `MIN_REPLY_DELAY_MS` | `3000` |
   | `MAX_REPLY_DELAY_MS` | `8000` |
   | `MIN_BULK_GAP_MS` | `5000` |
   | `MAX_BULK_GAP_MS` | `15000` |
   | `MAX_AI_REPLIES_PER_CLIENT_PER_DAY` | `300` |

   Leave `FRONTEND_ADMIN_URL` / `FRONTEND_CLIENT_URL` for Step 3. Don't set `PORT` — Render sets it automatically.

5. **Create Web Service**. Wait for the first deploy to finish. Render gives you a URL like `https://your-backend.onrender.com` — **copy this**.
6. Test it: open `https://your-backend.onrender.com/` in a browser — you should see `{"status":"ok",...}`. If not, check the **Logs** tab.

---

## Step 2 — Deploy both dashboards (Static Sites)

Repeat this twice — once for `admin-dashboard`, once for `client-dashboard`:

1. **New** → **Static Site** → same GitHub repo.
2. Settings:
   - **Root Directory**: `admin-dashboard` (or `client-dashboard` the second time)
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
3. Add Environment Variables:

   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
   | `VITE_API_URL` | `https://your-backend.onrender.com/api` (from Step 1, **with `/api` at the end**) |

4. **Create Static Site**. Render gives you a URL like `https://real-estate-admin.onrender.com`.
5. Repeat for the client dashboard → you'll get something like `https://real-estate-client.onrender.com`.

**Write both URLs down.**

---

## Step 3 — Connect the backend to the real frontend URLs

Go back to your backend Web Service → **Environment** → add:

| Variable | Value |
|---|---|
| `FRONTEND_ADMIN_URL` | your admin Static Site URL |
| `FRONTEND_CLIENT_URL` | your client Static Site URL |

Save — Render auto-redeploys the backend with the new values. This is what lets your live dashboards actually talk to your live backend (CORS).

---

## Step 4 — Run the database migrations

If you haven't already, Supabase → SQL Editor → run **in order**:
`supabase_schema.sql` → `schema_update_v2.sql` → `v3` → `v4` → `v5` → `v6` → `v7` → `v8`.
(Safe to re-run any you've already done — they all use `if not exists`.)

---

## Step 5 — Create your admin account

Same as local: Supabase → Authentication → add a user manually (your email/password) → in the `profiles` table, add a row for that user with `role = 'admin'`.

---

## Step 6 — First real test

1. Open your admin URL, log in.
2. Add yourself/a test client, generate an access code.
3. Open your client URL, use the access code, complete onboarding.
4. Connect WhatsApp (scan QR) — saves to Supabase now (schema v8), survives Render restarts.
5. Message yourself from another phone, confirm the AI replies.
6. Now open the client dashboard **on your actual phone** — it's a real public URL, no WiFi/firewall issues like local testing had.

---

## Notes

- **Do not use Render's Free tier for the backend** — it spins down after 15 minutes of inactivity, which kills the live WhatsApp connection repeatedly. Static Sites (the two dashboards) ARE fine on Free since they're just files, no always-on process needed.
- **Custom domain** (optional, later): Render lets you attach your own domain for free on both Web Services and Static Sites once you're ready.
- If something breaks after deploying, check your Web Service's **Logs** tab first — same errors you'd see in your local terminal.
- Pricing/plans can change — double check current rates at [render.com/pricing](https://render.com/pricing) before committing.