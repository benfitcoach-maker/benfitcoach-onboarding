// ─── clientAppConfig.js ──────────────────────────────────────────────
// Lire/écrire la config par-cliente côté staging app cliente depuis le SaaS.
//
// Aujourd'hui : flags weight_tracking. Extensible pour d'autres options
// produit qu'Anissa peut activer par cliente (ex: visibilité plan, etc.).

// V96.35 : passe par le proxy server-side `/api/client-app-proxy`
import { clientAppFetch, ClientAppConfigError, ClientAppHttpError } from "./clientAppFetch";

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

function wrapErr(err) {
  if (err instanceof ClientAppConfigError) return new ClientConfigError(err.message, 0);
  if (err instanceof ClientAppHttpError) return new ClientConfigError(err.message, err.status);
  return err;
}

/** GET la config actuelle de la cliente (côté staging). */
export async function fetchClientAppConfig(client) {
  const email = resolveClientEmail(client);
  if (!email) throw new ClientConfigError("Cliente sans email", 0);

  let body;
  try {
    body = await clientAppFetch("/api/admin/client-config", { method: "GET", query: { email } });
  } catch (e) { throw wrapErr(e); }
  if (!body?.ok) throw new ClientConfigError(body?.error || "Reponse invalide", 0);
  return {
    found: !!body.found,
    config: body.config || { weight_tracking_enabled: false, weight_visible_to_client: false },
  };
}

/** POST une mise à jour partielle de la config (1+ flags). */
export async function updateClientAppConfig(client, updates) {
  const email = resolveClientEmail(client);
  if (!email) throw new ClientConfigError("Cliente sans email", 0);

  let body;
  try {
    body = await clientAppFetch("/api/admin/client-config", { method: "POST", payload: { email, ...updates } });
  } catch (e) { throw wrapErr(e); }
  if (!body?.ok) throw new ClientConfigError(body?.error || "Reponse invalide", 0);
  return body.config;
}
