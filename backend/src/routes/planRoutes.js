// ============================================================
// PLANS + PAYMENTS ROUTES (admin only)
// ============================================================

import express from 'express';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth, requireAdmin);

// ---------- PLANS ----------
router.get('/plans', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('plans').select('*').order('price', { ascending: true });
    if (error) throw error;
    res.json({ plans: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/plans', async (req, res) => {
  try {
    const { name, price, duration_months, description } = req.body;
    const { data, error } = await supabaseAdmin
      .from('plans')
      .insert({ name, price, duration_months: duration_months || 1, description })
      .select()
      .single();
    if (error) throw error;
    res.json({ plan: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/plans/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('plans').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ plan: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/plans/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('plans').update({ is_active: false }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- PAYMENTS ----------

// Record a payment for a client -> pushes their next_due_date forward
router.post('/clients/:id/record-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, months_covered, plan_id, notes } = req.body;

    const { data: client, error: clientErr } = await supabaseAdmin.from('clients').select('*').eq('id', id).single();
    if (clientErr) throw clientErr;

    const months = months_covered || client.billing_months || 1;

    // Base the new due date off the later of (today) or (existing next_due_date),
    // so paying early doesn't lose them days, and paying late doesn't backdate incorrectly.
    const today = new Date();
    const currentDue = client.next_due_date ? new Date(client.next_due_date) : today;
    const baseDate = currentDue > today ? currentDue : today;
    const newDueDate = new Date(baseDate);
    newDueDate.setMonth(newDueDate.getMonth() + months);

    const { data: payment, error: payErr } = await supabaseAdmin
      .from('payments')
      .insert({
        client_id: id,
        plan_id: plan_id || client.plan_id,
        amount,
        months_covered: months,
        notes,
      })
      .select()
      .single();
    if (payErr) throw payErr;

    const { data: updatedClient, error: updateErr } = await supabaseAdmin
      .from('clients')
      .update({
        next_due_date: newDueDate.toISOString().split('T')[0],
        payment_status: 'paid',
      })
      .eq('id', id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.profile.id,
      action: 'payment_recorded',
      target_client_id: id,
      details: { amount, months_covered: months },
    });

    res.json({ payment, client: updatedClient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/clients/:id/payments', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('client_id', req.params.id)
      .order('paid_on', { ascending: false });
    if (error) throw error;
    res.json({ payments: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- DASHBOARD STATS (for admin graphs) ----------
router.get('/dashboard-stats', async (req, res) => {
  try {
    const { data: clients } = await supabaseAdmin.from('clients').select('*');
    const { data: payments } = await supabaseAdmin.from('payments').select('*').order('paid_on', { ascending: true });

    const today = new Date().toISOString().split('T')[0];

    const clientsWithDueInfo = (clients || []).map((c) => {
      let daysUntilDue = null;
      let computedStatus = c.payment_status;
      if (c.next_due_date) {
        const diffMs = new Date(c.next_due_date) - new Date(today);
        daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        computedStatus = daysUntilDue < 0 ? 'overdue' : daysUntilDue <= 5 ? 'due' : 'paid';
      }
      return { ...c, daysUntilDue, computedStatus };
    });

    const totalPendingAmount = clientsWithDueInfo
      .filter((c) => c.computedStatus === 'overdue' && c.status === 'active')
      .reduce((sum, c) => sum + (c.monthly_price || 0), 0);

    const revenueByMonth = {};
    (payments || []).forEach((p) => {
      const monthKey = p.paid_on.slice(0, 7); // YYYY-MM
      revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + Number(p.amount);
    });
    const revenueChartData = Object.entries(revenueByMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, amount]) => ({ month, revenue: amount }));

    res.json({
      clients: clientsWithDueInfo,
      totalPendingAmount,
      revenueChartData,
      totalClients: clients?.length || 0,
      activeClients: clients?.filter((c) => c.status === 'active').length || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
