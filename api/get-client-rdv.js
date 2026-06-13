// V97.10 (2026-05-13) — Vercel serverless function exposée à l'app cliente
// pour lire la date du RDV anamnèse fixée par Anissa.
//
// Architecture :
//   app cliente /parcours (Next.js) charge la timeline
//     → fetch GET /api/get-client-rdv?email=<cliente>
//     → on lit clients.journey_state.rdv_anamnesis_at depuis le SaaS Supabase
//     → réponse JSON minimaliste { rdv_at, rdv_note } (ou nulls)
//
// Sécurité V1 (cohérent avec get-questionnaire-prefill V97.8) :
//   - Email = clé de matching (provient de la session auth app cliente)
//   - CORS restreint aux origines connues
//   - On ne renvoie QUE la date et la note (rien de médical)
//   - Filter is_deleted IS NOT TRUE pour ignorer les profils archivés
//
// Variables d'env requises (déjà présentes côté SaaS) :
//   VITE_SUPABASE_URL / SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Réponses :
//   200 { ok: true, rdv_at: ISO string | null, rdv_note: string | null }
//   404 { error: "Client introuvable" }
//   500 { error: "..." }

import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, requireAdminAuth, devDetails } from './_security.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // V97.24.6 (audit critical fix CRIT-1) — Bearer admin obligatoire.
  // Avant ce patch, n'importe qui pouvait GET ?email=cliente@x → fuite RGPD.
  const auth = requireAdminAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : null;
  if (!email) return res.status(400).json({ error: 'Email query param required' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured server-side' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: client, error: lookupErr } = await supabase
      .from('clients')
      .select('id, journey_state')
      .filter('form->>email', 'eq', email)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (lookupErr) {
      return res.status(500).json({ error: 'Lookup failed', ...devDetails(lookupErr.message) });
    }
    if (!client) {
      return res.status(404).json({ error: 'Client introuvable' });
    }

    const journey = client.journey_state || {};
    return res.status(200).json({
      ok: true,
      rdv_at: journey.rdv_anamnesis_at || null,
      rdv_note: journey.rdv_anamnesis_note || null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error', ...devDetails(err?.message) });
  }
}
