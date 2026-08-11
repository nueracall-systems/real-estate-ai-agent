// ============================================================
// AUTH MIDDLEWARE
// ============================================================
// Verifies the Supabase JWT sent from frontend (Authorization: Bearer <token>)
// and attaches req.user + req.profile (role, client_id if applicable).
// ============================================================

import { supabaseAdmin } from '../config/supabaseClient.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    // EventSource (used for the WhatsApp QR stream) can't set custom headers,
    // so we also accept the token as a query param for that specific case.
    const token = authHeader.replace('Bearer ', '') || req.query.token || '';

    if (!token) return res.status(401).json({ error: 'No auth token provided' });

    const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !userData?.user) return res.status(401).json({ error: 'Invalid or expired token' });

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .single();

    if (!profile) return res.status(401).json({ error: 'Profile not found' });

    req.user = userData.user;
    req.profile = profile;

    if (profile.role === 'client') {
      const { data: clientRow } = await supabaseAdmin
        .from('clients')
        .select('id, status')
        .eq('profile_id', profile.id)
        .single();

      if (!clientRow) return res.status(403).json({ error: 'No client record linked to this account' });
      if (clientRow.status !== 'active') return res.status(403).json({ error: 'Account is suspended. Contact support.' });

      req.clientId = clientRow.id;
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: 'Auth check failed', details: err.message });
  }
}

export function requireAdmin(req, res, next) {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }
  next();
}

export function requireClient(req, res, next) {
  if (req.profile?.role !== 'client') {
    return res.status(403).json({ error: 'Client access only' });
  }
  next();
}
