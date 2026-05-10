// ─────────────────────────────────────────────────────────────────
// Phase U — Endpoint generation token preview app cliente
// Date : 2026-05-10
//
// Vercel serverless function (Node.js runtime).
// Génère un token HMAC SHA256 signé permettant à Anissa de visualiser
// l'app d'une cliente précise via iframe (sans devoir login en tant que
// cliente).
//
// Variables d'env (server-side, sans prefix VITE_) :
//   CLIENT_APP_ADMIN_SECRET  — secret partagé avec l'app cliente Next.js
//
// Format requête (POST /api/preview-token) :
//   { clientId: "uuid", ttl?: 3600 }
//
// Réponse :
//   { token: "<clientId>.<exp>.<signature>", url: "..." }
//
// Sécurité :
// - CORS restreint à app.anissanutrition.ch + previews Vercel + localhost dev
// - Pas d'auth bearer pour cet endpoint pour MVP : Anissa est déjà loggée
//   au SaaS (la fenêtre s'ouvre depuis un contexte authentifié). Une vraie
//   review prod devrait ajouter un token admin SaaS.
// - Le token retourné expire en 1h (TTL court)
// - L'app cliente vérifie via verifyPreviewToken() avant de set le cookie

import { createHmac } from 'node:crypto';

const ALLOWED_ORIGINS = [
  'https://app.anissanutrition.ch',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/benfitcoach-onboarding[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

function b64urlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signPreviewToken(clientId, secret, ttlSeconds) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${clientId}.${exp}`;
  const sig = b64urlEncode(createHmac('sha256', secret).update(payload).digest());
  return { token: `${payload}.${sig}`, exp };
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

  // Lecture body
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const clientId = String(body.clientId || '').trim();
  const ttl = Math.min(3600, Math.max(60, Number(body.ttl) || 3600));

  if (!clientId || !/^[a-f0-9-]{8,}$/i.test(clientId)) {
    res.status(400).json({ error: 'clientId invalide ou manquant' });
    return;
  }

  const secret = process.env.CLIENT_APP_ADMIN_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'CLIENT_APP_ADMIN_SECRET non configuré côté serveur' });
    return;
  }

  const baseUrl = process.env.CLIENT_APP_API_URL || 'https://anissa-client-app.vercel.app';
  const { token, exp } = signPreviewToken(clientId, secret, ttl);
  const url = `${baseUrl.replace(/\/$/, '')}/preview/${encodeURIComponent(clientId)}?token=${encodeURIComponent(token)}`;

  res.status(200).json({
    token,
    url,
    exp,
    ttl,
  });
}
