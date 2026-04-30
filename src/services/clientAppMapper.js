// ─── clientAppMapper.js ────────────────────────────────────────────────────
// Transforme un couple (client, consultation) du SaaS Anissa en JSON
// "ClientPlan" attendu par l'app cliente premium (anissa-client-preview).
//
// ⚠️  VERSION À BLANC — étape 1
// On lit UNIQUEMENT les colonnes existantes en DB. Les champs littéraires
// que le SaaS ne stocke pas encore (pull_quote, tailored_points,
// signature_phrase, intros de section, focus du jour, hints repas) sont
// laissés undefined. L'app cliente les supporte déjà optionnels et les
// ignore si absents (cf. anissa-client-preview/types/plan.ts).
//
// Une fois ce mapping validé sur 1 vraie consultation, on ajoutera les
// colonnes manquantes côté SaaS pour enrichir l'expérience cliente.
//
// Sortie : objet conforme à `ClientPlan` (types/plan.ts), à insérer dans
// la table `client_plans` du Supabase staging app cliente.

import {
  detectSectionType,
  parseLabeledLines,
  parseBulletLines,
  parseRotationGroups,
  parseSlotAlternatives,
  normalizeSlotLabelToSlot,
  parseSupplementEntriesStructured,
} from "../nutritionEditorParsers";
import { getNutritionPlanMode } from "./nutritionPlanMode";
import { mealKey } from "./extractMealsFromPlan";
// V94.63 : parser unifie aliments interdits (partage avec FicheFrigoPreview + Word)
import { buildForbiddenList } from "./foodRestrictionsParser";
// V94.64 : builder canonique partage (coherence E2E avec modal SaaS + Word)
import { buildCanonicalFridgeData } from "./fridgeDataBuilder";

// ─── Helpers généraux ─────────────────────────────────────────────────────

const DAY_LABELS_FR = [
  "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche",
];
const DAY_SHORT_FR = ["L", "M", "M", "J", "V", "S", "D"];

const DAY_LABELS_EN = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];
const DAY_SHORT_EN = ["M", "T", "W", "T", "F", "S", "S"];

