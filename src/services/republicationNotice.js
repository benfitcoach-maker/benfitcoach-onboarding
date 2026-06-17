// ─── republicationNotice ────────────────────────────────────────────────
// V97.46 — Lot 3 A− « Conscience de ré-publication » (modale d'aperçu).
//
// Fonction PURE, LECTURE SEULE, FAIL-CLOSED. Répond honnêtement à « ce
// programme a-t-il déjà été publié ? » à partir des SEULES métadonnées que
// /api/admin/clients-status expose déjà (via fetchClientsStatus). Ne lit
// aucun contenu de plan, ne calcule aucun diff, ne mentionne aucun numéro
// de version (non disponible côté SaaS).
//
// Trois sorties :
//   - null                : aucune info fiable → la modale n'affiche rien.
//   - { variant:'published', dateISO } : déjà publié et visible maintenant.
//   - { variant:'scheduled', dateISO } : publication programmée (effective_at futur).

// Décrit l'état de ré-publication à partir d'une entrée clients-status.
//   statusEntry : { published_at, visible_now, effective_at, ... } | null
//   now         : Date de référence (injectable pour les tests)
export function describeRepublication(statusEntry, now = new Date()) {
  if (!statusEntry || typeof statusEntry !== "object") return null;

  const { published_at, visible_now, effective_at } = statusEntry;

  // Jamais publié → aucune information fiable, pas de bandeau (premier envoi).
  if (!published_at) return null;

  const nowMs = now.getTime();

  // Programmé : une date d'effet est dans le futur → la version prévue n'est
  // pas encore visible. Prime sur "published" car c'est l'info la plus utile.
  const effMs = effective_at ? Date.parse(effective_at) : NaN;
  if (!Number.isNaN(effMs) && effMs > nowMs) {
    return { variant: "scheduled", dateISO: effective_at };
  }

  // Déjà publié et visible maintenant.
  if (visible_now === true) {
    return { variant: "published", dateISO: published_at };
  }

  // published_at présent mais ni visible ni programmé dans le futur :
  // état ambigu → fail-closed, on n'affiche rien plutôt qu'une fausse certitude.
  return null;
}
