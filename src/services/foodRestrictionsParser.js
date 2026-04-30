// ─── foodRestrictionsParser ──────────────────────────────────────────────
// V94.63 — Parser unifie pour extraire les aliments interdits/a eviter
// depuis form.allergies et form.alimentsEvites.
//
// Source unique de verite pour la modal Fiche Frigo (SaaS), l'export Word
// et le clientAppMapper (app cliente). Resout le bug "phrases longues
// affichees comme aliments" (ex. "pas d'allergie connue mais des soupcons
// pour la betterave deja prepare." → garde "betterave").
//
// Strategy :
// 1. Split sur ponctuation et conjonctions courantes
// 2. Drop les segments avec mots-cles de negation ("pas", "aucune", etc.)
// 3. Drop les segments trop longs (> 50 chars = phrase, pas aliment)
// 4. Extract un nom d'aliment si une phrase contient une mention claire
// 5. Normalize : trim, drop duplicates (case-insensitive), premiere maj
// ─────────────────────────────────────────────────────────────────────────

// Mots qui annulent un segment ("pas d'allergie connue" → ignore)
const NEGATION_RE = /\b(pas|aucun(?:e|s)?|rien|non|jamais|sans|inconnu(?:e|s)?)\b/i;

// Mots-charnieres qui indiquent une phrase, pas une liste d'aliments
const PHRASE_HINT_RE = /\b(mais|cependant|toutefois|sauf|car|parce|puisque|deja|prepare|pour|avec)\b/i;

// Aliments les plus courants en consultation nutrition (whitelist heuristique
// pour extraire un mot d'une phrase). Liste non-exhaustive, peut etre etendue.
const KNOWN_FOODS = [
  // legumes
  "betterave", "tomate", "courgette", "epinard", "carotte", "poivron", "concombre",
  "chou", "brocoli", "haricot", "radis", "salade", "endive", "celeri", "navet",
  "champignon", "aubergine", "asperge", "artichaut", "fenouil", "echalote",
  // fruits
  "fraise", "pomme", "poire", "peche", "banane", "kiwi", "ananas", "mangue",
  "orange", "citron", "raisin", "cerise", "abricot", "framboise", "myrtille",
  "avocat", "noix", "noisette", "amande", "cacahuete",
  // proteines
  "boeuf", "porc", "agneau", "poulet", "dinde", "canard", "saumon", "thon",
  "crevette", "moule", "huitre", "oeuf", "tofu", "lentille", "pois",
  // produits laitiers
  "lait", "yaourt", "fromage", "beurre", "creme",
  // cereales
  "ble", "riz", "avoine", "quinoa", "sarrasin", "seigle", "orge", "epeautre",
  "gluten", "pain", "pates",
  // autres
  "sucre", "miel", "chocolat", "cafe", "the", "alcool", "vin", "biere",
  "soja", "arachide", "fruits secs", "fruits a coque",
];

// Construit un regex global pour matcher un aliment connu (longueur >= 4 pour eviter "et")
const KNOWN_FOODS_RE = new RegExp(
  "\\b(" + KNOWN_FOODS.filter((f) => f.length >= 4).join("|") + ")\\b",
  "i",
);

/**
 * Extrait une liste d'aliments depuis une chaine libre.
 * @param {string} input
 * @returns {string[]} Liste d'aliments uniques, normalises.
 */
export function parseFoodRestrictions(input) {
  if (!input || typeof input !== "string") return [];

  // Split sur ponctuation forte + conjonctions courantes
  const segments = input
    .split(/[,;/\n.!?]+|\b(?:et|ou|ainsi que|puis)\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const out = [];
  const seen = new Set();

  for (const seg of segments) {
    let candidate = seg;

    // 1. Drop si negation explicite
    if (NEGATION_RE.test(candidate)) {
      // Mais on tente d'extraire un aliment connu si phrase longue
      const m = candidate.match(KNOWN_FOODS_RE);
      if (m) {
        candidate = m[1];
      } else {
        continue; // skip
      }
    }

    // 2. Drop si trop long (probable phrase descriptive)
    if (candidate.length > 50) {
      const m = candidate.match(KNOWN_FOODS_RE);
      if (m) {
        candidate = m[1];
      } else {
        continue;
      }
    }

    // 3. Drop si contient des mots-charniere de phrase ET est plus long que 25 chars
    if (candidate.length > 25 && PHRASE_HINT_RE.test(candidate)) {
      const m = candidate.match(KNOWN_FOODS_RE);
      if (m) {
        candidate = m[1];
      } else {
        continue;
      }
    }

    // 4. Drop si trop court (1-2 chars sont du bruit)
    if (candidate.length < 2) continue;

    // 5. Normalize (trim espaces, premiere majuscule, lower comparison key)
    candidate = candidate.replace(/\s+/g, " ").trim();
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Premiere lettre maj (pour affichage propre)
    const display = candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
    out.push(display);
  }

  return out;
}

/**
 * Combine allergies + alimentsEvites en une liste unique d'aliments a eviter.
 * @param {object} form - Le form de la cliente (form.allergies, form.alimentsEvites)
 * @returns {string[]} Liste d'aliments uniques, normalises.
 */
export function buildForbiddenList(form) {
  if (!form || typeof form !== "object") return [];
  const fromAllergies = parseFoodRestrictions(form.allergies || "");
  const fromAvoid = parseFoodRestrictions(form.alimentsEvites || "");
  const merged = [...fromAllergies, ...fromAvoid];
  // Dedup case-insensitive
  const seen = new Set();
  const out = [];
  for (const item of merged) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