/** Slugifier safe pour StableId (ASCII, kebab-case). */
function slugify(text) {
  return String(text || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "x";
}

/** Garantir l'unicité d'un id en suffixant -1, -2, ... */
function uniqueId(base, used) {
  let id = base;
  let n = 1;
  while (used.has(id)) {
    id = `${base}-${n++}`;
  }
  used.add(id);
  return id;
}

/** Split un texte en paragraphes non vides (par lignes vides). */
function splitParagraphs(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// ─── Découpage du nutrition_plan markdown en sections ─────────────────────
//
// Aligné sur structurePlanSections() de NutritionConsultation.jsx (ligne 1647)
// pour garantir le même découpage que le PDF. Détecte un titre quand :
//   - la ligne commence par #, ## ou ###
//   - OU la ligne est entièrement en MAJUSCULES (5-80 caractères)
// Le contenu avant le 1er titre est traité comme une section "Introduction"
// implicite (comportement miroir du SaaS).

function isUppercaseHeader(line) {
  const t = line.trim();
  if (!t || t.length < 5 || t.length >= 80) return false;
  // Considéré "majuscules" si le texte est strictement égal à sa version
  // upper-case (caractères accentués inclus).
  return t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t);
}

// Wrapper de classification : couvre le format Anissa standard (via
// detectSectionType) ET le format Benfitcoach sport (jours de semaine
// directs comme titres, sections stratégie multiples, "ALIMENTS À ÉVITER",
// etc.). Ne modifie pas detectSectionType d'origine — on étend localement.
const DAY_NAME_RE = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const DAY_NAME_TO_INDEX = {
  lundi: 1, monday: 1,
  mardi: 2, tuesday: 2,
  mercredi: 3, wednesday: 3,
  jeudi: 4, thursday: 4,
  vendredi: 5, friday: 5,
  samedi: 6, saturday: 6,
  dimanche: 7, sunday: 7,
};
const STRATEGY_LIKE_RE = /^(besoins\s*caloriques|r[eé]partition\s*macronutriments|macronutriments|points?\s*d.attention|approche\s*anti.inflammatoire|optimisation\s*microbiote|gestion\s*[eé]nerg[eé]tique|timing\s*nutritionnel|hydratation|signaux\s*d.alarme|ajustements?\s*performance|suivi\s*recommand|examens?\s*compl|anti.inflammatoires?|soutien\s*digestif|astuces|principes?\s*nutritionnels?)/i;
const FOOD_AVOID_RE = /^(aliments?\s*[aà]\s*[eé]viter|aliments?\s*[aà]\s*limiter|forbidden\s*foods|limited\s*foods)/i;
const SHOPPING_RE = /^(liste\s*de\s*courses|shopping\s*list)/i;

function classifyTitle(title) {
  const t = String(title || "").trim();
  if (DAY_NAME_RE.test(t)) return "meals_day";
  if (FOOD_AVOID_RE.test(t)) return "food_limit";
  if (SHOPPING_RE.test(t)) return "shopping";
  // Section stratégie-like (couvre les multi-sections du format sport)
  if (STRATEGY_LIKE_RE.test(t)) return "strategy_extra";
  return detectSectionType(t);
}

function dayIndexFromTitle(title) {
  const t = String(title || "").trim().toLowerCase();
  for (const [key, idx] of Object.entries(DAY_NAME_TO_INDEX)) {
    if (t.startsWith(key)) return idx;
  }
  return null;
}

function splitPlanSections(planText) {
  const text = String(planText || "");
  if (!text.trim()) return [];

  const lines = text.split("\n");
  const sections = [];
  let currentTitle = "";
  let currentContent = [];

  const flush = () => {
    const body = currentContent.join("\n").trim();
    if (body || currentTitle) {
      sections.push({
        title: currentTitle || "Introduction",
        body,
        type: classifyTitle(currentTitle || "Introduction"),
      });
    }
    currentContent = [];
  };

  for (const line of lines) {
    const md = line.match(/^#{1,3}\s+(.+)$/);
    if (md) {
      flush();
      currentTitle = md[1].trim();
      continue;
    }
    if (isUppercaseHeader(line)) {
      flush();
      currentTitle = line.trim();
      continue;
    }
    currentContent.push(line);
  }
  flush();

  return sections;
}

/** Trouver la première section d'un type donné. */
function findSection(sections, type) {
  return sections.find((s) => s.type === type) || null;
}

/** Trouver toutes les sections d'un type. */
function findAllSections(sections, type) {
  return sections.filter((s) => s.type === type);
}

// ─── Locale / mode ────────────────────────────────────────────────────────

function resolveLocale(client) {
  const lang = String(client?.langue || "FR").toUpperCase();
  return lang === "EN" ? "en" : "fr";
}

// V94.36 : le mode app cliente doit refleter le PACK du client (oneshot_180,
// suivi_6m...) et NON pas le type de la consultation actuelle (initiale vs
// follow-up). Une cliente en pack suivi 6 mois dont la 1ere consultation a
// is_followup=false etait incorrectement mappee en 'oneshot'. Fix: on delegue
// a getNutritionPlanMode(client) qui lit client.packType (deja fiable cote
// SaaS depuis V80).
function resolveMode(client) {
  return getNutritionPlanMode(client);
}

// ─── 1. intro_data ────────────────────────────────────────────────────────
//
// Greeting : "Bonjour <prenom>," (locale-aware).
// Body : on prend la section "intro" du plan si présente, sinon on
// concatène observations + nutritional_observations comme fallback.
// Tous les champs littéraires (eyebrow, greeting_tagline, pull_quote,
// tailored_points, signature_phrase) restent undefined en V1.

function buildIntroData(client, consultation, sections) {
  const locale = resolveLocale(client);
  const prenom = (client?.prenom || "").trim();

  const greeting = locale === "fr"
    ? (prenom ? `Bonjour ${prenom},` : "Bonjour,")
    : (prenom ? `Hello ${prenom},` : "Hello,");

  // V94.47 : SOURCE PRIORITAIRE — intro_letter genere par IA + validee
  // par Anissa via l'onglet "Lettre" de NutritionConsultation. Si present,
  // on l'utilise tel quel (pas de filtrage looksLikeRawProfileData : Anissa
  // a deja valide le contenu).
  const introLetter = consultation?.intro_letter;
  if (introLetter && Array.isArray(introLetter.body) && introLetter.body.length > 0) {
    return {
      greeting,
      body: introLetter.body
        .map((p) => String(p || "").trim())
        .filter(Boolean),
      pull_quote: typeof introLetter.pull_quote === "string" && introLetter.pull_quote.trim()
        ? introLetter.pull_quote.trim()
        : undefined,
      tailored_points: Array.isArray(introLetter.tailored_points)
        ? introLetter.tailored_points
            .map((p, i) => ({
              id: `tp-${i + 1}`,
              title: String(p?.title || "").trim(),
              detail: String(p?.detail || "").trim(),
            }))
            .filter((p) => p.title && p.detail)
        : undefined,
      signature: "Anissa",
      coach_name: "Anissa",
      coach_role: locale === "fr" ? "Votre nutritionniste" : "Your nutritionist",
    };
  }

  // FALLBACK legacy — sources d'intro existantes :
  //   1. Section "intro" du plan (vraie intro narrative écrite par Anissa)
  //   2. nutritional_observations (résumé Anissa, plus narratif)
  //   3. observations (souvent données brutes type profil cliente — fallback)
  const introSection = findSection(sections, "intro");
  const candidates = [
    introSection?.body,
    consultation?.nutritional_observations,
    consultation?.observations,
  ].filter(Boolean);

  // On prend la 1ère source qui ne ressemble PAS à des données brutes.
  let introBodySource = "";
  for (const c of candidates) {
    if (!looksLikeRawProfileData(c)) {
      introBodySource = c;
      break;
    }
  }

  // Nettoie + split en paragraphes + filtre ceux qui sont des données brutes.
  const body = splitParagraphs(cleanForApp(introBodySource))
    .filter((p) => !looksLikeRawProfileData(p));

  // Pas de fallback raw : si tous les paragraphes ressemblent à des données
  // sensibles (profil médical), on préfère une intro sobre (greeting +
  // signature seulement) plutôt que d'exposer des informations privées.

  return {
    greeting,
    body,
    signature: "Anissa",
    coach_name: "Anissa",
    coach_role: locale === "fr" ? "Votre nutritionniste" : "Your nutritionist",
    // eyebrow, greeting_tagline, pull_quote, tailored_points, coach_avatar_url
    // → undefined si pas de intro_letter (V94.47 priorise)
  };
}

// ─── 2. strategy_data ─────────────────────────────────────────────────────
//
// Source : section "strategy" du plan. Format attendu :
//   <paragraphes essentiels>
//   - bullet takeaway 1
//   - bullet takeaway 2
//   Pilier 1 : description
//   Pilier 2 : description
//
// Heuristique :
//   - paragraphes (lignes non bullet, non labeled) → essential[]
//   - bullets simples (- foo) → takeaways[]
//   - paires "Label : description" → pillars[]

function buildStrategyData(client, consultation, sections) {
  const locale = resolveLocale(client);

  // Sources : section "strategy" canonique + toutes les sections "soft"
  // détectées comme strategy_extra (BESOINS CALORIQUES, MACRONUTRIMENTS,
  // POINTS D'ATTENTION, APPROCHE ANTI-INFLAMMATOIRE, OPTIMISATION MICROBIOTE,
  // GESTION ÉNERGÉTIQUE, TIMING, HYDRATATION, etc.).
  const main = findSection(sections, "strategy");
  const extras = findAllSections(sections, "strategy_extra");

  const allBlocks = [main, ...extras].filter(Boolean);
  const fullText = allBlocks.map((s) => cleanForApp(s.body || "")).join("\n\n");

  // Bullets (takeaways) — concaténation de tous les bullets trouvés
  const takeaways = parseBulletLines(fullText)
    .map((t) => cleanForApp(t))
    .filter(Boolean)
    .slice(0, 6);

  // Pillars : on prend chaque section strategy_extra comme un pilier potentiel
  // (titre = nom de section, description = 1ère phrase ou bullet).
  const pillarSeen = new Set();
  let pillars = extras.slice(0, 3).map((sec) => {
    const cleanedBody = cleanForApp(sec.body || "");
    const firstBullet = parseBulletLines(cleanedBody)[0];
    const firstSentence = cleanedBody.split(/[.\n]/).map((s) => s.trim()).filter(Boolean)[0];
    const description = cleanForApp(firstBullet || firstSentence || "");
    return {
      id: uniqueId(slugify(sec.title), pillarSeen),
      title: sec.title,
      description,
    };
  }).filter((p) => p.description);

  // Fallback 1 : si pas de strategy_extra, on extrait les paires de la section
  // strategy canonique (format Anissa standard).
  if (pillars.length === 0 && main?.body) {
    const pairs = parseLabeledLines(cleanForApp(main.body));
    pillars = pairs
      .filter((p) => p.label && p.value && p.value.length > 5)
      .slice(0, 3)
      .map((p) => ({
        id: uniqueId(slugify(p.label), pillarSeen),
        title: p.label,
        description: cleanForApp(p.value),
      }));
  }

  // V94.70 : fallback 2 — l'IA peut produire des bullets sans format
  // "Label : valeur" exploitable par parseLabeledLines (regex strict). Plutot
  // que d'echouer en "Pas de piliers detectes" cote enrichissement, on
  // convertit chaque bullet en pilier en splittant sur le 1er separateur
  // raisonnable (": " > " — " > " - ") ou en utilisant la 1ere phrase courte
  // comme titre. C'est moins beau qu'un format strict mais ca evite les
  // crashs d'enrichissement quand le prompt n'a pas ete strictement suivi.
  if (pillars.length === 0 && main?.body) {
    const bullets = parseBulletLines(cleanForApp(main.body))
      .map((b) => cleanForApp(b))
      .filter((b) => b.length > 10);
    pillars = bullets.slice(0, 3).map((bullet) => {
      // Cherche un separateur naturel pour title/description.
      let title = bullet;
      let description = "";
      const sepMatch = bullet.match(/^(.{3,40}?)\s*[:—–-]\s+(.+)$/);
      if (sepMatch) {
        title = sepMatch[1].trim();
        description = sepMatch[2].trim();
      } else {
        // Pas de separateur : utilise les 4-6 premiers mots comme titre,
        // le reste comme description.
        const words = bullet.split(/\s+/);
        if (words.length > 6) {
          title = words.slice(0, 5).join(" ");
          description = words.slice(5).join(" ");
        } else {
          title = bullet;
          description = bullet; // titre = description si bullet court
        }
      }
      return {
        id: uniqueId(slugify(title), pillarSeen),
        title: title.slice(0, 80),
        description: description || title,
      };
    });
  }

  // Essential = paragraphes hors bullets/pairs (pris de la section main de
  // préférence, sinon des extras). Cleané + filtré.
  const essentialSource = main?.body
    ? cleanForApp(main.body)
    : extras.map((s) => cleanForApp(s.body || "")).join("\n\n");

  const essential = essentialSource
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => {
      if (!p) return false;
      // Skip si c'est juste un séparateur/markdown leftover
      if (/^[-_*\s]+$/.test(p)) return false;
      // Skip si paragraphe = données brutes type profil
      if (looksLikeRawProfileData(p)) return false;
      const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
      const isAllBulletOrPair = lines.every((l) =>
        /^([—\-•*·]|\d+[\.\)])\s+/.test(l) || /^[A-Za-zéèàùûîâôçêŒœ][^:]{2,60}?\s*:\s*.+$/.test(l)
      );
      return !isAllBulletOrPair;
    })
    .slice(0, 3);

  return {
    header_title: locale === "fr" ? "Votre stratégie" : "Your strategy",
    subtitle: locale === "fr"
      ? "Comprendre comment votre plan agit."
      : "Understand how your plan works.",
    essential,
    pillars,
    takeaways_title: locale === "fr"
      ? "Ce que vous devez retenir"
      : "What you should remember",
    takeaways,
  };
}

