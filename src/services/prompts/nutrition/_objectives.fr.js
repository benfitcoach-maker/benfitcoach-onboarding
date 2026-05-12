// V97.4 V3.H Gap #3 — Helper de rendu objectifs priorisés.
// Date : 2026-05-12
//
// Rôle : prendre le form Anissa et produire un bloc texte structuré
// injecté dans le system prompt IA pour focaliser le plan généré.
//
// Avant V3.H Gap #3 : objectifPrincipalNutrition (textarea libre) était
// dilué dans le contexte général. L'IA produisait souvent des plans
// "larges" couvrant tout sans hiérarchie.
//
// Après V3.H Gap #3 : 3 objectifs priorisés + niveau d'urgence
// explicites → l'IA structure le plan autour de la priorité 1.
//
// Tolère 100% : si aucun champ Gap #3 n'est rempli, retourne ''.

/**
 * Mapping urgency code → texte affiché.
 */
const URGENCY_LABELS = {
  urgent_moins_1m: 'urgent (résultats attendus < 1 mois)',
  moyen_3_6m: 'moyen terme (horizon 3–6 mois)',
  long_terme: 'long terme (transformation durable)',
};

/**
 * Construit un bloc texte priorisé pour le system prompt FR.
 * Retourne '' si aucun objectif Gap #3 n'est renseigné.
 *
 * @param {object | null | undefined} form
 * @returns {string} Bloc texte prêt à concaténer, ou '' si vide.
 */
export function formatPrioritizedObjectivesFr(form) {
  if (!form || typeof form !== 'object') return '';

  const o1 = safeText(form.objectif_primaire);
  const o2 = safeText(form.objectif_secondaire_1);
  const o3 = safeText(form.objectif_secondaire_2);
  const urgency = safeText(form.objectif_urgency);

  // Si aucun champ structuré → on ne génère rien (legacy plan suffisant).
  if (!o1 && !o2 && !o3 && !urgency) return '';

  const lines = ['OBJECTIFS PRIORISÉS DE LA CLIENTE :'];
  if (o1) lines.push(`- Priorité 1 (focus principal du plan) : ${o1}`);
  if (o2) lines.push(`- Priorité 2 (en support) : ${o2}`);
  if (o3) lines.push(`- Priorité 3 (en support) : ${o3}`);
  if (urgency && URGENCY_LABELS[urgency]) {
    lines.push(`- Niveau d'urgence : ${URGENCY_LABELS[urgency]}`);
  }

  // Directive structurante pour l'IA — wording prudent.
  lines.push('');
  lines.push('Structure le plan autour de la priorité 1 en premier. Les');
  lines.push('priorités 2 et 3 viennent en support et ne doivent pas dominer');
  lines.push('la stratégie. Si une recommandation peut servir plusieurs');
  lines.push('priorités, mets-la en avant.');

  return lines.join('\n');
}

function safeText(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}
