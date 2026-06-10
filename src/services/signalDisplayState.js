// ─── signalDisplayState.js ──────────────────────────────────────────────
// P2.1 (remède sécurité clinique, 2026-06-10) — source de vérité UNIQUE de
// l'état d'affichage d'un signal cliente (ressentis, pesées, tendances).
//
// Type C bien soigné : le code SAIT si la synchro a échoué (syncError) mais ne
// le DISAIT pas — les composants recevaient un tableau vidé, indistinguable
// d'un vrai vide, et affirmaient « cliente vient de démarrer » sur une panne
// réseau. On propage l'état réel jusqu'au point d'affichage au lieu de combler
// le silence par une supposition rassurante.
//
// Le silence n'est un mensonge QUE sous panne : 'empty' (synchro OK, rien reçu)
// est une vérité ; 'sync_error' (fetch échoué) est l'aveu honnête « je ne sais
// pas ». Les deux ne doivent JAMAIS rendre le même texte.
//
// syncError est de la vérité technique binaire (le fetch a réussi ou non), pas
// un jugement clinique — rien à faire valider par Anissa ici.

/**
 * @param {{ loading?: boolean, syncError?: boolean, count?: number }} [args]
 * @returns {'loading'|'sync_error'|'empty'|'data'}
 */
export function signalDisplayState(args = {}) {
  const { loading, syncError, count } = args || {};
  // Précédence : un chargement en cours prime (on ne sait pas encore) ; puis la
  // panne (on sait qu'on ne sait pas) ; puis le vide réel ; puis la donnée.
  if (loading) return 'loading';
  if (syncError) return 'sync_error';
  if (typeof count !== 'number' || count <= 0) return 'empty';
  return 'data';
}
