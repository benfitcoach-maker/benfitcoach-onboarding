// ─── clinicalOverrideAudit.js ───────────────────────────────────────────
// V97.28 — Lot 2 du chantier clairance clinique (clinicalClearance.js).
//
// Cf table : clinical_overrides_audit (migration V97.28).
//
// Trace un override clinique CONSCIENT : Anissa force une des 4 portes de
// sortie d'un plan (Adopter / export Word / Fiche frigo / publication app)
// alors que la clairance a signalé une violation bloquante (HIGH).
//
// ⚠️ NON BLOQUANT PAR CONSTRUCTION. Tout échec (réseau, RLS, auth, CHECK DB)
//    est avalé. La fonction ne throw jamais et ne retourne rien de
//    significatif. Un audit qui échoue ne doit JAMAIS empêcher Anissa de
//    sortir son plan. Conséquence assumée : une erreur de câblage (mauvais
//    libellé de porte → rejet CHECK) est silencieuse côté flux ; le seul
//    test qui la révèle est de vérifier qu'une LIGNE s'écrit réellement.

import { supabase, getCurrentUser } from '../supabaseClient';

// Source de vérité des libellés de porte — DOIT matcher le CHECK de la
// migration V97.28 : CHECK (door IN ('adopt','export_word','fiche_frigo','publish_app')).
// Les wirings importent cette constante plutôt que des littéraux libres,
// pour éliminer le risque de typo (= INSERT rejeté silencieusement).
export const CLINICAL_OVERRIDE_DOORS = Object.freeze({
  ADOPT: 'adopt',
  EXPORT_WORD: 'export_word',
  FICHE_FRIGO: 'fiche_frigo',
  PUBLISH_APP: 'publish_app',
});

const VALID_DOORS = new Set(Object.values(CLINICAL_OVERRIDE_DOORS));

/**
 * Journalise un override clinique conscient. Fire-and-forget : à appeler
 * juste après un window.confirm accepté sur un verdict non clairé, avant la
 * sortie effective. NE PAS await pour bloquer le flux (mais await-able).
 *
 * @param {object} verdict - verdict de clairance ({ violations, warnings })
 * @param {'adopt'|'export_word'|'fiche_frigo'|'publish_app'} door
 * @param {{ clientId?: string, consultationId?: string }} [ctx]
 * @returns {Promise<void>} - résout toujours, ne rejette jamais
 */
export async function traceClinicalOverride(verdict, door, ctx = {}) {
  try {
    // Garde-fou dev : surface une erreur de câblage de porte. Non bloquant —
    // on tente quand même l'INSERT (le CHECK DB la rejettera de toute façon),
    // mais ce warning rend visible un libellé erroné côté console.
    if (!VALID_DOORS.has(door)) {
      // eslint-disable-next-line no-console
      console.warn('[traceClinicalOverride] libellé de porte inconnu :', door);
    }

    const violations = Array.isArray(verdict?.violations) ? verdict.violations : [];
    const warnings = Array.isArray(verdict?.warnings) ? verdict.warnings : [];
    const violationTypes = violations.map((v) => v?.type).filter(Boolean);
    const severity = violations.some((v) => v?.severity === 'high')
      ? 'high'
      : (violations[0]?.severity || null);

    let overriddenBy = null;
    try {
      const user = await getCurrentUser();
      overriddenBy = user?.email || user?.id || null;
    } catch {
      /* auth indisponible : on trace quand même avec overridden_by null */
    }

    await supabase.from('clinical_overrides_audit').insert({
      client_id: ctx?.clientId ?? null,
      consultation_id: ctx?.consultationId ?? null,
      door,
      severity,
      violation_types: violationTypes,
      verdict: { violations, warnings },
      overridden_by: overriddenBy,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[traceClinicalOverride] échec audit non bloquant', e);
  }
}
