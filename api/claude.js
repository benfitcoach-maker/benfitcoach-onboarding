// Vercel serverless function (Node.js runtime) proxying Anthropic Messages API.
// Keeps the real API key server-side.
//
// V96.35 hardening (audit V96.34) :
// - CORS restreint à app.anissanutrition.ch + previews Vercel + localhost dev
//   (avant : wildcard `*` qui permettait à n'importe quel site d'utiliser le proxy)
// - Header `x-fallback-key` interdit en production (avant : permettait à n'importe
//   qui d'utiliser le proxy comme relay Anthropic gratuit avec sa propre clé).
//   Reste accepté en dev/preview pour qu'Anissa puisse tester localement.

const ALLOWED_ORIGINS = [
  'https://app.anissanutrition.ch',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173', // vite preview
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/benfitcoach-onboarding[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

// V97.25 (audit HIGH fix) — Rate limit in-memory anti-runaway.
// Pas un vrai daily budget (necessiterait Supabase) mais bloque le
// scenario worst-case d'un bug de boucle qui consomme la facture
// Anthropic en quelques minutes. 30 calls / 5 min par instance Vercel.
//
// Limites assumees :
//   - Reset au cold start (Vercel scale-up = nouveau compteur).
//   - Pas de cross-instance (concurrence limitee chez Anissa = OK).
//   - Pas de differentiation client/admin (single-tenant).
//
// Pour un vrai budget multi-tenant, migrer en V97.26 vers une table
// Supabase llm_daily_quota.
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT = 30;
const _rateLog = []; // [timestamp_ms, ...]

function checkRateLimit() {
  const now = Date.now();
  // Purge entries hors fenetre
  while (_rateLog.length > 0 && _rateLog[0] < now - RATE_WINDOW_MS) {
    _rateLog.shift();
  }
  if (_rateLog.length >= RATE_LIMIT) {
    return { allowed: false, retryAfterSec: Math.ceil((_rateLog[0] + RATE_WINDOW_MS - now) / 1000) };
  }
  _rateLog.push(now);
  return { allowed: true };
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-fallback-key');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  // V97.25 — Rate limit anti-runaway (avant verif API key pour eviter
  // qu'un attaquant force le check API key 1000 fois).
  const rate = checkRateLimit();
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSec));
    res.status(429).json({
      error: {
        message: `Rate limit Claude atteint (${RATE_LIMIT} calls / ${RATE_WINDOW_MS / 60000} min). Retry dans ${rate.retryAfterSec}s.`,
      },
    });
    return;
  }

  const isProd = process.env.VERCEL_ENV === 'production';
  const serverKey = process.env.ANTHROPIC_API_KEY;
  const fallbackKey = req.headers['x-fallback-key'];
  // V96.35 : on n'accepte plus la fallback key en prod — sécu (anti-relay).
  const allowFallback = !isProd;
  const apiKey = serverKey || (allowFallback && typeof fallbackKey === 'string' ? fallbackKey : '');

  if (!apiKey) {
    res.status(500).json({
      error: {
        message: isProd
          ? "Clé API Anthropic manquante. Configure ANTHROPIC_API_KEY sur Vercel."
          : "Clé API Anthropic manquante. Configure ANTHROPIC_API_KEY sur Vercel ou fournis x-fallback-key (dev/preview only).",
      },
    });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: { message: 'Corps de requête invalide' } });
      return;
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    res.status(500).json({
      error: { message: err?.message || 'Erreur proxy Claude' },
    });
  }
}
