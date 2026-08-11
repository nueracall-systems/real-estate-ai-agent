// ============================================================
// ADMIN ROUTES - only accessible by admin role
// ============================================================

import express from 'express';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth, requireAdmin);

function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars like 0/O, 1/I
  let code = 'RE-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// List all clients with basic stats
router.get('/clients', async (req, res) => {
  try {
    const { data: clients, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ clients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single client detail (with lead count, property count)
router.get('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: client, error } = await supabaseAdmin.from('clients').select('*').eq('id', id).single();
    if (error) throw error;

    const { count: leadCount } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', id);

    const { count: propertyCount } = await supabaseAdmin
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', id);

    res.json({ client, stats: { leadCount: leadCount || 0, propertyCount: propertyCount || 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new client -> generates access code
router.post('/clients', async (req, res) => {
  try {
    const { business_name, contact_name, phone, email, monthly_price, plan_id, billing_months } = req.body;
    if (!business_name || !contact_name || !phone) {
      return res.status(400).json({ error: 'business_name, contact_name and phone are required' });
    }

    let access_code = generateAccessCode();
    // Ensure uniqueness (rare collision safety)
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabaseAdmin.from('clients').select('id').eq('access_code', access_code).single();
      if (!existing) break;
      access_code = generateAccessCode();
      attempts++;
    }

    const months = billing_months || 1;
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + months);

    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .insert({
        business_name,
        contact_name,
        phone,
        email,
        access_code,
        monthly_price: monthly_price || 25000,
        plan_id: plan_id || null,
        billing_months: months,
        next_due_date: nextDueDate.toISOString().split('T')[0],
        payment_status: 'paid', // assume first payment taken at signup (offline agreement)
        status: 'active',
        plan_start_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw error;

    // Log the initial payment too, so it shows up in their payment history from day one
    await supabaseAdmin.from('payments').insert({
      client_id: client.id,
      plan_id: plan_id || null,
      amount: monthly_price || 25000,
      months_covered: months,
      notes: 'Initial signup payment',
    });

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.profile.id,
      action: 'client_added',
      target_client_id: client.id,
      details: { business_name, access_code },
    });

    res.json({ client, access_code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update client status (suspend/activate) or details
router.patch('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.profile.id,
      action: 'client_updated',
      target_client_id: id,
      details: updates,
    });

    res.json({ client });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove client entirely
router.delete('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('clients').delete().eq('id', id);
    if (error) throw error;

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.profile.id,
      action: 'client_removed',
      target_client_id: id,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Regenerate access code (e.g. if client lost it before first login)
router.post('/clients/:id/regenerate-code', async (req, res) => {
  try {
    const { id } = req.params;
    const access_code = generateAccessCode();

    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .update({ access_code, access_code_used: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ client, access_code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
