// Parsers utilitaires pour l'editeur nutrition — dupliques depuis nutritionPdf.js
// Dupliques volontairement pour eviter de tirer jsPDF dans le bundle de l'editeur.
//
// ⚠️  GARDE EN SYNC AVEC src/nutritionPdf.js
//     Fonctions miroir : detectSectionType (L361), parseLabeledLines (L832),
//     parseBulletLines (L849), parseRotationGroups (L694),
//     parseTimelineSteps (L783), parseSupplementEntriesStructured (L599).
//     Toute modif ici DOIT etre repliquee dans nutritionPdf.js (et inversement),
//     sinon l'editeur et le PDF divergent.

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
