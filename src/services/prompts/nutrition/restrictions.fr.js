// ─── restrictions.fr.js ─────────────────────────────────────────────────
// Fondation anamnèse V1 (2026-06-13) — restrictions alimentaires.
//
// Donnée CLINIQUE révisable par Anissa (pattern clinicalInteractions /
// MATERNAL_SAFETY). Cette map ne porte QUE la CLASSIFICATION (code → priorité +
// libellés). Les PHRASES injectées dans le prompt vivent par langue
// (_clinicalContext.fr.js pour le FR, en.js pour l'EN) — comme MATERNAL_SAFETY.
//
// Trois natures DISTINCTES (leçon Ramadan : ne pas fondre une nature différente
// dans un traitement unique) :
//   - 'religieux'  (Halal, Casher)            → exclusion d'aliments, haute priorité
//   - 'preference' (Végétarien, Végan, Autre) → exclusion best-effort
//   - 'timing'     (Ramadan)                  → contrainte de STRUCTURE des repas,
//                                               PAS une exclusion d'aliment
//
// Validations Anissa figées (12-13 juin 2026) :
//   religieux : Halal, Casher
//   preference : Végétarien, Végan, Autre préférence
//   timing : Ramadan
//
// Source unique structurelle : importée AUSSI par en.js (chemin anglophone) —
// même justification que resolveMaternalState (donnée structurelle, le texte FR
// reste local à _clinicalContext.fr.js ; en.js consomme labelEn + priorite).

export const RESTRICTION_PRIORITY = Object.freeze({
  RELIGIOUS: 'religieux',
  PREFERENCE: 'preference',
  TIMING: 'timing',
});

/**
 * Classification des restrictions alimentaires. Code (canonique, stocké dans
 * form.restrictionsAlimentaires) → { label FR, labelEn, priorite }.
 */
export const RESTRICTIONS_MAP = Object.freeze({
  halal: { label: 'Halal', labelEn: 'Halal', priorite: RESTRICTION_PRIORITY.RELIGIOUS },
  casher: { label: 'Casher', labelEn: 'Kosher', priorite: RESTRICTION_PRIORITY.RELIGIOUS },
  ramadan: { label: 'Ramadan', labelEn: 'Ramadan', priorite: RESTRICTION_PRIORITY.TIMING },
  vegetarien: { label: 'Végétarien', labelEn: 'Vegetarian', priorite: RESTRICTION_PRIORITY.PREFERENCE },
  vegan: { label: 'Végan', labelEn: 'Vegan', priorite: RESTRICTION_PRIORITY.PREFERENCE },
  autre: { label: 'Autre préférence', labelEn: 'Other preference', priorite: RESTRICTION_PRIORITY.PREFERENCE },
});

/** Normalise un code de restriction (tolère casse / accents / espaces). */
function normalizeCode(raw) {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Résout les restrictions déclarées d'une cliente, GROUPÉES par priorité.
 * Lit form.restrictionsAlimentaires (string[] de codes) + form.restrictionsAutre
 * (texte libre, classé en 'preference'). Pur, structurel, fail-safe.
 *
 * @param {object|null|undefined} form
 * @returns {{ religieux: object[], preference: object[], timing: object[], autreText: string }}
 *   chaque entrée = { code, label, labelEn, priorite }.
 */
export function resolveRestrictions(form) {
  const empty = { religieux: [], preference: [], timing: [], autreText: '' };
  if (!form || typeof form !== 'object') return empty;

  const raw = form.restrictionsAlimentaires;
  const codes = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,;]/)
      : [];

  const out = { religieux: [], preference: [], timing: [], autreText: '' };
  const seen = new Set();
  for (const c of codes) {
    const code = normalizeCode(c);
    if (!code || seen.has(code)) continue;
    const entry = RESTRICTIONS_MAP[code];
    if (!entry) continue;
    seen.add(code);
    out[entry.priorite].push({ code, ...entry });
  }

  const autre = String(form.restrictionsAutre ?? '').trim();
  if (autre) out.autreText = autre;

  return out;
}

/** True si la cliente a au moins une restriction (catégorie ou texte libre). */
export function hasRestrictions(resolved) {
  if (!resolved) return false;
  return (
    resolved.religieux.length > 0 ||
    resolved.preference.length > 0 ||
    resolved.timing.length > 0 ||
    Boolean(resolved.autreText)
  );
}
