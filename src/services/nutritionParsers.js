// ─── nutritionParsers ──────────────────────────────────────────────────
// SOURCE UNIQUE pour classification + parsing des sections nutrition.
// Modifie ici → impacte SIMULTANEMENT editeur premium et PDF.
// NE PAS dupliquer dans nutritionPdf.js / NutritionEditor.jsx.
//
// V91.0 : extraction depuis nutritionEditorParsers.js (qui devient stub).
// nutritionPdf.js importe d'ici aussi → fini la duplication byte-a-byte
// qui faisait diverger silencieusement editeur et PDF.

// Slugifier un texte pour detecter le type de section
function normalizeSectionKey(title) {
  return (title || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Detecte le TYPE visuel d'une section pour choisir le rendu
// V86.8 : regex etendues FR+EN. Les motifs FR existants sont strictement preserves,
// on ajoute une alternative EN par regex (liste stricte, pas de synonymes multiples).
// Titres EN cibles produits par nutritionPromptsEn.js :
//   ## 0. PERSONALIZED INTRODUCTION
//   ## 1. PROFILE ANALYSIS
//   ## 2. NUTRITIONAL STRATEGY
//   ## 3. WEEK 1 — MEAL STRUCTURE
//   ## 4. MEAL ROTATION
//   ## 5. ALTERNATIVE DAY
//   ## 6. FRIDGE RULES
//   ## 7. TARGETED PROTOCOLS
//   ## 8. ENVIRONMENTAL ADJUSTMENTS
//   ## 9. COACH RECOMMENDATIONS
//   ## 10. ACTION PLAN (4 WEEKS) / ## 10. PLAN CONCLUSION
//   ## 11. PLAN CONCLUSION
export function detectSectionType(title) {
  const k = normalizeSectionKey(title);
  if (/^(introduction|intro)(\s*personnalisee)?$|^personalized\s+introduction$/.test(k)) return 'intro';
  if (/^(cloture|conclusion)(\s*du\s*plan)?$|^plan\s+conclusion$/.test(k)) return 'closing';
  if (/analyse\s*du\s*profil|profil|profile\s*analysis/.test(k)) return 'profile';
  if (/strategie\s*nutritionnelle|strategie|nutritional\s*strategy/.test(k)) return 'strategy';
  // V69 : meals AVANT week pour que "SEMAINE 1 — STRUCTURE ALIMENTAIRE" gagne sur 'week'
  if (/semaine\s*1.*structure|structure\s*alimentaire|plan\s*alimentaire|menus?|week\s*1.*meal\s*structure/.test(k)) return 'meals';
  if (/semaine\s*\d|week\s*\d/.test(k)) return 'week';
  if (/journee\s*type\s*alternative|journee\s*alternative|variante|alternative\s*day/.test(k)) return 'meals_alt';
  // V95 : nouvelle section "ALTERNATIVES PAR REPAS" produite par le prompt
  // (3-5 recettes substituables par slot). Doit etre detectee AVANT 'rotation'
  // pour eviter qu'un titre type "alternatives par repas" matche d'abord la
  // regex rotation (substitutions).
  if (/alternatives?\s*par\s*repas|meal\s*alternatives|alternatives?\s*par\s*slot/.test(k)) return 'alternatives';
  if (/rotation|substitutions?|meal\s*rotation/.test(k)) return 'rotation';
  if (/aliments?\s*autorises|aliments?\s*favoris|allowed\s*foods/.test(k)) return 'food_yes';
  if (/aliments?\s*limites|aliments?\s*moderes|limited\s*foods/.test(k)) return 'food_limit';
  if (/aliments?\s*interdits|aliments?\s*a\s*eviter|forbidden\s*foods/.test(k)) return 'food_no';
  if (/protocoles?\s*cibles|protocole|targeted\s*protocols/.test(k)) return 'protocol';
  if (/fiche\s*frigo|frigo|fridge\s*rules|fridge/.test(k)) return 'fridge';
  if (/ajustements?\s*environnementaux|ajustements|environmental\s*adjustments/.test(k)) return 'adjustments';
  if (/recommandations?\s*coach|recommandations|coach\s*recommendations/.test(k)) return 'coach';
  if (/plan\s*d.?action|action\s*plan|action/.test(k)) return 'action';
  if (/supplements?\s*recommandes|supplements?|recommended\s*supplements/.test(k)) return 'supplements';
  if (/stabilisation\s*glycemique|glycemie|glucose\s*stabilization/.test(k)) return 'protocol_glycemic';
  if (/gestion\s*stress|stress\s*management|stress/.test(k)) return 'protocol_stress';
  if (/reparation\s*intestinale|intestinale|gut\s*repair/.test(k)) return 'protocol_gut';
  return 'default';
}

export { normalizeSectionKey };

// Parse une section de texte en paires label/value
export function parseLabeledLines(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const pairs = [];
  for (const line of lines) {
    const t = line.trim().replace(/^[—\-•*·]\s*/, '');
    const m = t.match(/^([A-Za-zéèàùûîâôçêŒœ][^:]{2,60}?)\s*:\s*(.+)$/);
    if (m) {
      pairs.push({ label: m[1].trim(), value: m[2].trim() });
    } else if (pairs.length > 0 && t) {
      pairs[pairs.length - 1].value += ' ' + t;
    }
  }
  return pairs;
}

// Parse des lignes en items bullet
export function parseBulletLines(text) {
  if (!text) return [];
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l && /^([—\-•*·]|\d+[\.\)])\s+/.test(l))
    .map(l => l.replace(/^([—\-•*·]|\d+[\.\)])\s+/, '').trim())
    .filter(Boolean);
}

