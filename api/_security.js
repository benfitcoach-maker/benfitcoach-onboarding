// ─── _security.js ───────────────────────────────────────────────────────
// V97.24.6 (audit critical fix) — Helpers partages pour CORS + Bearer auth
// des Vercel functions SaaS.
//
// Audit du sprint 18 mai a remonte :
//   - CRIT-3 : origin.endsWith('.vercel.app') autorise n'importe quel deploy
//     attaquant (evil-attacker.vercel.app)
//   - CRIT-1/2/6 : 6 endpoints exposent donnees sante sans auth Bearer
//
// Ce helper centralise les 2 patterns pour eviter la divergence future.
// Les fichiers commencant par _ ne sont PAS routes par Vercel.

const ALLOWED_ORIGINS_BASE = [
  'https://app.anissanutrition.ch',
  'https://anissa-client-app.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
];

// V97.24.6 — Regex strict pour les preview deploys de NOS 2 projets Vercel,
// pas n'importe quel .vercel.app. Format observe :
//   https://benfitcoach-onboarding-XXX-benfitcoachgeneve-4666s-projects.vercel.app
//   https://anissa-client-app-XXX-benfitcoachgeneve-XXX.vercel.app
const PREVIEW_HOST_REGEX = /^https:\/\/(benfitcoach-onboarding|anissa-client-app)[a-z0-9-]*\.vercel\.app$/;

/**
 * Indique si une origin est autorisee. Strict allowlist + regex preview
 * limitee aux 2 projets Vercel reels.
 *
 * @param {string|undefined} origin
 * @returns {boolean}
 */
export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS_BASE.includes(origin)) return true;
  return PREVIEW_HOST_REGEX.test(origin);
}

/**
 * Pose les headers CORS standards si l'origin est autorisee.
 * Inclut OPTIONS handling logique cote caller.
 *
 * @param {object} req - Vercel request
 * @param {object} res - Vercel response
 * @param {string} [methods='POST, OPTIONS'] - Methods CSV
 */
export function setCorsHeaders(req, res, methods = 'POST, OPTIONS') {
  const origin = req.headers?.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * V97.24.6 — Verification Bearer admin obligatoire pour les endpoints qui
 * exposent ou modifient des donnees sante/PII.
 *
 * Pattern : si retour est { ok: false, status, error }, le caller fait
 * `return res.status(status).json({ error })` et stoppe le handler.
 * Si { ok: true }, le caller continue.
 *
 * Pourquoi un objet et pas un throw : pour permettre au caller de logger
 * sans erreur stack inutile en prod.
 *
 * @param {object} req
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
/**
 * RGPD — n'expose les details techniques (messages d'erreur DB/exception) au
 * front qu'en developpement. En production, on renvoie un message generique
 * seul, jamais le detail technique (qui peut divulguer la structure interne).
 *
 * Usage : res.status(500).json({ error: 'X', ...devDetails(err.message) })
 *
 * @param {unknown} value - detail technique a exposer uniquement en dev
 * @returns {{ details: unknown } | {}}
 */
export function devDetails(value) {
  return process.env.NODE_ENV === 'production' ? {} : { details: value };
}

export function requireAdminAuth(req) {
  const expected = process.env.CLIENT_APP_ADMIN_SECRET;
  if (!expected) {
    return { ok: false, status: 500, error: 'CLIENT_APP_ADMIN_SECRET not configured server-side' };
  }
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token || token !== expected) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true };
}
