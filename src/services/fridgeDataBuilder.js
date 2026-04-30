// ─── fridgeDataBuilder ───────────────────────────────────────────────────
// V94.64 — Source UNIQUE de verite pour la construction des donnees Fiche
// Frigo. Utilise par les 3 consommateurs :
//   1. FicheFrigoPreview.jsx (modal preview SaaS Anissa)
//   2. exportToWord.js (export Word natif)
//   3. clientAppMapper.js (publication app cliente)
//
// Avant V94.64, chaque consommateur avait sa propre logique d'extraction
// (3 implementations dupliquees). Risque de divergence entre ce qu'Anissa
// voit dans la modal, ce qui sort en Word, et ce que la cliente voit dans
// son app. V94.64 elimine cette dette technique.
//
// Strategy d'extraction (par champ, ordre de preference) :
//   1. Sections markdown du nutrition_plan (extractFridgeDataFromSections)
//   2. Champ JSON structure consultation.fiche_frigo_json (legacy)
//   3. Regex extraction depuis le plan brut (extractMeals)
//
// Pour les aliments interdits : on utilise le parser unifie V94.63
// (foodRestrictionsParser) qui garantit cohesion entre form-based (modal,
// Word) et plan-section-based (app cliente, qui merge les 2).
// ─────────────────────────────────────────────────────────────────────────

import { extractFridgeDataFromSections, extractMeals, extractSupplements } from "../nutritionPdf";
import { buildForbiddenList } from "./foodRestrictionsParser";

/**
 * Parse le JSON legacy fiche_frigo_json en format canonique.
 * @param {object} json - consultation.fiche_frigo_json
 * @param {string} supplementsText - consultation.supplements (texte brut)
 */
function fromFicheJson(json, supplementsText) {
  if (!json || typeof json !== "object") return null;
  const repas = json.repas || {};
  const supp = json.supplements || {};
  const textSupp = extractSupplements(supplementsText || "");
  const pick = (arr, fallback) =>
    Array.isArray(arr) && arr.length > 0 ? arr : fallback;
  return {
    breakfast: Array.isArray(repas.petit_dejeuner) ? repas.petit_dejeuner : [],
    lunch: Array.isArray(repas.dejeuner) ? repas.dejeuner : [],
    dinner: Array.isArray(repas.diner) ? repas.diner : [],
    snack: typeof repas.collation === "string" ? repas.collation : "",
    toFavor: Array.isArray(json.a_privilegier) ? json.a_privilegier : [],
    toLimit: Array.isArray(json.a_limiter) ? json.a_limiter : [],
    hydration: typeof json.hydratation === "string" ? json.hydratation : "",
    supplements: {
      morningFasting: pick(supp.matin_a_jeun, textSupp.morningFasting),
      breakfast: pick(supp.petit_dejeuner, textSupp.breakfast),
      lunch: pick(supp.midi, textSupp.lunch),
      dinner: pick(supp.soir, textSupp.dinner),
      bedtime: pick(supp.coucher, textSupp.bedtime),
    },
  };
}

/**
 * Extract les regles "RECOMMANDATIONS COACH" (premiers 3 items actionnables).
 * Utilise dans le rendu de la modale et du Word pour donner a la cliente des
 * regles concretes en haut de la fiche frigo.
 */
function extractRules(sections) {
  const coachSection = (sections || []).find((sec) =>
    /recommandations?\s*coach/i.test(sec.title || ""),
  );
  if (!coachSection) return [];
  const lines = (coachSection.content || coachSection.body || "")
    .split("\n")
    .map((l) =>
      l
        .replace(/^[-–•*]\s*/, "")
        .replace(/^\*\*.*?\*\*\s*:?\s*/, "")
        .trim(),
    )
    .filter(
      (l) =>
        l.length > 10 &&
        l.length < 120 &&
        !/^(r[eè]gles?|erreurs?|focus|actions?)\s*[:—]/i.test(l) &&
        !/^(r[eè]gles?\s+(directes?|simples?|coach)|erreurs?\s+[aà]\s+[eé]viter)/i.test(
          l,
        ),
    );
  return lines.slice(0, 3);
}

/**
 * V94.64 — Builder canonique. Source de verite partagee.
 *
 * @param {object} client - Le client (.form, .prenom, etc.)
 * @param {object} consultation - La consultation courante (avec .fiche_frigo_json,
 *                                .nutritionPlan, .supplements, etc.)
 * @param {Array} sections - Sections markdown extraites du plan (typees)
 * @returns {object} Donnees canoniques Fiche Frigo
 *   {
 *     breakfast: string[], lunch: string[], dinner: string[],
 *     snack: string,
 *     toFavor: string[], toLimit: string[], forbidden: string[],
 *     hydration: string,
 *     supplements: { morningFasting[], breakfast[], lunch[], dinner[], bedtime[] },
 *     rules: string[]
 *   }
 */
export function buildCanonicalFridgeData(client, consultation, sections) {
  const ficheJson =
    consultation?.ficheFrigoJson || consultation?.fiche_frigo_json || null;
  const supplementsText =
    consultation?.supplements || "";

  const fromJson = fromFicheJson(ficheJson, supplementsText);
  const fromSections = extractFridgeDataFromSections(sections || []);
  const regexMeals = extractMeals(
    consultation?.nutritionPlan || consultation?.nutrition_plan || "",
  );
  const regexSupp = extractSupplements(supplementsText);
  const form = client?.form || {};

  const pickArr = (...sources) => {
    for (const s of sources) {
      if (Array.isArray(s) && s.length > 0) return s;
    }
    return [];
  };
  const pickStr = (...sources) => {
    for (const s of sources) {
      if (typeof s === "string" && s.trim()) return s;
    }
    return "";
  };

  const s = fromSections || {};
  const j = fromJson || {};
  const jSupp = j.supplements || {};

  return {
    breakfast: pickArr(s.breakfast, j.breakfast, regexMeals.breakfast),
    lunch: pickArr(s.lunch, j.lunch, regexMeals.lunch),
    dinner: pickArr(s.dinner, j.dinner, regexMeals.dinner),
    snack: pickStr(s.snack, j.snack, regexMeals.snack),
    toFavor: pickArr(s.toFavor, j.toFavor, regexMeals.toFavor),
    toLimit: pickArr(s.toLimit, j.toLimit, regexMeals.toLimit),
    // V94.63 : parser unifie pour les aliments interdits
    forbidden: buildForbiddenList(form),
    hydration: pickStr(
      s.hydration,
      j.hydration,
      regexMeals.hydration,
      form.hydratation,
    ),
    supplements: {
      morningFasting: pickArr(jSupp.morningFasting, regexSupp.morningFasting),
      breakfast: pickArr(jSupp.breakfast, regexSupp.breakfast),
      lunch: pickArr(jSupp.lunch, regexSupp.lunch),
      dinner: pickArr(jSupp.dinner, regexSupp.dinner),
      bedtime: pickArr(jSupp.bedtime, regexSupp.bedtime),
    },
    rules: extractRules(sections),
  };
}