// V95 : Parse la section "ALTERNATIVES PAR REPAS" produite par le prompt.
// Format attendu (subheader-per-slot + bullet list) :
//
//   ### Petit-dejeuner
//   - Porridge avoine & fruits rouges — 40g flocons · lait amande
//   - Smoothie banane & beurre amande — 1 banane · 200ml lait
//
//   ### Dejeuner
//   - Saumon vapeur & quinoa — 120g saumon · brocolis
//
// Sortie : [{ slotLabel: 'Petit-dejeuner', items: [{ title, hint? }, ...] }, ...]
//
// State machine simple. Style fail-soft cohérent avec parseRotationGroups :
// si une section est mal formattée, on drop silencieusement (pas d'exception).
export function parseSlotAlternatives(text, locale = 'fr') {
  if (!text) return [];
  const lines = text.split('\n');
  const groups = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // V95.3 : detection de sous-header tolerante. L'IA produit le format
    // attendu (### Petit-dejeuner) la plupart du temps, mais derive parfois
    // vers du bold (**Petit-dejeuner**) ou du texte nu. On accepte les 3
    // formats — le critere final est "ce libelle est-il un slot connu ?".
    const detectedHeader = detectSlotHeader(line, locale);
    if (detectedHeader) {
      current = { slotLabel: detectedHeader, items: [] };
      groups.push(current);
      continue;
    }

    // Bullet line dans le groupe courant
    if (!current) continue;
    if (!/^[—\-•*·]\s+/.test(line)) continue;
    const stripped = line.replace(/^[—\-•*·]\s+/, '').trim();
    if (!stripped) continue;

    // Split sur le 1er séparateur visuel " — " / " – " / " - " (espaces autour
    // pour éviter de splitter "1/2", "feta-cabillaud", etc.).
    const splitMatch = stripped.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    if (splitMatch) {
      current.items.push({
        title: splitMatch[1].trim(),
        hint: splitMatch[2].trim(),
      });
    } else {
      current.items.push({ title: stripped });
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

/** V95.3 : helper pour parseSlotAlternatives. Retourne le label si la ligne
 *  est un sous-header de slot (3 formats acceptes), null sinon. */
function detectSlotHeader(line, locale) {
  // Format 1 : ### Petit-dejeuner (markdown standard)
  const mdMatch = line.match(/^#{2,4}\s+(.+)$/);
  if (mdMatch) return mdMatch[1].trim();

  // Format 2 : **Petit-dejeuner** (bold markdown). On ne l'accepte que si
  // c'est bien un slot connu, pour eviter de transformer un bullet bold
  // accidentel en header.
  const boldMatch = line.match(/^\*\*([^*]+)\*\*\s*:?$/);
  if (boldMatch) {
    const inner = boldMatch[1].trim();
    if (normalizeSlotLabelToSlot(inner, locale)) return inner;
  }

  // Format 3 : Petit-dejeuner (texte nu sur ligne courte). Critere strict :
  // - <= 30 chars
  // - pas de ":" (pour ne pas avaler "Petit-dejeuner : 1 oeuf...")
  // - pas un bullet
  // - matche un slot connu
  if (
    line.length <= 30
    && !line.includes(':')
    && !/^[—\-•*·]\s/.test(line)
    && normalizeSlotLabelToSlot(line, locale)
  ) {
    return line;
  }

  return null;
}

// V95 : Normalise un libellé de slot (FR ou EN, accents, casse variable) en
// MealSlot canonique. Aligné sur le mapping inline de buildMealsFromBody dans
// clientAppMapper.js — exporté ici pour réutilisation par parseSlotAlternatives
// + buildAlternativesIndex. Sans cette normalisation commune, alternatives.slot
// pourrait diverger de meal.slot et casser la lookup mealKey(slot, title).
//
// Le param locale est gardé pour extension future (DE, ES, IT). FR et EN
// couverts par une regex unifiée.
// eslint-disable-next-line no-unused-vars
export function normalizeSlotLabelToSlot(label, locale = 'fr') {
  const k = (label || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/petit[\s-]?dejeuner|breakfast/.test(k)) return 'breakfast';
  if (/d[i\u00ee]ner|dinner|souper/.test(k)) return 'dinner';
  // "déjeuner" sans "petit" → lunch. Test placé après dîner pour ne pas matcher
  // les libellés "déjeuner" qui sont en réalité des dîners EN UK ; on assume
  // ici la convention française (déjeuner = midi).
  if (/(?<!petit[\s-])dejeuner|lunch/.test(k)) return 'lunch';
  if (/collation|snack|gouter/.test(k)) {
    if (/matin/.test(k)) return 'morning_snack';
    if (/soir/.test(k)) return 'evening_snack';
    return 'afternoon_snack';
  }
  return null;
}

// Parse une section rotation "Proteines : A / B / C" → groups
export function parseRotationGroups(text) {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const groups = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[-–•*·]\s*/, '');
    const m = cleaned.match(/^(Prot[eé]ines?|F[eé]culents?|L[eé]gumes?|Mati[eè]res?\s*grasses?|Lipides?|Gras|Gras?\s*bons?)[^:]{0,30}?\s*:\s*(.+)$/i);
    if (!m) continue;
    const title = m[1].trim();
    const raw = m[2].trim();
    // V71 : slash EXIGE des espaces autour, sinon "1/2 avocat" se fait splitter
    const items = raw.split(/\s*,\s*|\s+\/\s+/).map(s => s.trim()).filter(Boolean);
    if (items.length >= 2) groups.push({ title, items });
  }
  return groups;
}

// Parse plan d'action "S1 — texte" → steps
export function parseTimelineSteps(text) {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const steps = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[-–•*·]\s*/, '');
    const m = cleaned.match(/^(S(?:emaine)?\s*\d|S\d)\s*[—\-:]\s*(.+)$/i);
    if (!m) continue;
    const label = m[1].replace(/semaine\s*/i, 'S').toUpperCase().replace(/\s+/g, '');
    steps.push({ label, text: m[2].trim() });
  }
  return steps;
}

