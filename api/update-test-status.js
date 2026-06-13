// V97.13 Phase C (2026-05-13) — Vercel serverless function pour qu'une
// cliente puisse marquer ses prélèvements comme effectués depuis l'app.
//
// Architecture :
//   app cliente UI bouton "Marquer comme envoyé/effectué"
//     → POST /api/client/test-status (Next.js, authentifié)
//     → SaaS POST /api/update-test-status (avec admin secret)
//     → Update analysis_plans.selected_tests[].client_status + timestamp
//
// Auth : Bearer CLIENT_APP_ADMIN_SECRET (côté SaaS, partagé avec l'app
// cliente). Le côté client app fait sa propre auth utilisateur d'abord.
//
// Body attendu :
//   { email: string, test_code: string, status: 'sent_by_client' | 'sample_taken' }
//
// Réponses :
//   200 { ok: true, plan_id, test_code, status, status_at }
//   400 { error: "..." }
//   401 { error: "Unauthorized" }
//   404 { error: "Plan introuvable" / "Test introuvable" }
//   500 { error: "..." }

import { createClient } from '@supabase/supabase-js';
// V97.24.6 — CORS + auth via helper partage (cf api/_security.js).
import { setCorsHeaders, requireAdminAuth, devDetails } from './_security.js';

const VALID_STATUSES = new Set(['recommended', 'sent_by_client', 'sample_taken', 'received_by_anissa']);

export default async function handler(req, res) {
  setCorsHeaders(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // V97.24.6 (audit critical fix CRIT-3 CORS regex) — Bearer admin obligatoire.
  const authCheck = requireAdminAuth(req);
  if (!authCheck.ok) return res.status(authCheck.status).json({ error: authCheck.error });

  // Parse body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
  const testCode = typeof body?.test_code === 'string' ? body.test_code.trim() : null;
  const status = typeof body?.status === 'string' ? body.status.trim() : null;
  if (!email) return res.status(400).json({ error: 'email required' });
  if (!testCode) return res.status(400).json({ error: 'test_code required' });
  if (!status || !VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: `status must be one of: ${Array.from(VALID_STATUSES).join(', ')}` });
  }

  // Supabase admin client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured server-side' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. Resolve client by email (SaaS Supabase)
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id')
      .filter('form->>email', 'eq', email)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (clientErr) {
      return res.status(500).json({ error: 'Client lookup failed', ...devDetails(clientErr.message) });
    }
    if (!client) {
      return res.status(404).json({ error: 'Client introuvable' });
    }

    // 2. Get latest analysis_plan visible to cliente (sent or later)
    const { data: plan, error: planErr } = await supabase
      .from('analysis_plans')
      .select('id, selected_tests')
      .eq('client_id', client.id)
      .in('status', ['sent', 'in_progress', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planErr) {
      return res.status(500).json({ error: 'Plan lookup failed', ...devDetails(planErr.message) });
    }
    if (!plan) {
      return res.status(404).json({ error: 'Plan introuvable (status sent/in_progress/completed)' });
    }

    // 3. Update the matching test in selected_tests array
    const tests = Array.isArray(plan.selected_tests) ? plan.selected_tests : [];
    const idx = tests.findIndex((t) => t?.code === testCode);
    if (idx === -1) {
      return res.status(404).json({ error: `Test ${testCode} introuvable dans le plan` });
    }

    const nowIso = new Date().toISOString();
    const updatedTests = tests.map((t, i) => {
      if (i !== idx) return t;
      return {
        ...t,
        client_status: status,
        client_status_at: nowIso,
      };
    });

    const { error: updErr } = await supabase
      .from('analysis_plans')
      .update({
        selected_tests: updatedTests,
        updated_at: nowIso,
      })
      .eq('id', plan.id);

    if (updErr) {
      return res.status(500).json({ error: 'Update failed', ...devDetails(updErr.message) });
    }

    return res.status(200).json({
      ok: true,
      plan_id: plan.id,
      test_code: testCode,
      status,
      status_at: nowIso,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error', ...devDetails(err?.message) });
  }
}
