// ─── anamneseFoundation.js ──────────────────────────────────────────────
// Fondation anamnèse V1 (2026-06-13) — lecteurs structurels neutres.
//
// Couche PUREMENT structurelle (aucun texte clinique injecté ici) partagée par
// les deux chemins de génération (FR : _clinicalContext.fr.js, EN : en.js). Les
// PHRASES injectées dans le prompt restent locales à chaque langue.
//
// Contient :
//   - complementsActuels : ce que la cliente prend DÉJÀ (anti-doublon IA).
//     Décision Anissa : affichage + contexte IA, AUCUN calcul de dose en V1.
//   - ouvertureComplements : enum 3 niveaux (libellés validés Anissa).
//   - ramadanActif : état temporaire de jeûne, activé MANUELLEMENT par la
//     praticienne (cockpit-only, pas de calendrier). Décision Anissa 2026-06-13.

// ─── Ramadan (état temporaire, activation manuelle praticienne) ─────

/**
 * True si la praticienne a activé l'état Ramadan pour la cliente. Cockpit-only :
 * AUCUNE logique calendrier, c'est un toggle manuel. Tolère booléen et formes
 * texte usuelles du cockpit ('Oui', 'true', 'on', '1'). Pur, fail-safe.
 *
 * @param {object|null|undefined} form
 * @returns {boolean}
 */
export function isRamadanActive(form) {
  if (!form || typeof form !== 'object') return false;
  const v = form.ramadanActif;
  if (v === true) return true;
  return ['oui', 'true', 'on', '1'].includes(String(v ?? '').trim().toLowerCase());
}

// ─── Compléments actuels ────────────────────────────────────────────

/**
 * Met en forme la liste des compléments déjà pris : "Nom (dose), Nom2".
 * Lit form.complementsActuels = [{ nom, dose }]. Tolère aussi une string libre
 * (legacy form.supplements n'est PAS lu ici — fait au point d'injection).
 * Pur, fail-safe : retourne '' si rien d'exploitable. La `dose` reste un texte
 * libre, jamais parsée numériquement (décision no-dose Anissa).
 *
 * @param {object|null|undefined} form
 * @returns {string}
 */
export function formatComplementsActuels(form) {
  if (!form || typeof form !== 'object') return '';
  const raw = form.complementsActuels;
  if (!Array.isArray(raw)) {
    return typeof raw === 'string' ? raw.trim() : '';
  }
  const parts = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const nom = String(item.nom ?? '').trim();
    if (!nom) continue;
    const dose = String(item.dose ?? '').trim();
    parts.push(dose ? `${nom} (${dose})` : nom);
  }
  return parts.join(', ');
}

// ─── Ouverture aux compléments (enum 3 niveaux) ─────────────────────

/**
 * Enum d'ouverture. Code canonique (stocké dans form.ouvertureComplements) →
 * libellé EXACT validé Anissa. NE réutilise PAS pretProtocole (sémantique
 * distincte : pretProtocole = prêt à suivre un protocole ; ici = aisance vis-à-
 * vis des compléments).
 */
export const OUVERTURE_COMPLEMENTS = Object.freeze({
  eviter: 'Je préfère éviter les compléments',
  si_necessaire: 'Je suis ouverte si nécessaire',
  a_laise: 'Je suis à l\'aise avec les compléments',
});

/**
 * Résout le niveau d'ouverture. Tolère le code canonique OU le libellé complet
 * (selon ce que le cockpit / le pré-q stocke). Pur, fail-safe.
 *
 * @param {object|null|undefined} form
 * @returns {'eviter'|'si_necessaire'|'a_laise'|null}
 */
export function resolveOuvertureComplements(form) {
  if (!form || typeof form !== 'object') return null;
  const v = String(form.ouvertureComplements ?? '').trim();
  if (!v) return null;
  if (OUVERTURE_COMPLEMENTS[v]) return v;
  // Match par libellé (insensible à la casse).
  const lower = v.toLowerCase();
  for (const [code, label] of Object.entries(OUVERTURE_COMPLEMENTS)) {
    if (label.toLowerCase() === lower) return code;
  }
  return null;
}