// ─── 3. week_meals ────────────────────────────────────────────────────────
//
// V1 : on construit une "semaine type" (7 jours identiques) à partir de la
// section "meals". Format attendu (parseLabeledLines) :
//   Petit-déjeuner : œuf brouillé + toast + fruit
//   Collation 10h : yaourt nature
//   Déjeuner : poulet + riz + légumes
//   Collation 16h : amandes
//   Dîner : poisson + patate douce + salade
//
// L'override par jour (mode hybride choisi par le user) viendra après
// migration : on lira consultation.week_overrides JSONB.

const SLOT_PATTERNS = [
  { slot: "breakfast",       label_fr: "Petit-déjeuner",  label_en: "Breakfast",
    re: /(petit\s*[\-\s]?d[ée]j(?:euner)?|breakfast|matin(?!e)|wake|morning\s*meal)/i },
  { slot: "morning_snack",   label_fr: "Collation matin", label_en: "Morning snack",
    re: /(collation\s*(?:matin|10h?))|morning\s*snack|mid\s*morning/i },
  { slot: "lunch",           label_fr: "Déjeuner",         label_en: "Lunch",
    re: /(d[ée]jeuner|midi|lunch|noon)/i },
  { slot: "afternoon_snack", label_fr: "Collation après-midi", label_en: "Afternoon snack",
    re: /(collation\s*(?:apr[èe]s[\-\s]?midi|16h?))|afternoon\s*snack|tea\s*time/i },
  { slot: "dinner",          label_fr: "Dîner",            label_en: "Dinner",
    re: /(d[îi]ner|soir(?!ee)|dinner|evening\s*meal)/i },
  { slot: "evening_snack",   label_fr: "Collation soir",   label_en: "Evening snack",
    re: /(collation\s*soir|evening\s*snack|before\s*bed|nighttime)/i },
];

