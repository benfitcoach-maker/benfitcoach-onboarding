// Vercel serverless function (Node.js runtime) proxying Anthropic Messages API.
// Keeps the real API key server-side. Supports a client-side fallback key via
// the `x-fallback-key` header when ANTHROPIC_API_KEY is not configured on Vercel.

export default async function handler(req, res) {
  // Basic CORS (same-origin in prod, but helps local dev too)
  res.setHeader('Access-Control-Allow-Origin', '*');
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

  const serverKey = process.env.ANTHROPIC_API_KEY;
  const fallbackKey = req.headers['x-fallback-key'];
  const apiKey = serverKey || (typeof fallbackKey === 'string' ? fallbackKey : '');

  if (!apiKey) {
    res.status(500).json({
      error: {
        message:
          "Clé API Anthropic manquante. Configure ANTHROPIC_API_KEY sur Vercel ou fournis x-fallback-key.",
      },
    });
    return;
  }

  try {
    // Vercel already parses JSON bodies for Node functions, but be defensive.
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
