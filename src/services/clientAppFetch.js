// V96.35 — Helper unifié pour appeler l'API admin de l'app cliente.
// Avant V96.35, chaque service (publishToClientApp, fetchClientFeedbacks, etc.)
// appelait directement `${VITE_CLIENT_APP_API_URL}/api/admin/foo` avec un
// `Authorization: Bearer ${VITE_CLIENT_APP_ADMIN_SECRET}` — ce secret était
// donc inliné dans le bundle JS public (audit V96.34 = risque sécu critique).
//
// Depuis V96.35, le secret vit côté serveur uniquement (Vercel env
// `CLIENT_APP_ADMIN_SECRET`, sans prefix VITE_). Ce helper passe par le proxy
// `/api/client-app-proxy` (voir api/client-app-proxy.js) qui ajoute le Bearer
// header server-side.
//
// Usage type :
//   await clientAppFetch('/api/admin/publish-plan', { method: 'POST', payload: {...} });
//   await clientAppFetch('/api/admin/clients-status', { method: 'GET', query: { client_ids: '...' } });
//
// VITE_CLIENT_APP_API_URL est conservé côté client uniquement pour les checks
// de configuration UI (ex: désactiver le bouton "Publier" si pas configuré) —
// l'URL n'est pas sensible (visible en dev tools network), seul le secret l'était.

const ENV_API_URL = 'VITE_CLIENT_APP_API_URL';

function getEnv(key) {
  return import.meta.env?.[key];
}

export class ClientAppConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ClientAppConfigError';
  }
}

export class ClientAppHttpError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ClientAppHttpError';
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Vérifie la config UI minimale. Le secret n'est plus checkable côté client
 * (il vit server-side) — seule l'URL est encore vérifiée pour gating UI.
 * Le proxy retournera 500 'non configuré' si CLIENT_APP_ADMIN_SECRET manque.
 */
export function checkClientAppConfig() {
  const apiUrl = getEnv(ENV_API_URL);
  const issues = [];
  if (!apiUrl) issues.push(`Variable d'env manquante : ${ENV_API_URL}`);
  return { ok: issues.length === 0, issues };
}

/**
 * Appelle un endpoint admin de l'app cliente via le proxy server-side.
 *
 * @param {string} path - chemin commençant par /api/admin/...
 * @param {object} [opts]
 * @param {string} [opts.method='POST']
 * @param {object|null} [opts.payload=null] - body JSON
 * @param {object|null} [opts.query=null]   - query string params
 * @returns {Promise<any>} - body JSON parsé de la réponse upstream
 * @throws {ClientAppConfigError|ClientAppHttpError}
 */
export async function clientAppFetch(path, { method = 'POST', payload = null, query = null } = {}) {
  if (typeof path !== 'string' || !path.startsWith('/api/admin/')) {
    throw new ClientAppHttpError('path invalide (doit commencer par /api/admin/)', 0, null);
  }

  let res;
  try {
    res = await fetch('/api/client-app-proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, method, payload, query }),
    });
  } catch (err) {
    throw new ClientAppHttpError(`Erreur réseau : ${err?.message || err}`, 0, null);
  }

  let body = null;
  try { body = await res.json(); } catch { /* body non-JSON, body=null */ }

  if (!res.ok) {
    const msg = body?.error || body?.message || `HTTP ${res.status}`;
    if (res.status === 500 && /non configur/i.test(msg)) {
      throw new ClientAppConfigError(msg);
    }
    throw new ClientAppHttpError(msg, res.status, body);
  }
  return body;
}