function classifyMealLabel(label, locale) {
  for (const p of SLOT_PATTERNS) {
    if (p.re.test(label)) {
      return {
        slot: p.slot,
        slot_label: locale === "fr" ? p.label_fr : p.label_en,
      };
    }
  }
  return { slot: "lunch", slot_label: label };
}

/** Variante stricte : ne retourne un slot que si la ligne courte matche un
 * pattern slot. Sert au fallback multi-ligne pour distinguer en-tête de slot
 * vs contenu. */
function classifyMealLabelStrict(label, locale) {
  for (const p of SLOT_PATTERNS) {
    if (p.re.test(label)) {
      return {
        slot: p.slot,
        slot_label: locale === "fr" ? p.label_fr : p.label_en,
      };
    }
  }
  return null;
}

/** Strip des markers markdown bold/italic qui cassent parseLabeledLines.
 * Ex: "**Petit-déjeuner** : Porridge" → "Petit-déjeuner : Porridge". */
function stripMarkdownBold(text) {
  return String(text || "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1") // **bold**
    .replace(/__([^_\n]+)__/g, "$1")     // __bold__
    .replace(/(?<![*\w])\*([^*\n]+?)\*(?!\w)/g, "$1") // *italic* (single, isolé)
    .replace(/(?<![_\w])_([^_\n]+?)_(?!\w)/g, "$1");  // _italic_ (single, isolé)
}

/** Nettoie un texte destiné à l'app cliente :
 *  - retire les markers markdown bold/italic (**, __)
 *  - retire les séparateurs horizontaux (---, ___, ***)
 *  - réduit les espaces multiples
 *  - trim. */
