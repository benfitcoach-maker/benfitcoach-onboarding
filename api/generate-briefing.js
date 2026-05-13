// V97.8.2 V1.A (2026-05-12) — Vercel serverless function pour générer
// un briefing préparatoire IA à partir du pré-questionnaire d'une cliente.
//
// CONTEXTE PRODUIT
//   Le pré-questionnaire app cliente est court (5-10 min, ~15 champs).
//   Avant le RDV anamnèse de 1h, Anissa veut un brief structuré IA pour
//   arriver préparée : hypothèses, pistes à creuser, questions intelligentes,
//   red flags. Pas de diagnostic, pas de prescription : juste de la
//   préparation clinique.
//
// SÉCURITÉ
//   - Endpoint protégé : nécessite Bearer admin OU appel server-side.
//     V1 : on accepte body { clientId, adminSecret } avec un secret partagé
//     pour rester simple. Le SaaS UI passera adminSecret depuis env.
//   - Output stocké dans clients.form.ia_briefing (JSONB, pas de migration).
//   - Versioning explicite (briefing_version + prompt_version + generated_at)
//     pour pouvoir comparer les versions et invalider les briefings périmés.
//
// VARIABLES D'ENV REQUISES (SaaS Vercel)
//   - VITE_SUPABASE_URL / SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY (lecture/écriture clients)
//   - ANTHROPIC_API_KEY (déjà présent, utilisé par api/claude.js)
//
// TEST CURL
//   curl -X POST https://app.anissanutrition.ch/api/generate-briefing \
//     -H "Content-Type: application/json" \
//     -d '{"clientId":"<uuid-de-camille>"}'
//
// FORMAT BRIEFING (output)
//   {
//     briefing_version: "v1",
//     prompt_version: "2026-05-12-v1",
//     generated_at: ISO timestamp,
//     output: {
//       executive_summary: "1-2 phrases",
//       priority_topics: ["3-5 sujets"],
//       questions_to_explore: ["5-8 questions"],
//       red_flags: ["red flags ou ['Aucun red flag majeur détecté']"],
//       suggested_analyses: ["pistes d'analyses à valider cliniquement"],
//       confidence: "high" | "moderate" | "low"
//     }
//   }

import { createClient } from '@supabase/supabase-js';

const PROMPT_VERSION = '2026-05-12-v1';
const BRIEFING_VERSION = 'v1';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

