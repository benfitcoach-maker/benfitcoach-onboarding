// ─── clientAppConfig.js ──────────────────────────────────────────────
// Lire/écrire la config par-cliente côté staging app cliente depuis le SaaS.
//
// Aujourd'hui : flags weight_tracking. Extensible pour d'autres options
// produit qu'Anissa peut activer par cliente (ex: visibilité plan, etc.).

const ENV_API_URL = "VITE_CLIENT_APP_API_URL";
const ENV_SECRET = "VITE_CLIENT_APP_ADMIN_SECRET";

function getEnv(key) {
  return import.meta.env?.[key];
}

function resolveClientEmail(client) {
  return client?.form?.email || client?.email || null;
}

export class ClientConfigError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ClientConfigError";
    this.status = status;
  }
}

/** GET la config actuelle de la cliente (côté staging). */
export async function fetchClientAppConfig(client) {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret) {
    throw new ClientConfigError("Config app cliente manquante (.env.local)", 0);
  }
  const email = resolveClientEmail(client);
  if (!email) throw new ClientConfigError("Cliente sans email", 0);

  let res;
  try {
    res = await fetch(
      `${apiUrl.replace(/\/+$/, "")}/api/admin/client-config?email=${encodeURIComponent(email)}`,
      { headers: { authorization: `Bearer ${secret}` } },
    );
  } catch (e) {
    throw new ClientConfigError(`Erreur réseau : ${e?.message || e}`, 0);
  }

  let body = null;
  try { body = await res.json(); } catch { /* */ }
  if (!res.ok || !body?.ok) {
    throw new ClientConfigError(body?.error || `HTTP ${res.status}`, res.status);
  }
  return {
    found: !!body.found,
    config: body.config || { weight_tracking_enabled: false, weight_visible_to_client: false },
  };
}

/** POST une mise à jour partielle de la config (1+ flags). */
export async function updateClientAppConfig(client, updates) {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret) {
    throw new ClientConfigError("Config app cliente manquante (.env.local)", 0);
  }
  const email = resolveClientEmail(client);
  if (!email) throw new ClientConfigError("Cliente sans email", 0);

  let res;
  try {
    res = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/admin/client-config`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ email, ...updates }),
    });
  } catch (e) {
    throw new ClientConfigError(`Erreur réseau : ${e?.message || e}`, 0);
  }

  let body = null;
  try { body = await res.json(); } catch { /* */ }
  if (!res.ok || !body?.ok) {
    throw new ClientConfigError(body?.error || `HTTP ${res.status}`, res.status);
  }
  return body.config;
}
