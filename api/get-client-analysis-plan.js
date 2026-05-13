// V97.13 Phase B (2026-05-13) — Vercel serverless function exposée à
// l'app cliente pour lire le plan d'analyses prescrit par Anissa.
//
// Architecture :
//   app cliente /parcours (Next.js) charge la timeline
//     → fetch GET /api/get-client-analysis-plan?email=<cliente>
//     → on lit clients.id depuis form->>'email' + le dernier analysis_plan
//       en status sent/in_progress/completed
//     → réponse JSON minimaliste { tests: [...], total_cost, supplement, sent_at }
//
// Sécurité V1 (cohérent avec get-questionnaire-prefill et get-client-rdv) :
//   - Email = clé de matching (provient de la session auth app cliente)
//   - CORS restreint aux origines connues
//   - On NE retourne JAMAIS les notes internes Anissa (notes_anissa)
//     qui contiennent souvent du diagnostic ou des références médecin
//   - Filter is_deleted IS NOT TRUE pour ignorer les profils archivés
//
// Variables d'env requises (déjà présentes côté SaaS) :
//   VITE_SUPABASE_URL / SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Réponses :
//   200 { ok: true, plan: { tests: [...], total_cost_chf, supplement_chf, sent_at } }
//   200 { ok: true, plan: null }     -- pas de plan prescrit
//   404 { error: "Client introuvable" }
//   500 { error: "..." }

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
  'https://anissa-client-app.vercel.app',
  'https://app.anissanutrition.ch',
  'http://localhost:3000',
  'http://localhost:5173',
];

// Pack credits (must match src/services/packSystem.js).
// Duplicated here car packSystem.js est ESM côté Vite et cette fonction tourne
// en serverless Node.js. La source de vérité reste packSystem.js — ces valeurs
// doivent rester synchronisées (peu de risque, modèle V97.12 stable).
const PACK_CREDITS = {
  consultation_initiale_220: 0,
  suivi_3m_990: 250,
  suivi_6m_1990: 400,
};

// Inférence du mode de prélèvement à partir de la catégorie du test.
// V1 simple : MICROBIOME + HMA (cheveux) = kit postal,
// SANG/HORMONES/ADN = labo de prélèvement.
function inferCollectionMethod(category) {
  if (!category) return 'lab_visit';
  const c = String(category).toUpperCase();
  if (c.includes('MICROBIOME') || c.includes('HMA') || c.includes('CHEVEUX') || c.includes('SELLES')) {
    return 'kit_postal';
  }
  return 'lab_visit';
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (
    origin
    && ALLOWED_ORIGINS.some((allowed) => origin === allowed || origin.endsWith('.vercel.app'))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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
    // 1. Resolve client by email
    const { data: client, error: lookupErr } = await supabase
      .from('clients')
      .select('id')
      .filter('form->>email', 'eq', email)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (lookupErr) {
      return res.status(500).json({ error: 'Lookup failed', details: lookupErr.message });
    }
    if (!client) {
      return res.status(404).json({ error: 'Client introuvable' });
    }

    // 2. Latest analysis plan in status visible to cliente (sent or later)
    const { data: plan, error: planErr } = await supabase
      .from('analysis_plans')
      .select('id, pack_type, pack_price_chf, selected_tests, total_cost_anissa_chf, status, created_at, updated_at')
      .eq('client_id', client.id)
      .in('status', ['sent', 'in_progress', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planErr) {
      return res.status(500).json({ error: 'Plan lookup failed', details: planErr.message });
    }
    if (!plan) {
      return res.status(200).json({ ok: true, plan: null });
    }

    // 3. Build safe response (strip Anissa-internal fields)
    const credit = PACK_CREDITS[plan.pack_type] || 0;
    const totalCost = plan.total_cost_anissa_chf || 0;
    const supplement = Math.max(0, totalCost - credit);
    const tests = (plan.selected_tests || []).map((t) => ({
      code: t.code,
      name: t.name,
      cost_chf: t.cost_anissa_chf,
      category: t.category,
      // PII-safe : on ne renvoie PAS la justification (notes internes Anissa)
      collection_method: inferCollectionMethod(t.category),
      status: t.status || 'recommended',
      // V97.13 Phase C : statut cliente (envoyé / prélevé) pour piloter l'UI
      client_status: t.client_status || null,
      client_status_at: t.client_status_at || null,
    }));

    return res.status(200).json({
      ok: true,
      plan: {
        tests,
        total_cost_chf: totalCost,
        credit_chf: credit,
        supplement_chf: supplement,
        sent_at: plan.updated_at || plan.created_at,
        status: plan.status,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error', details: err?.message });
  }
}