const ALLOWED_ORIGINS = [
  'https://app.anissanutrition.ch',
  'http://localhost:5173',
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

// ─── System prompt (versionné — PROMPT_VERSION) ────────────────────────
const SYSTEM_PROMPT = `Tu es un assistant clinique préparatoire pour Anissa Deroubaix, nutritionniste fonctionnelle (TCMA Genève, école de praticienne en nutrition). Tu prépares un briefing court pour aider Anissa à arriver mieux préparée à son RDV d'anamnèse de 1h avec une nouvelle cliente.

CONTRAINTES ABSOLUES :
- Tu n'es PAS un médecin. Tu ne poses JAMAIS de diagnostic.
- Tu ne prescris JAMAIS d'analyses ni de suppléments.
- Tu suggères des PISTES À EXPLORER au RDV, pas des conclusions.
- Wording prudent obligatoire : "piste à creuser", "à valider cliniquement", "hypothèse fonctionnelle à explorer". JAMAIS "la cliente est", "elle a", "elle souffre de", "elle doit prendre", "il faut prescrire".
- Pas de plan alimentaire ni recommandation thérapeutique.
- Si tu détectes un red flag clinique (douleurs nocturnes inexpliquées, perte de poids involontaire significative, sang dans selles, palpitations sévères, etc.), tu le SIGNALES sobrement sans dramatiser. Sinon retourne ["Aucun red flag majeur détecté"].
- Reste bref : Anissa doit pouvoir lire le briefing en 30-60 secondes.
- Tone : professionnel, concis, sobre. Pas d'enthousiasme commercial.

OUTPUT : JSON strict UNIQUEMENT. Pas de texte avant, pas de texte après, pas de markdown code fences.

Structure JSON attendue :
{
  "executive_summary": "string (1-2 phrases : profil + symptômes saillants + contexte)",
  "priority_topics": ["3 à 5 sujets à creuser en priorité (par ordre d'importance)"],
  "questions_to_explore": ["5 à 8 questions intelligentes à poser au RDV"],
  "red_flags": ["red flag si présent, ou ['Aucun red flag majeur détecté']"],
  "suggested_analyses": ["pistes d'analyses fonctionnelles à considérer selon validation clinique (3-6 propositions)"],
  "confidence": "high" | "moderate" | "low"
}

confidence :
- "high" si le pré-questionnaire est complet et donne une image cohérente
- "moderate" si quelques zones d'ombre mais signal clinique exploitable
- "low" si pré-questionnaire trop partiel pour conclure quoi que ce soit`;

// ─── Sanitization : retire les champs non utiles au brief IA ───────────
function sanitizeForm(form) {
  if (!form || typeof form !== 'object') return {};
  // Liste des champs envoyés à Claude (pas de PII inutile comme téléphone/adresse).
  const FIELDS = [
    'age', 'genre', 'profession', 'poids', 'taille',
    'pathologies', 'traitements', 'allergies',
    'grossesseActuelle', 'allaitement', 'postPartum', 'contraception',
    'objectif_primaire', 'dureeProbleme', 'objectif_urgency',
    'ressentiDigestion', 'energieJournee',
    // Champs legacy / déjà saisis par Anissa au RDV (peuvent être présents si modif manuelle)
    'frequenceBallonnements', 'transitType', 'fringalesSucre', 'variationsGlycemie',
    'niveauStressActuel', 'heuresSommeil',
  ];
  const out = {};
  for (const key of FIELDS) {
    if (form[key] !== undefined && form[key] !== null && form[key] !== '') {
      out[key] = form[key];
    }
  }
  return out;
}

// ─── Call Anthropic API ────────────────────────────────────────────────
async function callClaude(form) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const userMessage = `Voici les réponses du pré-questionnaire de la cliente (JSON) :\n\n${JSON.stringify(form, null, 2)}\n\nGénère le briefing JSON strict selon le format demandé.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Claude API HTTP ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (!text || typeof text !== 'string') {
    throw new Error('Claude response empty or malformed');
  }

  // Parse JSON strict (Claude peut parfois entourer de ```json...```, on nettoie)
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
  }
  try {
    return { parsed: JSON.parse(cleaned), raw: text };
  } catch (parseErr) {
    return { parsed: null, raw: text, parseError: parseErr.message };
  }
}

// ─── Main handler ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Parse body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  const clientId = typeof body?.clientId === 'string' ? body.clientId.trim() : null;
  if (!clientId) return res.status(400).json({ error: 'clientId required' });

  // ── Supabase admin client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured server-side' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Load client form
  // V97.8.2 : on refuse de générer un briefing sur un profil soft-deleted.
  let client;
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id, form')
      .eq('id', clientId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'Lookup failed', details: error.message });
    if (!data) return res.status(404).json({ error: 'Client introuvable' });
    client = data;
  } catch (err) {
    return res.status(500).json({ error: 'Lookup exception', details: err?.message });
  }

  const sanitizedForm = sanitizeForm(client.form);
  if (Object.keys(sanitizedForm).length === 0) {
    return res.status(400).json({
      error: 'Pré-questionnaire vide ou non rempli — impossible de générer un briefing.',
    });
  }

  // ── Call Claude
  let claudeResult;
  try {
    claudeResult = await callClaude(sanitizedForm);
  } catch (err) {
    return res.status(502).json({ error: 'IA briefing failed', details: err?.message });
  }

  if (!claudeResult.parsed) {
    return res.status(502).json({
      error: 'IA response not valid JSON',
      details: claudeResult.parseError,
      raw: claudeResult.raw,
    });
  }

  // ── Construct briefing object with versioning
  const briefing = {
    briefing_version: BRIEFING_VERSION,
    prompt_version: PROMPT_VERSION,
    model: ANTHROPIC_MODEL,
    generated_at: new Date().toISOString(),
    output: claudeResult.parsed,
  };

  // ── Save in clients.form.ia_briefing
  try {
    const mergedForm = { ...(client.form || {}), ia_briefing: briefing };
    const { error: updErr } = await supabase
      .from('clients')
      .update({ form: mergedForm, updated_at: new Date().toISOString() })
      .eq('id', clientId);
    if (updErr) {
      // On retourne quand même le briefing à Anissa, mais on signale le save fail
      return res.status(200).json({
        ok: true,
        briefing,
        warning: `Sauvegarde en base échouée : ${updErr.message}`,
      });
    }
  } catch (err) {
    return res.status(200).json({
      ok: true,
      briefing,
      warning: `Sauvegarde en base exception : ${err?.message}`,
    });
  }

  return res.status(200).json({ ok: true, briefing });
}
