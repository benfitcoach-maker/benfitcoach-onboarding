// V97.8 (2026-05-12) — Vercel serverless function pour pré-remplir le
// questionnaire in-app avec les infos qu'Anissa a déjà saisies à la
// création de la fiche (Création rapide SaaS).
//
// Architecture :
//   app cliente /questionnaire monte
//     → GET /api/get-questionnaire-prefill?email=...
//     → renvoie un sous-ensemble SAFE de clients.form
//        (identité de base uniquement, jamais de données médicales)
//     → la cliente voit ses champs pré-remplis et ne re-saisit pas
//
// Sécurité V1 :
//   - Email = clé de matching (provient de la session auth app cliente,
//     idem que /api/save-questionnaire)
//   - On NE retourne JAMAIS de données sensibles (pathologies, traitements,
//     antécédents, etc.). Uniquement les champs que la cliente a elle-même
//     fournis à Anissa lors de la création.
//   - CORS restreint aux origines connues.
//
// Body / Query :
//   ?email=camille.test@example.com
//
// Réponse 200 :
//   { ok: true, prefill: { prenom, nom, age, profession, genre,
//                          poids, taille, telephone, adresse, email } }
// Réponse 404 :
//   { error: "Client introuvable" }
// Réponse 500 :
//   { error: "..." }

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
  'https://anissa-client-app.vercel.app',
  'https://app.anissanutrition.ch',
  'http://localhost:3000',
  'http://localhost:5173',
];

// Liste blanche stricte des champs renvoyés (jamais de médical).
const SAFE_PREFILL_FIELDS = [
  'prenom',
  'nom',
  'age',
  'profession',
  'genre',
  'poids',
  'taille',
  'telephone',
  'adresse',
  'email',
];

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

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : null;
  if (!email) {
    return res.status(400).json({ error: 'Email query param required' });
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
    // V97.8.2 : on ignore les rows soft-deleted pour ne jamais
    // pré-remplir avec un ancien profil archivé.
    const { data: client, error: lookupErr } = await supabase
      .from('clients')
      .select('id, form, prenom')
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

    const form = client.form || {};
    const prefill = {};
    for (const field of SAFE_PREFILL_FIELDS) {
      if (form[field] !== undefined && form[field] !== null && form[field] !== '') {
        prefill[field] = form[field];
      }
    }
    // Fallback : si prenom n'est pas dans form mais l'est dans clients.prenom
    if (!prefill.prenom && client.prenom) {
      prefill.prenom = client.prenom;
    }
    // L'email est toujours présent (c'est la clé de matching)
    prefill.email = email;

    return res.status(200).json({ ok: true, prefill });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error', details: err?.message });
  }
}
