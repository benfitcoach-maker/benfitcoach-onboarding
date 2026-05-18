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
import { timingSafeEqual } from 'node:crypto';

const EXPIRY_DAYS = 30;

/**
 * V97.24.6 (audit HIGH fix) — Comparaison timing-safe pour eviter
 * timing-attack sur CRON_SECRET. Si longueurs differentes, retourne
 * direct false (timing-safe parce que comparaison de longueur est
 * forcement non secrete : un attaquant peut deja deviner la longueur
 * par d'autres moyens, c'est le contenu qui doit etre constant-time).
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // 1. Auth Vercel cron (timing-safe)
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return res.status(500).json({ error: 'CRON_SECRET not configured server-side' });
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!safeCompare(token, expected)) {
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
  // V97.24.6 (audit HIGH-5 fix) — Cap batch a 1000 pour eviter timeout
  // Vercel + explosion memoire si 50k+ drafts. select count seulement.
  const cutoff = new Date(Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const BATCH_LIMIT = 1000;
  try {
    // D'abord on identifie les ids candidats avec limit (Supabase n'accepte
    // pas limit sur update directement — on fait select puis update IN).
    const { data: candidates, error: selectErr } = await supabase
      .from('plan_drafts_pending_review')
      .select('id')
      .eq('status', 'pending')
      .lt('generated_at', cutoff)
      .limit(BATCH_LIMIT);
    if (selectErr) {
      return res.status(500).json({ error: 'select failed', details: selectErr.message });
    }
    if (!candidates || candidates.length === 0) {
      return res.status(200).json({
        ok: true, expired_count: 0, cutoff, checked_at: new Date().toISOString(),
      });
    }
    const ids = candidates.map((c) => c.id);
    const { error: updateErr } = await supabase
      .from('plan_drafts_pending_review')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .in('id', ids);
    if (updateErr) {
      return res.status(500).json({ error: 'update failed', details: updateErr.message });
    }
    return res.status(200).json({
      ok: true,
      expired_count: ids.length,
      cutoff,
      checked_at: new Date().toISOString(),
      truncated: ids.length === BATCH_LIMIT, // si true, relancer le cron
    });
  } catch (e) {
    return res.status(500).json({ error: 'exception', details: e?.message || String(e) });
  }
}
