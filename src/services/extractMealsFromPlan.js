// V94.42 — Extraction des repas uniques depuis un plan nutrition
// Reutilise la logique de parsing de clientAppMapper.js mais expose une
// fonction publique pour l'authoring de recettes (cote Anissa).
//
// Output : array de meals uniques avec une cle stable basee sur slot+title.
// Cette cle sert d'identifiant pour stocker les recettes (consultation.meal_recipes).

import {
  detectSectionType,
  parseLabeledLines,
  parseSlotAlternatives,
  normalizeSlotLabelToSlot,
} from "../nutritionEditorParsers";

const SLOT_LABELS_FR = {
  breakfast: "Petit-dejeuner",
  morning_snack: "Collation matin",
  lunch: "Dejeuner",
  afternoon_snack: "Collation apres-midi",
  dinner: "Diner",
  evening_snack: "Collation soir",
};

const SLOT_PATTERNS = [
  { slot: "breakfast", re: /^(petit[- ]?d[ée]jeuner|matin|breakfast)\b/i },
  { slot: "morning_snack", re: /^(collation\s*matin|en[- ]?cas\s*matin|morning\s*snack)\b/i },
  { slot: "lunch", re: /^(d[ée]jeuner|midi|lunch)\b/i },
  { slot: "afternoon_snack", re: /^(collation\s*apr[eè]s|gout[eé]r|afternoon\s*snack|tea\s*time)\b/i },
  { slot: "dinner", re: /^(d[iî]ner|soir|dinner)\b/i },
  { slot: "evening_snack", re: /^(collation\s*soir|en[- ]?cas\s*soir|evening\s*snack)\b/i },
];

function classifySlot(label) {
  const trimmed = String(label || "").trim();
  for (const { slot, re } of SLOT_PATTERNS) {
    if (re.test(trimmed)) return { slot, slot_label: SLOT_LABELS_FR[slot] };
  }
  return null;
}

/** Slug stable pour identifier un repas a travers les sessions d'authoring. */
export function mealKey(slot, title) {
  const t = String(title || "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${slot}::${t}`;
}

/** Strip markdown bold (**, __) pour permettre le matching slot. */
function stripBold(s) {
  return String(s || "").replace(/\*\*/g, "").replace(/__/g, "");
}

/**
 * Decoupe un texte de plan en sections par titre header.
 * Reutilise la convention "## TITRE" + "TITRE EN MAJ" + sections type meals.
 *
 * V95.4 : restreint aux titres niveau 1-2 (^#{1,2}\s+) pour eviter de couper
 * la section ALTERNATIVES PAR REPAS sur les ### sous-headers (idem fix V95.1
 * sur clientAppMapper.splitPlanSections).
 */
function splitIntoSections(planText) {
  const lines = String(planText || "").split("\n");
  const sections = [];
  let currentTitle = "";
  let currentBody = [];

  const flush = () => {
    if (currentTitle || currentBody.length > 0) {
      sections.push({
        title: currentTitle,
        body: currentBody.join("\n").trim(),
        type: detectSectionType(currentTitle),
      });
    }
    currentBody = [];
  };

  for (const line of lines) {
    const headerMatch =
      line.match(/^#{1,2}\s+(.+)/) ||
      (line === line.toUpperCase() && line.trim().length > 5 && line.trim().length < 80 ? [null, line.trim()] : null);
    if (headerMatch) {
      flush();
      currentTitle = headerMatch[1].trim();
    } else {
      currentBody.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * Extrait les repas uniques d'un plan nutrition.
 * Strategy : regroupe TOUS les repas trouves (sections type 'meals' et 'meals_day')
 * et dedupe par mealKey(slot, title).
 *
 * @param {string} planText - Le contenu textuel du plan (consultation.nutrition_plan)
 * @returns {Array<{ key, slot, slot_label, title, hint? }>}
 */
export function extractUniqueMealsFromPlan(planText) {
  const sections = splitIntoSections(planText);
  const seen = new Set();
  const meals = [];

  for (const sec of sections) {
    if (sec.type !== "meals" && sec.type !== "meals_day") continue;
    const cleaned = stripBold(sec.body);
    const pairs = parseLabeledLines(cleaned);

    for (const p of pairs) {
      const slotInfo = classifySlot(p.label);
      if (!slotInfo) continue;
      const title = String(p.value || "").trim();
      if (!title) continue;
      const key = mealKey(slotInfo.slot, title);
      if (seen.has(key)) continue;
      seen.add(key);
      meals.push({
        key,
        slot: slotInfo.slot,
        slot_label: slotInfo.slot_label,
        title,
      });
    }
  }

  // Tri par ordre standard de la journee
  const slotOrder = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "evening_snack"];
  meals.sort((a, b) => {
    const ai = slotOrder.indexOf(a.slot);
    const bi = slotOrder.indexOf(b.slot);
    if (ai !== bi) return ai - bi;
    return a.title.localeCompare(b.title);
  });

  return meals;
}

/**
 * V95.4 : extrait les repas principaux ET les alternatives. Utilise par
 * RecipesTab pour lister tout ce qui peut etre enrichi d'une recette.
 *
 * Chaque entree porte un flag `kind: 'main' | 'alt'` pour permettre a l'UI
 * de les distinguer (group by slot, badge "alternative", etc.).
 *
 * Dedup par mealKey(slot, title) — un titre identique entre main et alt
 * partage la meme recette (ce qui est rationnel : meme repas).
 *
 * @param {string} planText
 * @param {string} [locale='fr']
 * @returns {Array<{ key, slot, slot_label, title, hint?, kind }>}
 */
export function extractMealsAndAlternativesFromPlan(planText, locale = "fr") {
  const main = extractUniqueMealsFromPlan(planText).map((m) => ({ ...m, kind: "main" }));
  const seen = new Set(main.map((m) => m.key));
  const alts = [];

  // Trouve la section alternatives. splitIntoSections classe via detectSectionType.
  const sections = splitIntoSections(planText);
  const altSection = sections.find((s) => s.type === "alternatives");
  if (!altSection?.body) return main;

  const groups = parseSlotAlternatives(altSection.body, locale);
  for (const group of groups) {
    const slot = normalizeSlotLabelToSlot(group.slotLabel, locale);
    if (!slot) continue;
    const slotLabel = SLOT_LABELS_FR[slot] || group.slotLabel;
    for (const item of group.items) {
      const title = String(item.title || "").trim();
      if (!title) continue;
      const key = mealKey(slot, title);
      if (seen.has(key)) continue;
      seen.add(key);
      alts.push({
        key,
        slot,
        slot_label: slotLabel,
        title,
        hint: item.hint,
        kind: "alt",
      });
    }
  }

  // Re-tri global : main d'abord par slot canonique, puis alts par slot.
  const slotOrder = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "evening_snack"];
  const all = [...main, ...alts];
  all.sort((a, b) => {
    const ai = slotOrder.indexOf(a.slot);
    const bi = slotOrder.indexOf(b.slot);
    if (ai !== bi) return ai - bi;
    // main avant alt dans le meme slot
    if (a.kind !== b.kind) return a.kind === "main" ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return all;
}
