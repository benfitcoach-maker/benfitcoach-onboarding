// ─── publishedJourney ──────────────────────────────────────────────────
// V97.45 — Lot 2 « Parcours thérapeutique publié » (modale d'aperçu).
//
// Fonction PURE, LECTURE SEULE, PRÉSENTATION uniquement. Normalise le champ
// `journey_phases` du plan mappé (= EXACTEMENT le payload envoyé à
// /api/admin/publish-plan) en lignes affichables dans ClientAppPreviewModal.
//
// RÈGLE ABSOLUE : la modale n'affiche QUE plan.journey_phases. Jamais
// consultation.protocol_phases, ni pending_protocol_phases, ni journey_state.
// On ne recalcule pas la progression, on ne modifie aucun statut : on lit
// `status` tel quel et on le rend pour la cliente.

export const PHASE_STATUS_META = {
  active: { marker: "●", label: "En cours" },
  completed: { marker: "✓", label: "Terminée" },
  upcoming: { marker: "○", label: "À venir" },
};

// Transforme journey_phases en lignes prêtes à afficher.
//   journeyPhases : plan.journey_phases (objet { phases: [...] } ou null)
// Retourne [] si absent/vide → la modale affiche l'état « aucun parcours ».
export function mapPublishedJourney(journeyPhases) {
  const phases = journeyPhases?.phases;
  if (!Array.isArray(phases) || phases.length === 0) return [];

  return phases.map((p, i) => {
    const status =
      p.status === "active" || p.status === "completed" ? p.status : "upcoming";
    const meta = PHASE_STATUS_META[status];
    return {
      key: p.id || `phase-${i}`,
      order: p.order ?? i + 1,
      name: p.client_name || `Phase ${p.order ?? i + 1}`,
      status,
      marker: meta.marker,
      label: meta.label,
    };
  });
}
