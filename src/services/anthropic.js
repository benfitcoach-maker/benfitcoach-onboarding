// V97.0 — Module unifie d'appel a Claude via le proxy /api/claude.
//
// Avant V97.0, chaque fichier ai* (aiClient, aiPlanOptimizer, aiMedicalSummary,
// aiRecipeGenerator, aiIntroLetter, prompt.js) + 5 inline dans NutritionConsultation.jsx
// dupliquait la meme fonction `aiRequest` (~25 lignes x 11 sites = ~275 lignes
// de duplication). Audit V96.34 = rouge dette.
//
// Ce module centralise :
// - lecture clef API depuis localStorage (header x-fallback-key, dev-only V96.35)
// - appel POST /api/claude
// - extraction safe du texte de reponse
// - parsing JSON tolerant si demande
// - choix model (default haiku-4-5, override possible)
//
// Usage type :
//   import { callClaude } from './anthropic';
//   const text = await callClaude({
//     system: '...',
//     user: '...',
//     model: 'claude-haiku-4-5-20251001', // optionnel, default
//     maxTokens: 1500,                     // optionnel, default 1500
//   });
//
//   // Parsing JSON automatique (extrait { } meme avec markdown autour)
//   const obj = await callClaude({ system, user, parseJson: true });
//
//   // Reponse brute (data.content[0].text sans trim ni post-process)
//   const raw = await callClaude({ system, user, raw: true });

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS = 1500;

export class ClaudeApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = 'ClaudeApiError';
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Extrait un objet JSON tolerant depuis du texte (gere markdown ```json,
 * texte autour, etc). Retourne null si parse impossible.
 */
export function safeParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  let clean = text.replace(/```json|```/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) clean = match[0];
  try {
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

/**
 * Appelle Claude via le proxy /api/claude.
 *
 * @param {object} opts
 * @param {string} opts.system    - system prompt
 * @param {string} opts.user      - user message
 * @param {string} [opts.model]   - default 'claude-haiku-4-5-20251001'
 * @param {number} [opts.maxTokens] - default 1500
 * @param {boolean} [opts.parseJson=false] - parse + return JSON object (null si fail)
 * @param {boolean} [opts.raw=false] - return data.content?.[0]?.text sans trim
 * @param {boolean} [opts.trim=true] - trim le texte retourne (defaut true)
 * @returns {Promise<string|object|null>}
 * @throws {ClaudeApiError} sur erreur HTTP/reseau
 */
export async function callClaude({
  system,
  user,
  model = DEFAULT_MODEL,
  maxTokens = DEFAULT_MAX_TOKENS,
  parseJson = false,
  raw = false,
  trim = true,
} = {}) {
  // V96.35 : header x-fallback-key utile uniquement en dev/preview (le proxy
  // l'ignore en prod). Permet a Anissa de tester localement sans config Vercel.
  const apiKey = (() => {
    try { return localStorage.getItem('bfc_api_key') || ''; } catch { return ''; }
  })();
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-fallback-key'] = apiKey;

  let response;
  try {
    response = await fetch('/api/claude', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
  } catch (err) {
    throw new ClaudeApiError(`Erreur reseau : ${err?.message || err}`, 0, null);
  }

  if (!response.ok) {
    let body = null;
    try { body = await response.json(); } catch { /* */ }
    const msg = body?.error?.message || body?.error || `Erreur API : ${response.status}`;
    throw new ClaudeApiError(msg, response.status, body);
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new ClaudeApiError(`Reponse non-JSON : ${err?.message || err}`, response.status, null);
  }

  let text = data?.content?.[0]?.text || '';
  if (trim) text = text.trim();

  if (parseJson) return safeParseJson(text);
  if (raw) return data;
  return text;
}