function cleanForApp(text) {
  return stripMarkdownBold(text)
    .replace(/^\s*[-_*]{3,}\s*$/gm, "") // séparateurs horizontaux
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Indique si un paragraphe ressemble à des données brutes type
 *  "Genre : Homme Age : 35 ans Poids : 110 kg ..." (profil cliente).
 *  Heuristique : raw data si soit beaucoup de paires en absolu (>= 7),
 *  soit densité significative (>= 0.5 paire par 80 chars). */
function looksLikeRawProfileData(text) {
  if (!text) return false;
  const t = String(text);
  const colonGroups = (t.match(/[A-Za-zéèàùûîâôçêŒœ][^:]{2,40}\s*:\s*\S/g) || []).length;
  if (colonGroups < 5) return false;
  const density = colonGroups / Math.max(1, t.length / 80);
  return colonGroups >= 7 || density >= 0.5;
}

/** Construit la liste des repas d'un jour à partir d'un body texte.
 *  Supporte deux formats :
 *   A) "Petit-déjeuner : Porridge" sur une seule ligne
 *   B) "Petit-déjeuner" puis "Porridge" sur la ligne suivante
 *  Dédupe par slot (un seul repas par slot et par jour, premier servi). */
function buildMealsFromBody(body, locale) {
  if (!body) return [];
  const cleaned = stripMarkdownBold(body);

  // Format A : slot : title
  const pairs = parseLabeledLines(cleaned);
  const seenSlotA = new Set();
  const usedIdsA = new Set();
  const mealsA = [];
  for (const p of pairs) {
    const strict = classifyMealLabelStrict(p.label, locale);
    if (!strict) continue; // p.label n'est pas un slot reconnu → on ignore
    if (seenSlotA.has(strict.slot)) continue;
    seenSlotA.add(strict.slot);
    mealsA.push({
      id: uniqueId(`meal-${strict.slot}`, usedIdsA),
      slot: strict.slot,
      slot_label: strict.slot_label,
      title: p.value,
    });
  }
  if (mealsA.length > 0) return mealsA;

  // Format B (fallback) : slot tout seul, contenu sur la ligne suivante
  const lines = cleaned
    .split("\n")
    .map((l) => l.replace(/^[—\-•*·>]\s*/, "").trim())
    .filter(Boolean);

  const seenSlot = new Set();
  const usedIds = new Set();
  const mealsB = [];
  let pending = null; // { slot, slot_label } en attente de contenu

  for (const line of lines) {
    // Une ligne courte qui matche EXACTEMENT un slot connu = en-tête de slot.
    // Heuristique : <= 30 chars + match strict.
    if (line.length <= 30) {
      const strict = classifyMealLabelStrict(line, locale);
      if (strict) {
        pending = strict;
        continue;
      }
    }
    // Sinon : ligne de contenu pour le slot en attente
    if (pending && !seenSlot.has(pending.slot)) {
      seenSlot.add(pending.slot);
      mealsB.push({
        id: uniqueId(`meal-${pending.slot}`, usedIds),
        slot: pending.slot,
        slot_label: pending.slot_label,
        title: line,
      });
      pending = null;
    }
  }
  return mealsB;
}

// V95 : Construit un index { slot → AlternativeMeal[] } à partir de la
// section "## 4. ALTERNATIVES PAR REPAS" du plan. Utilisé par buildWeekMeals
// pour décorer chaque meal.alternatives. Map vide si la section est absente
// (plans pré-V95) → backward compat naturelle.
function buildAlternativesIndex(sections, locale) {
  const altSection = findSection(sections, "alternatives");
  if (!altSection?.body) return new Map();

  const groups = parseSlotAlternatives(altSection.body);
  const index = new Map();

  for (const group of groups) {
    const slot = normalizeSlotLabelToSlot(group.slotLabel, locale);
    if (!slot) continue; // libellé non reconnu → drop ce groupe

    const usedAltIds = new Set();
    const items = group.items
      .map((it) => {
        if (!it.title || it.title.length < 3) return null;
        return {
          id: uniqueId(slugify(it.title), usedAltIds),
          title: it.title,
          ...(it.hint ? { hint: it.hint } : {}),
        };
      })
      .filter(Boolean);

    if (items.length > 0) index.set(slot, items);
  }

  return index;
}

function buildWeekMeals(client, consultation, sections) {
  const locale = resolveLocale(client);
  const dayLabels = locale === "fr" ? DAY_LABELS_FR : DAY_LABELS_EN;
  const dayShort = locale === "fr" ? DAY_SHORT_FR : DAY_SHORT_EN;
  const usedDayIds = new Set();

  // V94.42 : injection des recettes detaillees dans chaque meal.
  // mealRecipes est une map { mealKey → Recipe } stockee dans la consultation.
  // On injecte uniquement si l'IA/Anissa a effectivement enrichi le repas.
  const mealRecipes = (consultation && consultation.meal_recipes) || {};
  const attachRecipe = (m) => {
    const r = mealRecipes[mealKey(m.slot, m.title)];
    if (r && (r.ingredients?.length || r.preparation?.length)) {
      return { ...m, recipe: r };
    }
    return m;
  };

  // V95 : injection des alternatives par slot. Map vide si la section
  // "ALTERNATIVES PAR REPAS" n'a pas été produite par le prompt (plans pré-V95)
  // → meal.alternatives reste undefined, l'app cliente cache le bouton.
  const altsBySlot = buildAlternativesIndex(sections, locale);
  const attachAlternatives = (m) => {
    const alts = altsBySlot.get(m.slot);
    if (alts && alts.length > 0) return { ...m, alternatives: alts };
    return m;
  };

  // Mode A — JOUR PAR JOUR
  // Le plan contient des sections nommées LUNDI/MARDI/.../DIMANCHE (format
  // sport ou plan détaillé). On construit chaque jour à partir de sa section.
  const daySections = findAllSections(sections, "meals_day");
  if (daySections.length > 0) {
    // Map index -> meals
    const daysByIndex = new Map();
    for (const sec of daySections) {
      const idx = dayIndexFromTitle(sec.title);
      if (!idx) continue;
      const meals = buildMealsFromBody(sec.body, locale);
      // Si le même jour apparaît plusieurs fois (rare), on garde la première
      // occurrence non vide.
      if (!daysByIndex.has(idx) || (daysByIndex.get(idx).length === 0 && meals.length)) {
        daysByIndex.set(idx, meals);
      }
    }

    const days = dayLabels.map((label, i) => {
      const idx = i + 1;
      return {
        id: uniqueId(`day-${idx}`, usedDayIds),
        index: idx,
        label,
        short_label: dayShort[i],
        meals: (daysByIndex.get(idx) || []).map((m, j) => ({
          ...attachAlternatives(attachRecipe(m)),
          id: `day-${idx}-meal-${j + 1}`,
        })),
      };
    });
    return { days };
  }

  // Mode B — SEMAINE TYPE (avec rotation si plusieurs variantes)
  // V94.71 : on alterne entre la "JOURNEE TYPE" (section meals) et la
  // "JOURNEE TYPE ALTERNATIVE" (section meals_alt) pour eviter que la
  // cliente voie 7x les memes repas du Lundi au Dimanche. Si l'IA produit
  // plusieurs variantes alt, on rotate entre toutes (modulo).
  // S'il n'y a qu'une variante (cas plan minimal), comportement classique.
  const mealsSection = findSection(sections, "meals");
  const baseMeals = buildMealsFromBody(mealsSection?.body || "", locale);

  const altSections = findAllSections(sections, "meals_alt");
  const altVariants = altSections
    .map((s) => buildMealsFromBody(s.body, locale))
    .filter((m) => m.length > 0);

  const variants = [baseMeals, ...altVariants].filter((v) => v.length > 0);

  // Aucune variante : retour squelette vide (le diagnostic UI affichera
  // "0 repas" comme avant).
  if (variants.length === 0) {
    const days = dayLabels.map((label, i) => ({
      id: uniqueId(`day-${i + 1}`, usedDayIds),
      index: i + 1,
      label,
      short_label: dayShort[i],
      meals: [],
    }));
    return { days };
  }

  // Rotation : Lun/Mer/Ven/Dim = variant 0, Mar/Jeu/Sam = variant 1, etc.
  // Modulo permet d'absorber 1, 2 ou N variantes uniformement.
  const days = dayLabels.map((label, i) => {
    const variant = variants[i % variants.length];
    return {
      id: uniqueId(`day-${i + 1}`, usedDayIds),
      index: i + 1,
      label,
      short_label: dayShort[i],
      meals: variant.map((m, j) => ({
        ...attachAlternatives(attachRecipe(m)),
        id: `day-${i + 1}-meal-${j + 1}`,
      })),
    };
  });

  return { days };
}

// ─── 4. rotation_data ─────────────────────────────────────────────────────
//
// Source : section "rotation". Le parser existant produit déjà
// [{title, items:[]}].

function buildRotationData(client, consultation, sections) {
  const locale = resolveLocale(client);
  const rotSection = findSection(sections, "rotation");
  const groups = parseRotationGroups(rotSection?.body || "");

  const usedCatIds = new Set();
  const categories = groups.map((g) => {
    const isPrimary = /prot[eé]ines?|f[eé]culents?/i.test(g.title);
    const usedItemIds = new Set();
    return {
      id: uniqueId(slugify(g.title), usedCatIds),
      title: g.title,
      primary: isPrimary || undefined,
      items: g.items.map((label) => ({
        id: uniqueId(slugify(label), usedItemIds),
        label,
      })),
    };
  });

  return {
    header_title: locale === "fr" ? "Adapter mes repas" : "Adapt my meals",
    // intro → undefined (post-migration)
    categories,
  };
}

// ─── 5. fridge_data ───────────────────────────────────────────────────────
//
// Deux sources possibles dans le SaaS :
//   a) consultation.fiche_frigo_json (JSONB legacy structuré)
//   b) section "fridge" du nutrition_plan (texte libre, bullets)
//
// Priorité : fiche_frigo_json si présent et exploitable, sinon fallback
// sur le parsing du markdown. À blanc, on parse aussi food_yes/food_limit
// si dispo (sections séparées).

function buildFridgeFromJson(json, locale) {
  if (!json || typeof json !== "object") return null;

  const usedEssIds = new Set();
  const essentials = Array.isArray(json.essentials)
    ? json.essentials.map((label) => ({
        id: uniqueId(slugify(label), usedEssIds),
        label: String(label),
      }))
    : [];

  const buildCats = (input) => {
    if (!input) return [];
    // Si c'est un tableau (legacy : liste plate sans catégories), on emballe
    // dans une seule catégorie "À privilégier" / générique. Sinon les indices
    // 0, 1, 2, ... seraient pris pour des titres de catégories.
    if (Array.isArray(input)) {
      const usedItemIds = new Set();
      return input.length === 0 ? [] : [{
        id: "all",
        title: locale === "fr" ? "À privilégier" : "Favorite",
        items: input
          .map((label) => String(label).trim())
          .filter(Boolean)
          .map((label) => ({
            id: uniqueId(slugify(label), usedItemIds),
            label,
          })),
      }];
    }
    if (typeof input !== "object") return [];
    const usedCatIds = new Set();
    return Object.entries(input).map(([title, items]) => {
      const usedItemIds = new Set();
      return {
        id: uniqueId(slugify(title), usedCatIds),
        title,
        items: (Array.isArray(items) ? items : []).map((label) => ({
          id: uniqueId(slugify(label), usedItemIds),
          label: String(label),
        })),
      };
    });
  };

  const favorite = buildCats(json.a_privilegier || json.favorite || {});
  const limit = buildCats(json.a_limiter || json.limit || {});

  return {
    header_title: locale === "fr" ? "Votre frigo idéal" : "Your ideal fridge",
    essentials,
    essentials_title: locale === "fr"
      ? "Toujours avoir chez vous"
      : "Always have at home",
    favorite,
    limit,
  };
}

function buildFridgeFromText(client, consultation, sections, locale) {
  const fridgeSection = findSection(sections, "fridge");
  const fridgeBullets = parseBulletLines(fridgeSection?.body || "");

  // V94.64 : on appelle le builder canonique pour recuperer toFavor / toLimit
  // / forbidden — meme source de verite que la modal SaaS et le Word.
  // Ainsi, ce que la cliente voit dans son app = ce qu'Anissa voit dans la
  // modal Fiche Frigo = ce qui sort dans le Word. Coherence E2E garantie.
  const canonical = buildCanonicalFridgeData(client, consultation, sections);
  const yesBullets = canonical.toFavor || [];
  // limit côté app = toLimit du plan + forbidden (allergies/alimentsEvites form)
  let limitBullets = [...(canonical.toLimit || [])];
  const seen = new Set(limitBullets.map((l) => l.toLowerCase()));
  for (const item of canonical.forbidden || []) {
    if (!seen.has(item.toLowerCase())) {
      limitBullets.push(item);
      seen.add(item.toLowerCase());
    }
  }

  const usedEssIds = new Set();
  const essentials = fridgeBullets.map((label) => ({
    id: uniqueId(slugify(label), usedEssIds),
    label,
  }));

  const buildSingleCat = (title, bullets) => {
    if (!bullets.length) return [];
    const usedItemIds = new Set();
    return [{
      id: slugify(title),
      title,
      items: bullets.map((label) => ({
        id: uniqueId(slugify(label), usedItemIds),
        label,
      })),
    }];
  };

  return {
    header_title: locale === "fr" ? "Votre frigo idéal" : "Your ideal fridge",
    essentials,
    essentials_title: locale === "fr"
      ? "Toujours avoir chez vous"
      : "Always have at home",
    favorite: buildSingleCat(
      locale === "fr" ? "À privilégier" : "Favorite",
      yesBullets,
    ),
    limit: buildSingleCat(
      locale === "fr" ? "À limiter" : "Limit",
      limitBullets,
    ),
  };
}

function buildFridgeData(client, consultation, sections) {
  const locale = resolveLocale(client);
  const fromJson = buildFridgeFromJson(consultation?.fiche_frigo_json, locale);
  if (fromJson && (fromJson.essentials.length || fromJson.favorite.length || fromJson.limit.length)) {
    return fromJson;
  }
  return buildFridgeFromText(client, consultation, sections, locale);
}

// ─── 6. protocols_data ────────────────────────────────────────────────────
//
// Source : consultation.supplements (texte structuré) + sections protocol
// du plan. Le parser existant produit [{name, fields:{moment,dosage,...}}].
// On groupe par moment de prise.

const MOMENT_GROUPS = [
  { id: "morning",
    re: /matin|jeun|r[eé]veil|au\s*lever|d[eé]but\s*de\s*journ[eé]e|breakfast|morning|wake|am\b/i,
    title_fr: "Le matin", title_en: "Morning" },
  { id: "afternoon",
    re: /midi|d[ée]jeuner|apr[èe]s[\-\s]?midi|gouter|go[uû]ter|collation|afternoon|noon|lunch|pm\b/i,
    title_fr: "L'après-midi", title_en: "Afternoon" },
  { id: "evening",
    re: /soir|d[îi]ner|coucher|nuit|avant\s*de\s*dormir|evening|dinner|bed|night/i,
    title_fr: "Le soir", title_en: "Evening" },
];

function classifyMoment(momentText) {
  for (const g of MOMENT_GROUPS) {
    if (g.re.test(String(momentText || ""))) return g.id;
  }
  return "other";
}

function buildProtocolsData(client, consultation, sections) {
  const locale = resolveLocale(client);

  // Source principale : champ supplements
  // Source secondaire : sections protocol* du plan
  const sources = [
    consultation?.supplements,
    ...findAllSections(sections, "protocol").map((s) => s.body),
    ...findAllSections(sections, "supplements").map((s) => s.body),
  ].filter(Boolean);

  // Stratégie permissive en 2 passes :
  //
  //  Pass 1 — exclut les faux positifs structurels (titres de sections, TOC,
  //  noms de doc) qui sont captés à tort par parseSupplementEntriesStructured
  //  (heuristique "ligne courte en MAJUSCULES" → bruit possible).
  //
  //  Pass 2 — préfère les entries qui ont au moins un field structuré
  //  (Sources/Dosage/Moment/Justification/Durée/Interactions). MAIS si AUCUN
  //  complément n'a de field (cas plans simples non structurés), on garde
  //  tous les noms qui ont passé Pass 1 — l'app cliente affichera juste les
  //  noms sans détails plutôt que rien.

  const isPlausibleSupplementName = (entry) => {
    if (!entry?.name) return false;
    const n = entry.name.trim();
    // Rejet : commence par un nombre + point/parenthèse → TOC ("1. ANALYSE")
    if (/^\d+\s*[.)\-]/.test(n)) return false;
    // Rejet : titres de document ("PLAN NUTRITION...", "PLAN ALIMENTAIRE...")
    if (/^plan\s+\w+/i.test(n)) return false;
    // Rejet : titres très évidents (CONSEILS, AJUSTEMENTS, OBSERVATIONS,
    // OPTIMISATION, ANALYSE, PRINCIPES) — sections, pas compléments
    if (/^(conseils?|ajustements?|observations?|optimisation|analyse|principes?|recommandations?|introductions?|conclusion|cl[oô]ture)\b/i.test(n)) return false;
    // Rejet : un seul mot trop court probable bruit (sauf marques connues — on garde 4+)
    if (n.length < 4) return false;
    return true;
  };

  const hasStructuredField = (entry) => {
    const f = entry?.fields || {};
    return !!(f.dosage || f.moment || f.sources || f.justification || f.duree || f.interactions);
  };

  const passOne = sources
    .flatMap((src) => parseSupplementEntriesStructured(src))
    .filter(isPlausibleSupplementName);

  const withFields = passOne.filter(hasStructuredField);
  const allEntries = withFields.length > 0 ? withFields : passOne;

  // Grouper par moment de prise. On essaie d'abord le champ `moment`, puis on
  // se rabat sur une recherche dans le texte concaténé de tous les fields
  // (parfois Anissa met le timing dans `dosage` ou `interactions`).
  const groupBuckets = new Map();
  const usedItemIds = new Set();

  for (const entry of allEntries) {
    if (!entry?.name) continue;
    const fields = entry.fields || {};
    const allText = [
      fields.moment, fields.dosage, fields.interactions, fields.justification, fields.duree,
    ].filter(Boolean).join(" ");
    let groupId = classifyMoment(fields.moment);
    if (groupId === "other") groupId = classifyMoment(allText);

    if (!groupBuckets.has(groupId)) groupBuckets.set(groupId, []);
    groupBuckets.get(groupId).push({
      id: uniqueId(slugify(entry.name), usedItemIds),
      name: entry.name,
      benefit: fields.justification,
      timing_detail: fields.moment,
      dose: fields.dosage,
    });
  }

  // Si tous les compléments sont tombés dans "other" (aucun timing reconnu),
  // on les regroupe sous un seul groupe générique sans label de moment —
  // plus propre côté app cliente que d'afficher "Autre moment".
  const ids = [...groupBuckets.keys()];
  if (ids.length === 1 && ids[0] === "other") {
    const items = groupBuckets.get("other");
    return {
      header_title: locale === "fr" ? "Vos compléments" : "Your supplements",
      groups: items.length ? [{
        id: "all",
        title: locale === "fr" ? "Vos compléments" : "Your supplements",
        items,
      }] : [],
    };
  }

  const titleFor = (id) => {
    const g = MOMENT_GROUPS.find((x) => x.id === id);
    if (g) return locale === "fr" ? g.title_fr : g.title_en;
    return locale === "fr" ? "Autre moment" : "Other";
  };

  // Ordre stable : morning, afternoon, evening, other
  const order = ["morning", "afternoon", "evening", "other"];
  const groups = order
    .filter((id) => groupBuckets.has(id))
    .map((id) => ({
      id,
      title: titleFor(id),
      items: groupBuckets.get(id),
    }));

  return {
    header_title: locale === "fr" ? "Vos compléments" : "Your supplements",
    // intro → undefined (post-migration)
    groups,
  };
}

