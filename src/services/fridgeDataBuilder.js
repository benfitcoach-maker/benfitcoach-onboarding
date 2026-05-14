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
import { parseSupplementEntriesStructured } from "./nutritionParsers";

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
 * V97.13.11 — Extrait les supplements depuis la SECTION SUPPLEMENTS RECOMMANDES
 * du plan markdown (format "card" : NOM / Moment : X / Dose : Y / Pourquoi : Z).
 *
 * Bug detecte : la modal Fiche Frigo + le PDF affichaient des cases MES
 * COMPLEMENTS vides alors qu Anissa avait redige 6 supplements detailles dans
 * le plan. extractSupplements() classique attend un format tabulaire
 * "TABLEAU HORAIRE" ou liste a plat qui n existe pas dans le plan actuel.
 *
 * Approche : on parse la section avec parseSupplementEntriesStructured (qui
 * gere le format card) puis on classifie chaque entree par moment de prise
 * en analysant le texte "Moment :" + fallback sur le nom du supplement.
 *
 * @param {Array} sections - Sections markdown du plan
 * @returns {object|null} Slots {morningFasting, breakfast, lunch, dinner, bedtime}
 *                        ou null si pas de section supplements detectee.
 */
function extractSupplementsFromCardSection(sections) {
  if (!Array.isArray(sections) || sections.length === 0) return null;
  // Detecte la section "Supplements recommandes" / "Plan de supplementation"
  // par type (detectSectionType retourne 'supplements') ou par titre regex
  // pour les sections cousines moins canoniques.
  const suppSection = sections.find(
    (s) =>
      s.type === "supplements" ||
      /supplements?\s*recommand|supplementation|plan\s*de\s*supplement/i.test(s.title || ""),
  );
  if (!suppSection) return null;
  const content = String(suppSection.content || suppSection.body || "");
  if (!content.trim()) return null;

  const entries = parseSupplementEntriesStructured(content);
  if (!entries.length) return null;

  const result = {
    morningFasting: [],
    breakfast: [],
    lunch: [],
    dinner: [],
    bedtime: [],
  };

  // Classifie un texte "Moment :" en bucket(s). Supporte les moments multiples
  // (ex: "Matin a jeun + le soir avant coucher" → 2 buckets) en segmentant
  // d'abord sur les separateurs (et, +, ,, puis). Pour chaque segment, on
  // applique une cascade de tests ordonnes par specificite : "a jeun" >
  // "coucher" > "petit-dejeuner" > "midi/dejeuner" > "soir/diner" pour
  // eviter qu un "avant le petit-dejeuner" (qui reste un creneau a jeun) ne
  // bascule a tort dans le bucket breakfast.
  const detectBucketsFromMoment = (momentText) => {
    if (!momentText) return [];
    const buckets = new Set();
    const segments = momentText.split(/\b(?:et|puis|ainsi\s+que|ensuite)\b|[+,;]/i);
    for (const seg of segments) {
      const t = seg.toLowerCase().trim();
      if (!t) continue;
      // 1. A jeun (prime sur tout y compris "avant petit-dejeuner")
      if (/[àa]\s*jeun|jeun\s+du\s+matin|avant\s+(?:le\s+)?petit[- ]?d[eé]jeuner/i.test(t)) {
        buckets.add("morningFasting");
        continue;
      }
      // 2. Coucher / avant coucher
      if (/coucher|avant\s+(?:le\s+)?coucher|au\s+coucher/i.test(t)) {
        buckets.add("bedtime");
        continue;
      }
      // 3. Petit-dejeuner / matin standard
      if (/petit[- ]?d[eé]jeuner|au\s+matin|avec\s+le?s?\s+repas?\s+du\s+matin/i.test(t)) {
        buckets.add("breakfast");
        continue;
      }
      // 4. Midi / dejeuner (lookbehind pour exclure petit-dejeuner)
      if (/(?<!petit[- ]?)d[eé]jeuner|midi|au\s+repas\s+du\s+midi/i.test(t)) {
        buckets.add("lunch");
        continue;
      }
      // 5. Diner / soir (exclure soir au coucher deja capte plus haut)
      if (/d[iî]ner|en\s+soir[eé]e|le\s+soir|au\s+soir/i.test(t)) {
        buckets.add("dinner");
        continue;
      }
    }
    return Array.from(buckets);
  };

  // Fallback : detection par nom (map des supplements connus).
  // Re-utilise le mapping de nutritionPdf.js via SUPPLEMENT_MOMENT_MAP-like
  // simplifie ici pour eviter une dependance circulaire.
  const detectBucketFromName = (name) => {
    const n = (name || "").toLowerCase();
    if (/\b(fer|iron|probiotiques?|l[-\s]?glutamine|glutamine|nac)\b/.test(n)) return "morningFasting";
    if (/\b(vitamine\s*d3?|vitamine\s*k2|complexe\s*b|cholecalciferol|menaquinone)\b/.test(n)) return "breakfast";
    if (/\b(om[eé]ga[-\s]?3|epa|dha|curcuma|chrome|berb[eé]rine)\b/.test(n)) return "lunch";
    if (/\b(zinc|calcium)\b/.test(n)) return "dinner";
    if (/\b(magn[eé]sium|ashwagandha|m[eé]latonine|theanine|psyllium)\b/.test(n)) return "bedtime";
    return null;
  };

  for (const entry of entries) {
    const name = (entry.name || "").trim();
    if (!name) continue;
    const dose = (entry.fields?.dosage || "").trim();
    // Nettoie le dose : strip parenthese marque (ex "(Burgerstein)"), garde l essentiel.
    const cleanDose = dose.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
    // Affichage compact : "Nom Dose" (sans Burgerstein/Pure Encaps qui surchargent).
    const display = cleanDose ? `${name} ${cleanDose}` : name;

    // Determine les buckets : essai depuis le champ "Moment", fallback nom.
    let buckets = detectBucketsFromMoment(entry.fields?.moment || "");
    if (buckets.length === 0) {
      const fromName = detectBucketFromName(name);
      if (fromName) buckets = [fromName];
    }
    if (buckets.length === 0) continue;

    for (const bucket of buckets) {
      // Anti-doublons
      const lower = display.toLowerCase();
      if (!result[bucket].some((s) => s.toLowerCase() === lower)) {
        result[bucket].push(display);
      }
    }
  }

  const hasAny = Object.values(result).some((arr) => arr.length > 0);
  return hasAny ? result : null;
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
  // V97.13.11 : parse aussi la section "SUPPLEMENTS RECOMMANDES" du plan
  // markdown (format card) qui n est PAS recuperee par extractSupplements
  // (cette derniere attend un format tabulaire qui n existe pas dans le plan).
  // C est la nouvelle source primaire des slots MES COMPLEMENTS de la Fiche Frigo.
  const cardSupp = extractSupplementsFromCardSection(sections || []) || {};
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
    // V97.13.11 : ordre des sources pour supplements MES COMPLEMENTS :
    // 1. fiche_frigo_json legacy (jSupp) — surcharge manuelle Anissa
    // 2. cardSupp — section "SUPPLEMENTS RECOMMANDES" parsee en format card
    // 3. regexSupp — vieux format tabulaire (rarement present)
    supplements: {
      morningFasting: pickArr(jSupp.morningFasting, cardSupp.morningFasting, regexSupp.morningFasting),
      breakfast: pickArr(jSupp.breakfast, cardSupp.breakfast, regexSupp.breakfast),
      lunch: pickArr(jSupp.lunch, cardSupp.lunch, regexSupp.lunch),
      dinner: pickArr(jSupp.dinner, cardSupp.dinner, regexSupp.dinner),
      bedtime: pickArr(jSupp.bedtime, cardSupp.bedtime, regexSupp.bedtime),
    },
    rules: extractRules(sections),
  };
}
