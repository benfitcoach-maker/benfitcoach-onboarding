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

import { createClient } from '@supabase/supabase-js';

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

// ─── requireSaaSAdmin (V97.34) ────────────────────────────────────────────
// Emails autorises a declencher une action admin SaaS depuis le FRONTEND
// (Anissa + Benoit). Ce ne sont PAS des secrets : juste l'allowlist d'identite,
// alignee sur USER_EMAILS cote frontend (src/supabaseClient.js). Single-tenant
// V1 : on ne consulte pas profiles.role (evolution future si multi-praticiennes).
const SAAS_ADMIN_EMAILS = [
  'anissa.nutri@gmail.com',
  'benfitcoach.geneve@gmail.com',
];

/**
 * Resout l'utilisateur a partir d'un JWT de session Supabase en interrogeant
 * GoTrue. Le token passe en argument est ce qui est valide cote serveur ; la
 * cle service-role sert uniquement d'apikey de la requete.
 *
 * @param {string} token - access_token de session Supabase
 * @returns {Promise<object|null>} l'user valide, ou null si token invalide
 * @throws {Error} 'SUPABASE_NOT_CONFIGURED' si l'env serveur est absente
 */
async function defaultResolveUser(token) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * V97.34 — Guard pour les endpoints SaaS-local appeles par le FRONTEND SaaS
 * (Anissa), par opposition a requireAdminAuth qui protege les endpoints
 * appeles par l'APP CLIENTE via le secret partage cross-repo.
 *
 * Verifie l'identite reelle via le JWT de session Supabase d'Anissa :
 *  1. lit Authorization: Bearer <access_token>
 *  2. valide le token via GoTrue (supabase.auth.getUser)
 *  3. verifie que l'email valide appartient a l'allowlist admin SaaS
 *
 * Pourquoi pas requireAdminAuth ici : exposer CLIENT_APP_ADMIN_SECRET au
 * navigateur est interdit (V96.35). Le JWT de session appartient deja a Anissa
 * (court, expirable, revocable) -> aucun secret long-terme cote front.
 *
 * Async (contrairement a requireAdminAuth sync) : appel reseau GoTrue.
 * Le parametre deps.resolveUser permet d'injecter un validateur en test sans
 * mock reseau (meme pattern d'injection que maybeSendInvite cote app cliente).
 *
 * @param {object} req
 * @param {{ resolveUser?: (token: string) => Promise<object|null> }} [deps]
 * @returns {Promise<{ ok: true, user: object } | { ok: false, status: number, error: string }>}
 */
export async function requireSaaSAdmin(req, deps = {}) {
  const resolveUser = deps.resolveUser ?? defaultResolveUser;

  const authHeader = req.headers?.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  let user;
  try {
    user = await resolveUser(token);
  } catch (e) {
    if (e?.message === 'SUPABASE_NOT_CONFIGURED') {
      return { ok: false, status: 500, error: 'Supabase not configured server-side' };
    }
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  if (!user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const email = (user.email || '').toLowerCase();
  if (!SAAS_ADMIN_EMAILS.includes(email)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true, user };
}
