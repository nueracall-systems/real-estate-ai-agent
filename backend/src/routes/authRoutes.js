// ============================================================
// AUTH ROUTES
// ============================================================
// Handles the "access code -> first login -> set password" flow.
// ============================================================

import express from 'express';
import { supabaseAdmin } from '../config/supabaseClient.js';

const router = express.Router();

// STEP 1: Client enters access code to verify it's valid + unused
router.post('/verify-access-code', async (req, res) => {
  try {
    const { access_code } = req.body;
    if (!access_code) return res.status(400).json({ error: 'Access code required' });

    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .select('id, business_name, contact_name, email, access_code_used, status')
      .eq('access_code', access_code)
      .single();

    if (error || !client) return res.status(404).json({ error: 'Invalid access code' });
    if (client.access_code_used) return res.status(400).json({ error: 'This access code has already been used. Please log in normally.' });
    if (client.status !== 'active') return res.status(403).json({ error: 'This account is not active. Contact support.' });

    return res.json({
      valid: true,
      business_name: client.business_name,
      contact_name: client.contact_name,
      email: client.email,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STEP 2: Client sets up email + password (creates Supabase Auth user, links profile + client)
router.post('/complete-signup', async (req, res) => {
  try {
    const { access_code, email, password } = req.body;
    if (!access_code || !email || !password) {
      return res.status(400).json({ error: 'Access code, email and password are required' });
    }

    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('access_code', access_code)
      .single();

    if (clientErr || !client) return res.status(404).json({ error: 'Invalid access code' });
    if (client.access_code_used) return res.status(400).json({ error: 'Access code already used' });

    // Create the Supabase Auth user
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authErr) return res.status(400).json({ error: authErr.message });

    // Create profile row
    await supabaseAdmin.from('profiles').insert({
      id: authUser.user.id,
      role: 'client',
      full_name: client.contact_name,
      email,
    });

    // Link client record to this new profile + mark access code used
    await supabaseAdmin
      .from('clients')
      .update({ profile_id: authUser.user.id, access_code_used: true, email })
      .eq('id', client.id);

    // Create empty client_profile row for onboarding step
    await supabaseAdmin.from('client_profile').insert({ client_id: client.id });

    res.json({ success: true, message: 'Account created. Please log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
