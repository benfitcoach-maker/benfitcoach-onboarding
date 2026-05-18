// V97.23.3 — Vercel cron : marque expired les brouillons pending > 30j.
//
// Cf chantier : V97.18 hybride templates par phase (operational hygiene).
// Cf table : plan_drafts_pending_review (migration V97.23).
//
// Schedule : daily a 03:17 UTC (cf vercel.json). 17 min apres l'heure
// ronde pour ne pas exploser le quota Supabase au moment ou tout le
// monde lance leurs crons.
//
// Auth : CRON_SECRET (env Vercel) — Vercel cron jobs envoient automatiquement
// l'Authorization: Bearer <CRON_SECRET>.
//
// Variables d'env requises (server-side) :
//   CRON_SECRET                — partage avec Vercel pour auth cron
//   VITE_SUPABASE_URL          — url projet Supabase
//   SUPABASE_SERVICE_ROLE_KEY  — pour bypass RLS (UPDATE batch)

import { createClient } from '@supabase/supabase-js';

const EXPIRY_DAYS = 30;

export default async function handler(req, res) {
  // 1. Auth Vercel cron
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return res.status(500).json({ error: 'CRON_SECRET not configured server-side' });
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Supabase service_role pour bypass RLS sur UPDATE batch
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured server-side' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3. Update : pending + generated_at < NOW - 30 days → expired
  const cutoff = new Date(Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await supabase
      .from('plan_drafts_pending_review')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'pending')
      .lt('generated_at', cutoff)
      .select('id');
    if (error) {
      return res.status(500).json({ error: 'update failed', details: error.message });
    }
    const expiredCount = data?.length || 0;
    return res.status(200).json({
      ok: true,
      expired_count: expiredCount,
      cutoff,
      checked_at: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: 'exception', details: e?.message || String(e) });
  }
}
