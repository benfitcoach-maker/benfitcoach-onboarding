// V97.34 — Génération du briefing IA pré-RDV (frontend SaaS → endpoint SaaS-local).
//
// SÉCURITÉ
//   Appel SAME-ORIGIN vers /api/generate-briefing, protégé côté serveur par
//   requireSaaSAdmin (cf. api/_security.js) : on envoie le JWT de session
//   Supabase d'Anissa en Authorization: Bearer. JAMAIS CLIENT_APP_ADMIN_SECRET
//   (interdit dans le bundle, V96.35), et JAMAIS via client-app-proxy (qui vise
//   l'app cliente, pas un endpoint SaaS-local).
//
//   Le JWT de session n'est pas un secret long-terme : il appartient à Anissa,
//   il est court, expirable et révocable. L'envoyer au serveur n'expose rien.

import { supabase } from '../supabaseClient';

export class BriefingError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'BriefingError';
    this.status = status;
  }
}

/**
 * Déclenche la génération (ou régénération) du briefing IA pour une cliente.
 * Le résultat est persisté côté serveur dans clients.form.ia_briefing ; on
 * retourne aussi le briefing pour info, mais l'UI relit via un refresh.
 *
 * @param {string} clientId
 * @returns {Promise<{ ok: boolean, briefing?: object, warning?: string }>}
 * @throws {BriefingError} session absente, réseau, ou erreur serveur (status)
 */
export async function generateBriefing(clientId) {
  if (!clientId) throw new BriefingError('clientId manquant');

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new BriefingError('Session expirée — reconnecte-toi pour générer le briefing.', 401);
  }

  let res;
  try {
    res = await fetch('/api/generate-briefing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ clientId }),
    });
  } catch {
    throw new BriefingError('Réseau indisponible — réessaie.', 0);
  }

  let data = null;
  try { data = await res.json(); } catch { /* corps non-JSON */ }

  if (!res.ok) {
    const msg = res.status === 401 ? 'Session invalide — reconnecte-toi.'
      : res.status === 403 ? 'Accès refusé (compte non admin).'
      : data?.error || `Erreur serveur (${res.status})`;
    throw new BriefingError(msg, res.status);
  }
  return data;
}