// ─── Builder principal ────────────────────────────────────────────────────

/**
 * Construit le ClientPlan JSON à publier dans l'app cliente.
 *
 * @param {object} client       - ligne `clients` du SaaS
 * @param {object} consultation - ligne `nutrition_consultations` du SaaS
 * @returns {object}            - ClientPlan (sans id/published_at — set côté staging)
 */
export function buildClientAppPlanFromConsultation(client, consultation) {
  if (!client) throw new Error("clientAppMapper: client is required");
  if (!consultation) throw new Error("clientAppMapper: consultation is required");

  const sections = splitPlanSections(consultation.nutrition_plan);

  const intro_data    = buildIntroData(client, consultation, sections);
  const strategy_data = buildStrategyData(client, consultation, sections);
  const week_meals    = buildWeekMeals(client, consultation, sections);
  const rotation_data = buildRotationData(client, consultation, sections);
  const fridge_data   = buildFridgeData(client, consultation, sections);
  const protocols_data= buildProtocolsData(client, consultation, sections);

  return {
    client_id: client.id,
    status: "draft",
    locale: resolveLocale(client),
    mode: resolveMode(client),
    title: client.prenom
      ? (resolveLocale(client) === "fr"
          ? `Plan de ${client.prenom}`
          : `${client.prenom}'s plan`)
      : undefined,
    objective: client?.form?.objectif || client?.form?.objective || undefined,
    published_version: 0,
    sections: {
      intro_data,
      strategy_data,
      week_meals,
      rotation_data,
      fridge_data,
      protocols_data,
    },
  };
}

