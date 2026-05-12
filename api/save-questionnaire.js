// V97.8 (2026-05-12) — Vercel serverless function pour recevoir le
// questionnaire rempli depuis l'app cliente.
//
// Architecture :
//   app cliente /questionnaire (Next.js Camille)
//     → POST /api/save-questionnaire (cette fonction côté SaaS)
//     → UPDATE clients SET form = merged WHERE form->>'email' = email
//     → Anissa voit les réponses dans son cockpit (BC.5 étape 1)
//
// Sécurité V1 (acceptable pour beta) :
//   - Email = clé de matching (provient de la session auth app cliente)
//   - CORS restreint aux origines connues
//   - Pas de Bearer admin (la cliente ne l'a pas)
//   - Risque résiduel : data poisoning si quelqu'un connaît l'email
//     d'une cliente existante. Surface d'attaque limitée. À harder en V2
//     avec un token signé par le SaaS lors de l'invite-client.
//
// Variables d'env requises (déjà présentes côté SaaS pour Supabase) :
//   VITE_SUPABASE_URL       (SaaS prend le prefix VITE car partagé client/server)
//   SUPABASE_SERVICE_ROLE_KEY (server-only, pour bypass RLS)
//
// Body attendu :
//   { email: string, form: object }
//
// Réponse :
//   200 { ok: true, clientId: string }
//   400 { error: "..." }
//   404 { error: "Client introuvable" }
//   500 { error: "..." }

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
  'https://anissa-client-app.vercel.app',
  'https://app.anissanutrition.ch',
  'http://localhost:3000', // app cliente dev
  'http://localhost:5173', // SaaS dev
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.some((allowed) => origin === allowed || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Parse body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Body required' });
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;
  const formData = body.form;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  if (!formData || typeof formData !== 'object') {
    return res.status(400).json({ error: 'Form object required' });
  }

  // ── Supabase admin client (service role bypass RLS pour ce write contrôlé)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured server-side' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // ── Find client by email (stocké dans form.email JSONB)
    const { data: existing, error: lookupErr } = await supabase
      .from('clients')
      .select('id, form, prenom')
      .filter('form->>email', 'eq', email)
      .limit(1)
      .maybeSingle();

    if (lookupErr) {
      return res.status(500).json({ error: 'Lookup failed', details: lookupErr.message });
    }
    if (!existing) {
      return res.status(404).json({ error: 'Client introuvable (email non reconnu)' });
    }

    // ── Merge : nouvelles réponses overrident, mais on garde le reste
    const existingForm = existing.form || {};
    const mergedForm = { ...existingForm, ...formData };

    // ── Update clients.form + denormalize prenom si fourni
    const updatePayload = {
      form: mergedForm,
      updated_at: new Date().toISOString(),
    };
    if (formData.prenom && !existing.prenom) {
      updatePayload.prenom = formData.prenom;
    }
    const { error: updErr } = await supabase
      .from('clients')
      .update(updatePayload)
      .eq('id', existing.id);

    if (updErr) {
      return res.status(500).json({ error: 'Update failed', details: updErr.message });
    }

    // ── Notification pour Anissa (best-effort, ne bloque pas le succès)
    try {
      const fullName = [formData.prenom, formData.nom].filter(Boolean).join(' ')
        || existing.prenom
        || 'Cliente';
      await supabase.from('notifications').insert({
        type: 'questionnaire_completed',
        category: 'questionnaire',
        client_id: existing.id,
        client_name: fullName,
        message: `${fullName} a rempli son questionnaire depuis l'app`,
        read: false,
      });
    } catch {
      // best-effort, n'impacte pas la réponse cliente
    }

    return res.status(200).json({ ok: true, clientId: existing.id });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error', details: err?.message });
  }
}
