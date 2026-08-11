// ============================================================
// CLIENT PROFILE ROUTES - business settings / AI persona / onboarding
// ============================================================

import express from 'express';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { requireAuth, requireClient } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth, requireClient);

// Get own client record + profile
router.get('/me', async (req, res) => {
  try {
    const { data: client } = await supabaseAdmin.from('clients').select('*').eq('id', req.clientId).single();
    const { data: profile } = await supabaseAdmin.from('client_profile').select('*').eq('client_id', req.clientId).single();
    res.json({ client, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update AI persona / business settings (onboarding + settings page use this)
router.patch('/profile', async (req, res) => {
  try {
    const updates = req.body;
    const { data, error } = await supabaseAdmin
      .from('client_profile')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('client_id', req.clientId)
      .select()
      .single();

    if (error) throw error;
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard home stats
router.get('/stats', async (req, res) => {
  try {
    const clientId = req.clientId;

    const { count: totalLeads } = await supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('client_id', clientId);
    const { count: hotLeads } = await supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'hot');
    const { count: totalProperties } = await supabaseAdmin.from('properties').select('*', { count: 'exact', head: true }).eq('client_id', clientId);
    const { count: upcomingAppointments } = await supabaseAdmin
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'booked')
      .gte('scheduled_time', new Date().toISOString());

    const today = new Date().toISOString().split('T')[0];
    const { data: usage } = await supabaseAdmin.from('usage_tracking').select('*').eq('client_id', clientId).eq('usage_date', today).single();

    res.json({
      totalLeads: totalLeads || 0,
      hotLeads: hotLeads || 0,
      totalProperties: totalProperties || 0,
      upcomingAppointments: upcomingAppointments || 0,
      todayAiReplies: usage?.ai_replies_count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chart data for dashboard graphs: leads created per day (last 14 days),
// lead status breakdown, and AI replies sent per day (last 14 days)
router.get('/charts', async (req, res) => {
  try {
    const clientId = req.clientId;
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const sinceDate = fourteenDaysAgo.toISOString();

    // Build the full list of the last 14 calendar dates (YYYY-MM-DD) so the
    // chart always has a continuous x-axis, even on days with zero activity.
    // Without this, a chart only plots days that happen to have data - if
    // all your test activity happened in one day, you'd get a single dot
    // (which recharts renders as a flat/straight line, not a real trend).
    const last14Dates = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last14Dates.push(d.toISOString().split('T')[0]);
    }

    const { data: leads } = await supabaseAdmin
      .from('leads')
      .select('created_at, status')
      .eq('client_id', clientId)
      .gte('created_at', sinceDate);

    const { data: usage } = await supabaseAdmin
      .from('usage_tracking')
      .select('usage_date, ai_replies_count, messages_sent_count')
      .eq('client_id', clientId)
      .gte('usage_date', fourteenDaysAgo.toISOString().split('T')[0])
      .order('usage_date', { ascending: true });

    // Leads per day - every day in the window is present, defaulting to 0
    const leadsPerDay = {};
    (leads || []).forEach((l) => {
      const day = l.created_at.split('T')[0];
      leadsPerDay[day] = (leadsPerDay[day] || 0) + 1;
    });
    const leadsChartData = last14Dates.map((date) => ({ date, leads: leadsPerDay[date] || 0 }));

    // Status breakdown (all-time, not just 14 days)
    const { data: allLeads } = await supabaseAdmin.from('leads').select('status').eq('client_id', clientId);
    const statusCounts = { hot: 0, warm: 0, cold: 0, new: 0, converted: 0, lost: 0 };
    (allLeads || []).forEach((l) => {
      if (statusCounts[l.status] !== undefined) statusCounts[l.status]++;
    });
    const statusChartData = Object.entries(statusCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({ status, count }));

    // Messages/AI activity per day - same fill-every-day treatment
    const usageByDate = {};
    (usage || []).forEach((u) => {
      usageByDate[u.usage_date] = u;
    });
    const activityChartData = last14Dates.map((date) => ({
      date,
      aiReplies: usageByDate[date]?.ai_replies_count || 0,
      messagesSent: usageByDate[date]?.messages_sent_count || 0,
    }));

    res.json({ leadsChartData, statusChartData, activityChartData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;