// ─── Diagnostic helper (pour étape 2 : test sur 1 vraie consultation) ─────
//
// Renvoie un rapport texte des champs manquants/vides détectés, pour
// itérer sur le mapping avant migration DB.

export function diagnoseClientAppPlan(plan) {
  const issues = [];
  const s = plan?.sections || {};

  if (!s.intro_data?.body?.length) issues.push("intro.body: vide");
  if (!s.intro_data?.tailored_points?.length) issues.push("intro.tailored_points: vide (à ajouter post-migration)");

  if (!s.strategy_data?.essential?.length) issues.push("strategy.essential: vide");
  if (!s.strategy_data?.pillars?.length) issues.push("strategy.pillars: vide");
  if (!s.strategy_data?.takeaways?.length) issues.push("strategy.takeaways: vide");
  if (!s.strategy_data?.signature_phrase?.length) issues.push("strategy.signature_phrase: vide (à ajouter post-migration)");

  const totalMeals = (s.week_meals?.days || []).reduce((acc, d) => acc + (d.meals?.length || 0), 0);
  if (!totalMeals) issues.push("week_meals: aucun repas trouvé (vérifier section SEMAINE 1 — STRUCTURE ALIMENTAIRE)");

  if (!s.rotation_data?.categories?.length) issues.push("rotation.categories: vide (vérifier section ROTATION/SUBSTITUTIONS)");

  const fridgeCount = (s.fridge_data?.essentials?.length || 0)
                    + (s.fridge_data?.favorite?.length || 0)
                    + (s.fridge_data?.limit?.length || 0);
  if (!fridgeCount) issues.push("fridge_data: aucun item (vérifier section FICHE FRIGO ou fiche_frigo_json)");

  if (!s.protocols_data?.groups?.length) issues.push("protocols_data: aucun complément (vérifier consultation.supplements)");

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      intro_paragraphs: s.intro_data?.body?.length || 0,
      strategy_pillars: s.strategy_data?.pillars?.length || 0,
      strategy_takeaways: s.strategy_data?.takeaways?.length || 0,
      week_total_meals: totalMeals,
      rotation_categories: s.rotation_data?.categories?.length || 0,
      fridge_items: fridgeCount,
      protocol_groups: s.protocols_data?.groups?.length || 0,
    },
  };
}
