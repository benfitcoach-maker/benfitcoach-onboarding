// V96.35 — Vercel serverless function (Node.js runtime).
// Proxy SaaS → app cliente (anissa-client-app) qui détient le Bearer token
// admin SERVER-SIDE uniquement. Avant V96.35, le token était exposé dans le
// bundle Vite via VITE_CLIENT_APP_ADMIN_SECRET — corrigé : il vit maintenant
// dans process.env (pas de prefix VITE_).
//
// Variables d'env (server-side, à configurer sur Vercel SANS prefix VITE_) :
//   CLIENT_APP_API_URL       — ex. https://anissa-client-app.vercel.app
//   CLIENT_APP_ADMIN_SECRET  — Bearer token (= ADMIN_INVITE_SECRET de l'app cliente)
//
// Format requête (POST /api/client-app-proxy) :
//   { path: "/api/admin/publish-plan", method: "POST", payload: {...}, query: {...} }
// Le proxy forward vers ${CLIENT_APP_API_URL}${path}?${query} avec auth Bearer.
//
// Sécurité :
// - CORS restreint à app.anissanutrition.ch + previews Vercel + localhost dev
// - Path doit commencer par /api/admin/ (pas de SSRF arbitraire)

const ALLOWED_ORIGINS = [
  'https://app.anissanutrition.ch',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173', // vite preview
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Vercel preview deploys : https://benfitcoach-onboarding-XXXX-benfitcoachgeneve-4666s-projects.vercel.app
  if (/^https:\/\/benfitcoach-onboarding[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiUrl = process.env.CLIENT_APP_API_URL;
  const secret = process.env.CLIENT_APP_ADMIN_SECRET;
  if (!apiUrl || !secret) {
    res.status(500).json({
      error: 'Client app proxy non configuré (CLIENT_APP_API_URL + CLIENT_APP_ADMIN_SECRET requis sur Vercel)',
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Corps de requête invalide' });
    return;
  }

  const { path, method = 'POST', payload = null, query = null } = body;
  // V97.24.6 (audit HIGH-2 fix) — strict path validation (anti SSRF / path traversal).
  // Avant : startsWith permettait /api/admin/../public-endpoint ou %2e%2e.
  // Apres : regex stricte sur segments alphanum + dash + slash.
  if (typeof path !== 'string' || !/^\/api\/admin\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i.test(path)) {
    res.status(400).json({ error: 'path invalide (format: /api/admin/<segment>[/<segment>])' });
    return;
  }
  const upstreamMethod = String(method).toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(upstreamMethod)) {
    res.status(400).json({ error: `Méthode non supportée : ${upstreamMethod}` });
    return;
  }

  let url = `${apiUrl.replace(/\/+$/, '')}${path}`;
  if (query && typeof query === 'object') {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        v.forEach(x => params.append(k, String(x)));
      } else {
        params.append(k, String(v));
      }
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  try {
    const fetchInit = {
      method: upstreamMethod,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
    };
    if (upstreamMethod !== 'GET' && upstreamMethod !== 'HEAD' && payload != null) {
      fetchInit.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    }
    const upstream = await fetch(url, fetchInit);
    const text = await upstream.text();
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.send(text);
  } catch (err) {
    res.status(502).json({
      error: `Erreur proxy app cliente : ${err?.message || err}`,
    });
  }
}
