// V97.13.22 Phase C (2026-05-14) — Vercel serverless function appelée par
// l'app cliente quand Camille clique "J'ai reçu mon protocole" depuis sa
// timeline /parcours.
//
// Architecture :
//   App cliente bouton "J'ai reçu mon protocole"
//     → POST /api/client/me/confirm-protocol-received (Next.js, authentifié)
//     → SaaS POST /api/confirm-protocol-received (avec admin secret)
//     → Update clients.journey_state.client_received_confirmed + timestamp
//     → syncClientAppStatus push clients.protocol_received_at côté cliente
//
// L'app cliente garde Anissa dans la boucle : elle voit le flag passer dans
// son cockpit étape 7 et peut alors cliquer "Activer l'espace".
//
// Auth : Bearer CLIENT_APP_ADMIN_SECRET (côté SaaS).
//
// Body attendu :
//   { email: string }  // ou { client_id: string }
//
// Réponses :
//   200 { ok: true, client_id, received_at }
//   400/401/404/500

import { createClient } from '@supabase/supabase-js';
// V97.24.6 — CORS + auth via helper partage (cf api/_security.js).
import { setCorsHeaders, requireAdminAuth } from './_security.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // V97.24.6 (audit critical fix CRIT-3 CORS regex) — Bearer admin obligatoire.
  const auth = requireAdminAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  // Parse body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
  const clientIdInput = typeof body?.client_id === 'string' ? body.client_id.trim() : null;
  if (!email && !clientIdInput) {
    return res.status(400).json({ error: 'email or client_id required' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured server-side' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. Resolve client
    let clientId = clientIdInput;
    if (!clientId) {
      const { data: client, error: clientErr } = await supabase
        .from('clients')
        .select('id')
        .filter('form->>email', 'eq', email)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      if (clientErr) {
        return res.status(500).json({ error: 'Client lookup failed', details: clientErr.message });
      }
      if (!client) return res.status(404).json({ error: 'Client introuvable' });
      clientId = client.id;
    }

    // 2. Lire l'état actuel + merge avec la nouvelle clé received
    const { data: current, error: loadErr } = await supabase
      .from('clients')
      .select('journey_state')
      .eq('id', clientId)
      .maybeSingle();
    if (loadErr) {
      return res.status(500).json({ error: 'Load journey_state failed', details: loadErr.message });
    }

    const nowIso = new Date().toISOString();
    const merged = {
      ...(current?.journey_state || {}),
      client_received_confirmed: true,
      protocol_received_at: nowIso,
    };

    const { error: updErr } = await supabase
      .from('clients')
      .update({ journey_state: merged })
      .eq('id', clientId);

    if (updErr) {
      return res.status(500).json({ error: 'Update journey_state failed', details: updErr.message });
    }

    return res.status(200).json({
      ok: true,
      client_id: clientId,
      received_at: nowIso,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error', details: err?.message });
  }
}