// Parse un bloc de texte en entrees de supplements structurees
// V87.2 : miroir stricte avec nutritionPdf.js — rejete les titres de section
// redondants (RECOMMENDED SUPPLEMENTS / SUPPLEMENTS RECOMMANDES) pour eviter
// qu'ils soient parses comme des entrees supplement vides (doublon visuel).
const REDUNDANT_SUPP_TITLE_RE = /^\s*(?:recommended\s+supplements?|suppl[eé]ments?\s+recommand[eé]s?|suppl[eé]ments?|supplements?)\s*:?\s*$/i;

export function parseSupplementEntriesStructured(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const entries = [];
  let current = null;

  const isSupplementHeader = (l) => {
    const t = l.trim();
    if (!t || t.length > 50) return false;
    if (t.includes(':') && t.indexOf(':') < t.length - 3) return false;
    if (REDUNDANT_SUPP_TITLE_RE.test(t)) return false;
    const upperChars = (t.match(/[A-Z0-9 +\-/()]/g) || []).length;
    return t.length >= 4 && upperChars >= t.length * 0.7;
  };

  const parseField = (l) => {
    const m = l.trim().replace(/^[—\-•*·]\s*/, '').match(/^([A-Za-zéè][^:]{0,30}?)\s*:\s*(.+)$/);
    if (!m) return null;
    const rawLabel = m[1].toLowerCase().trim();
    const val = m[2].trim();
    // V87.1 : regex etendues FR + EN (miroir stricte avec nutritionPdf.js)
    if (/source/.test(rawLabel)) return { key: 'sources', val };
    if (/complement|supplement|dose|dosage/.test(rawLabel)) return { key: 'dosage', val };
    if (/justif|raison|pourquoi|why|reason/.test(rawLabel)) return { key: 'justification', val };
    if (/interact|attention|eviter|caution|warning|avoid/.test(rawLabel)) return { key: 'interactions', val };
    if (/duree|pendant|cure|duration|length/.test(rawLabel)) return { key: 'duree', val };
    if (/moment|quand|horaire|timing|when/.test(rawLabel)) return { key: 'moment', val };
    if (/association|pairing/.test(rawLabel)) return { key: 'interactions', val };
    return null;
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (isSupplementHeader(t)) {
      if (current) entries.push(current);
      current = { name: t.replace(/[*#]/g, '').trim(), fields: {} };
      continue;
    }
    if (current) {
      const f = parseField(t);
      if (f) {
        current.fields[f.key] = current.fields[f.key] ? current.fields[f.key] + ' ' + f.val : f.val;
      }
    }
  }
  if (current) entries.push(current);
  return entries;
}
