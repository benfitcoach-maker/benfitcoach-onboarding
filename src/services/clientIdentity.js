// ─── clientIdentity.js ──────────────────────────────────────────────────
// V97.40 (roadmap 1.2) — Source unique pour resoudre l'identite d'une cliente
// vis-a-vis de l'app cliente, et construire les champs d'identite a injecter
// dans les appels admin.
//
// clientId = staging_client_id : l'id de la ligne `clients` cote app cliente,
// connu du SaaS une fois l'app activee. C'est le matcher robuste : il survit
// aux emails masques (hide-my-email Apple/Google) ou l'email du compte peut
// differer de l'email saisi dans le SaaS.
//
// Contrat de deploiement (cf docs/CONTRAT-SAAS-APP-CLIENTE.md) :
//   - le SaaS envoie TOUJOURS email ET client_id quand les deux sont connus ;
//   - l'app cliente matche par client_id en priorite, fallback email ;
//   - tant que l'app cliente n'est pas mise a jour, elle ignore client_id et
//     matche par email — donc l'ordre des deux deploiements est indolore.

/**
 * @param {object} client - ligne `clients` du SaaS
 * @returns {{ email: string|null, clientId: string|null }}
 */
export function resolveClientIdentity(client) {
  const email = client?.form?.email || client?.email || null;
  const clientId = client?.stagingClientId || client?.staging_client_id || null;
  return { email, clientId };
}

/**
 * Champs d'identite a etaler dans un payload/query d'appel admin app cliente.
 * N'ajoute que les cles connues — jamais de cle a null/undefined.
 * @param {object} client
 * @returns {{ email?: string, client_id?: string }}
 */
export function clientIdentityFields(client) {
  const { email, clientId } = resolveClientIdentity(client);
  const out = {};
  if (email) out.email = email;
  if (clientId) out.client_id = clientId;
  return out;
}

/**
 * true si on a au moins un identifiant exploitable (email OU client_id).
 * @param {object} client
 */
export function hasClientIdentity(client) {
  const { email, clientId } = resolveClientIdentity(client);
  return !!(email || clientId);
}
