import { jsPDF } from 'jspdf';

const LOGO_URL = 'https://cdn.prod.website-files.com/69c276fd79d460813b99867a/69d411dfafbbe967e3d992c4_Design_sans_titre_1_-removebg-preview.png';

// ═══════════════════════════════════════════════════════════════════════
// V56 : DESIGN SYSTEM — palette, typographie, spacing premium
// ═══════════════════════════════════════════════════════════════════════

// Palette (cohérente avec branding Anissa)
const GREEN = [26, 46, 31];       // #1A2E1F — primaire (titres, accents)
const GOLD = [196, 160, 80];      // #C4A050 — accent doré
const GOLD_SOFT = [230, 210, 160]; // #E6D2A0 — accent doré léger
const DARK_TEXT = [51, 51, 48];   // #333330 — texte principal (contraste max)
const SOFT_TEXT = [85, 85, 80];   // #555550 — texte secondaire
const GREY_TEXT = [128, 128, 120]; // #808078 — labels, meta
const MUTED_TEXT = [170, 168, 162]; // #AAA8A2 — footer, captions
const SEPARATOR = [224, 220, 210]; // #E0DCD2 — lignes fines
const BG_PAGE = [250, 248, 243];  // #FAF8F3 — fond page (warm white)
const BG_CARD = [255, 255, 255];  // #FFFFFF — cartes (contraste)
const BG_SOFT = [244, 241, 234];  // #F4F1EA — blocks soft
const BG_ACCENT = [248, 243, 232]; // #F8F3E8 — highlight doré très léger

// Typographie (tailles en pt)
const FONT = {
  hero: 22,        // Cover title
  h1: 14,          // Section title (ANALYSE DU PROFIL)
  h2: 11,          // Subsection (Stratégie)
  h3: 10,          // Card title (Petit-déjeuner)
  body: 9.5,       // Texte normal
  small: 8.5,      // Secondaire
  micro: 7.5,      // Meta, footer
};

// Spacing (en mm)
const SPACE = {
  pageMarginX: 20,
  pageMarginTop: 22,
  pageMarginBottom: 20,
  sectionGap: 11,     // entre sections majeures
  blockGap: 7,        // entre blocs
  cardPadding: 6,
  lineHeight: 4.6,
  bulletIndent: 6,
};

const PAGE_H = 297;  // A4 hauteur
const PAGE_W = 210;  // A4 largeur

// ─── V86.9 : labels localises FR / EN ─────────────────────────────────────
// Tous les libelles visibles dans le PDF passent par L(key, locale).
// Fallback systematique sur FR (comportement actuel preserve si locale absent).
const PDF_LABELS = {
  FR: {
    COVER_TITLE: 'PLAN NUTRITIONNEL',
    COVER_SUBTITLE: 'Personnalise',
    INTRO_LABEL: "LE MOT D'ANISSA",
    CLOSING_LABEL: 'POUR LA SUITE',
    REMEMBER: 'A RETENIR',
    VARIANT: 'VARIANTE',
    SUPPLEMENTS_TITLE: 'SUPPLEMENTS RECOMMANDES',
    SUPP_TIMING: 'Moment',
    SUPP_DOSE: 'Dose',
    SUPP_WHY: 'Pourquoi',
    SUPP_DURATION: 'Duree',
    SUPP_CAUTION: 'Attention',
    SUPP_SOURCES: 'Sources',
    CONFIDENTIAL: 'Document confidentiel \u2014 usage personnel uniquement',
    FOOTER_CLOSING_LINE_1: 'Ce plan a ete elabore specifiquement pour vous',
    FOOTER_CLOSING_LINE_2: 'par Anissa Deroubaix, nutritionniste specialisee',
    FOOTER_CLOSING_LINE_3: 'en longevite et genetique.',
    FOOTER_RECOMMENDED_LINE_1: 'Il est recommande de suivre ce plan pendant 4 semaines',
    FOOTER_RECOMMENDED_LINE_2: "avant d'envisager des ajustements.",
    FOOTER_BRAND: 'Anissa Deroubaix Nutrition',
    FOOTER_ADDRESS: 'AB Coaching Sarl \u00b7 Rue de Rive 28, 1260 Nyon',
    DATE_LOCALE: 'fr-CH',
  },
  EN: {
    COVER_TITLE: 'NUTRITION PLAN',
    COVER_SUBTITLE: 'Personalized',
    INTRO_LABEL: "ANISSA'S NOTE",
    CLOSING_LABEL: 'MOVING FORWARD',
    REMEMBER: 'REMEMBER',
    VARIANT: 'VARIANT',
    SUPPLEMENTS_TITLE: 'RECOMMENDED SUPPLEMENTS',
    SUPP_TIMING: 'Timing',
    SUPP_DOSE: 'Dose',
    SUPP_WHY: 'Why',
    SUPP_DURATION: 'Duration',
    SUPP_CAUTION: 'Caution',
    SUPP_SOURCES: 'Sources',
    CONFIDENTIAL: 'Confidential document \u2014 personal use only',
    FOOTER_CLOSING_LINE_1: 'This plan has been specifically prepared for you',
    FOOTER_CLOSING_LINE_2: 'by Anissa Deroubaix, nutritionist specialized',
    FOOTER_CLOSING_LINE_3: 'in longevity and genetics.',
    FOOTER_RECOMMENDED_LINE_1: 'It is recommended to follow this plan for 4 weeks',
    FOOTER_RECOMMENDED_LINE_2: 'before considering adjustments.',
    FOOTER_BRAND: 'Anissa Deroubaix Nutrition',
    FOOTER_ADDRESS: 'AB Coaching Sarl \u00b7 Rue de Rive 28, 1260 Nyon',
    DATE_LOCALE: 'en-GB',
  },
};

function L(key, locale = 'FR') {
  return (PDF_LABELS[locale] && PDF_LABELS[locale][key]) || PDF_LABELS.FR[key];
}

// Derive locale from client (local copy to avoid circular import with services/)
function resolveLocale(client) {
  if (!client) return 'FR';
  const formule = String(client.formule || client.form?.formule || '').toLowerCase();
  const langue = String(client.langue || client.form?.langue || 'FR').toUpperCase();
  const eligible = ['suivi', 'intensif', 'pack20', 'pack30'].includes(formule);
  return (eligible && langue === 'EN') ? 'EN' : 'FR';
}

function formatDateFR(iso, locale = 'FR') {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(L('DATE_LOCALE', locale), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function loadImageAsBase64(url) {
  // Fetch-based first (bypasses canvas-tainting CORS issues when the CDN
  // sends Access-Control-Allow-Origin).
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch { /* tombe sur le fallback Image */ }

  // Fallback : image element + canvas (échoue silencieusement si CORS interdit)
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ─────────────────────────────────────────────────────
// MARKDOWN PARSER — converts AI markdown to structured tokens
// ─────────────────────────────────────────────────────

function cleanMarkdown(text) {
  return text
    .replace(/\{\{color:[^}]+\}\}/g, '')  // remove color open markers
    .replace(/\{\{\/color\}\}/g, '')       // remove color close markers
    .replace(/\{\{size:\d+\}\}/g, '')     // remove size open markers
    .replace(/\{\{\/size\}\}/g, '')        // remove size close markers
    .replace(/\{\{hl:[^}]+\}\}/g, '')     // remove highlight open markers
    .replace(/\{\{\/hl\}\}/g, '')          // remove highlight close markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // remove **bold**
    .replace(/\*([^*]+)\*/g, '$1')        // remove *italic*
    .replace(/__([^_]+)__/g, '$1')        // remove __bold__
    .replace(/_([^_]+)_/g, '$1')          // remove _italic_
    .replace(/`([^`]+)`/g, '$1')          // remove `code`
    .replace(/#{1,6}\s*/g, '')            // remove # headers
    .trim();
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

// Parse a line into segments with optional color
function parseColorSegments(text) {
  const segments = [];
  const regex = /\{\{color:(#[0-9a-fA-F]{6})\}\}(.*?)\{\{\/color\}\}/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), color: null });
    }
    segments.push({ text: match[2], color: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), color: null });
  }
  return segments;
}

// Render a line with colored segments
function renderColoredLine(doc, segments, x, y, defaultColor) {
  let cx = x;
  for (const seg of segments) {
    const clean = cleanMarkdown(seg.text);
    if (!clean) continue;
    if (seg.color) {
      doc.setTextColor(...hexToRgb(seg.color));
    } else {
      doc.setTextColor(...defaultColor);
    }
    doc.text(clean, cx, y);
    cx += doc.getTextWidth(clean);
  }
  // Restore default
  doc.setTextColor(...defaultColor);
}

function hasColorMarkers(text) {
  return /\{\{color:#[0-9a-fA-F]{6}\}\}/.test(text);
}

function hasHighlightMarkers(text) {
  return /\{\{hl:(yellow|green|red|blue)\}\}/.test(text);
}

const HL_COLORS = {
  yellow: [251, 191, 36],
  green: [74, 222, 128],
  red: [248, 113, 113],
  blue: [96, 165, 250],
};

// Render a line that may have highlight markers — draw bg rect then text
function renderHighlightedLine(doc, rawText, x, y, maxWidth, defaultColor) {
  const regex = /\{\{hl:(yellow|green|red|blue)\}\}(.*?)\{\{\/hl\}\}/g;
  let cx = x;
  let lastIdx = 0;
  let match;
  const clean = (t) => cleanMarkdown(t.replace(/\{\{color:[^}]*\}\}/g, '').replace(/\{\{\/color\}\}/g, ''));

  doc.setTextColor(...defaultColor);
  while ((match = regex.exec(rawText)) !== null) {
    // Text before highlight
    const before = clean(rawText.slice(lastIdx, match.index));
    if (before) { doc.text(before, cx, y); cx += doc.getTextWidth(before); }
    // Highlighted text
    const hlText = clean(match[2]);
    const hlW = doc.getTextWidth(hlText);
    const rgb = HL_COLORS[match[1]] || HL_COLORS.yellow;
    doc.setFillColor(rgb[0], rgb[1], rgb[2], 0.25);
    doc.rect(cx - 0.5, y - 3, hlW + 1, 4.5, 'F');
    doc.setTextColor(...defaultColor);
    doc.text(hlText, cx, y);
    cx += hlW;
    lastIdx = match.index + match[0].length;
  }
  const after = clean(rawText.slice(lastIdx));
  if (after) { doc.text(after, cx, y); }
}

function hasSizeMarkers(text) {
  return /\{\{size:\d+\}\}/.test(text);
}

function hasFormattingMarkers(text) {
  return hasColorMarkers(text) || hasHighlightMarkers(text) || hasSizeMarkers(text);
}

// Render a line that may contain {{size:px}} markers
function renderSizedLine(doc, rawText, x, y, defaultColor) {
  const regex = /\{\{size:(\d+)\}\}(.*?)\{\{\/size\}\}/g;
  let cx = x;
  let lastIdx = 0;
  let match;
  const baseFontSize = doc.getFontSize();

  // Strip other markers for clean render
  const strip = (t) => cleanMarkdown(t);

  doc.setTextColor(...defaultColor);
  while ((match = regex.exec(rawText)) !== null) {
    const before = strip(rawText.slice(lastIdx, match.index));
    if (before) {
      doc.setFontSize(baseFontSize);
      doc.text(before, cx, y);
      cx += doc.getTextWidth(before);
    }
    const px = parseInt(match[1]);
    // Map px to jsPDF pt (roughly 0.75 ratio)
    const pt = Math.round(px * 0.75);
    const sizedText = strip(match[2]);
    doc.setFontSize(pt);
    doc.text(sizedText, cx, y);
    cx += doc.getTextWidth(sizedText);
    lastIdx = match.index + match[0].length;
  }
  const after = strip(rawText.slice(lastIdx));
  if (after) {
    doc.setFontSize(baseFontSize);
    doc.text(after, cx, y);
  }
  doc.setFontSize(baseFontSize);
}

function detectBold(raw) {
  // Returns { text, wasBold } - checks if original had ** markers
  const boldMatch = raw.match(/^\*\*(.+)\*\*$/);
  if (boldMatch) return { text: boldMatch[1].trim(), wasBold: true };
  const underMatch = raw.match(/^__(.+)__$/);
  if (underMatch) return { text: underMatch[1].trim(), wasBold: true };
  return { text: raw, wasBold: false };
}

function parseNutritionPlan(markdownText) {
  if (!markdownText) return [];
  const tokens = [];
  const lines = markdownText.split('\n');

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) { tokens.push({ type: 'space' }); continue; }

    // Detect note/alert blocks
    const noteMatch = trimmed.match(/^\{\{note\}\}(.+?)\{\{\/note\}\}$/);
    if (noteMatch) { tokens.push({ type: 'noteblock', content: noteMatch[1].trim() }); continue; }
    const alertMatch = trimmed.match(/^\{\{alert\}\}(.+?)\{\{\/alert\}\}$/);
    if (alertMatch) { tokens.push({ type: 'alertblock', content: alertMatch[1].trim() }); continue; }

    // Strip markdown header markers
    const headerMatch = trimmed.match(/^#{1,6}\s+(.+)/);
    const content = headerMatch ? headerMatch[1] : trimmed;

    // Clean bold markers for analysis but remember if bold
    const { text: cleanContent, wasBold } = detectBold(content);
    const cleaned = cleanMarkdown(cleanContent);

    if (!cleaned) continue;

    // Detect week headers (SEMAINE 1, Semaine 2, etc.)
    if (/^semaine\s+\d/i.test(cleaned)) {
      tokens.push({ type: 'week', content: cleaned.toUpperCase() });
      continue;
    }

    // Detect section numbers (1. ANALYSE, 2. PRINCIPES, etc.)
    if (/^\d+\.\s+[A-Z]/.test(cleaned) && cleaned.length < 80) {
      tokens.push({ type: 'section', content: cleaned.replace(/^\d+\.\s*/, '').toUpperCase() });
      continue;
    }

    // Detect all-caps headers or markdown headers
    const isAllCaps = cleaned === cleaned.toUpperCase() && cleaned.length > 3 && cleaned.length < 60 && /[A-Z]/.test(cleaned);
    if (headerMatch || (isAllCaps && !/^\d/.test(cleaned))) {
      // Meal headers
      if (/petit[- ]?d[eé]jeuner|d[eé]jeuner|d[iî]ner|collation|go[uû]ter|snack/i.test(cleaned)) {
        tokens.push({ type: 'meal', content: cleaned.toUpperCase().replace(/[:#\-*]/g, '').trim() });
        continue;
      }
      // Day headers
      if (/^(LUNDI|MARDI|MERCREDI|JEUDI|VENDREDI|SAMEDI|DIMANCHE)/i.test(cleaned)) {
        tokens.push({ type: 'day', content: cleaned.toUpperCase() });
        continue;
      }
      tokens.push({ type: 'title', content: cleaned.toUpperCase().replace(/[:#]/g, '').trim() });
      continue;
    }

    // Detect meal headers in mixed case with bold
    if (wasBold && /petit[- ]?d[eé]jeuner|d[eé]jeuner|d[iî]ner|collation|go[uû]ter|snack/i.test(cleaned)) {
      tokens.push({ type: 'meal', content: cleaned.toUpperCase().replace(/[:#\-*]/g, '').trim() });
      continue;
    }

    // Detect day names in bold
    if (wasBold && /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i.test(cleaned)) {
      tokens.push({ type: 'day', content: cleaned.toUpperCase() });
      continue;
    }

    // Detect bold subtitles (Option 1, Alternative, etc.)
    if (wasBold || (headerMatch && cleaned.length < 60)) {
      tokens.push({ type: 'subtitle', content: cleaned });
      continue;
    }

    // Detect macros lines
    if (/\b(kcal|calories|prot[eé]ines?|glucides?|lipides?|macro|grammes?\s*[:=])/i.test(cleaned) && /\d/.test(cleaned)) {
      tokens.push({ type: 'macro', content: cleaned });
      continue;
    }

    // Detect bullet points
    if (/^[-–•*]\s/.test(trimmed)) {
      const bulletContent = cleanMarkdown(trimmed.replace(/^[-–•*]\s*/, ''));
      if (bulletContent) tokens.push({ type: 'bullet', content: bulletContent });
      continue;
    }

    // Regular text
    tokens.push({ type: 'text', content: cleaned });
  }

  return tokens;
}


// ─────────────────────────────────────────────────────
// PDF RENDERING HELPERS
// ─────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════
// V56 : HELPERS PREMIUM — cartes, blocs, listes, titres harmonieux
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️  V68 : Les fonctions normalizeSectionKey, detectSectionType,
//     parseLabeledLines, parseBulletLines, parseRotationGroups,
//     parseTimelineSteps, parseSupplementEntriesStructured sont DUPLIQUEES
//     dans src/nutritionEditorParsers.js (pour eviter jsPDF dans le bundle
//     de l'editeur React). Toute modif ici DOIT etre repliquee la-bas.

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
// V86.8 : miroir exact de nutritionEditorParsers.js. Regex etendues FR+EN
// pour reconnaitre aussi les titres anglais generes par nutritionPromptsEn.js.
function detectSectionType(title) {
  const k = normalizeSectionKey(title);
  // V59 : intro / cloture en style lettre (pas liste)
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

// V59 : render une section intro / cloture en style lettre manuscrite
// Centre, italique leger, pas de bullets
function drawLetterBlock(doc, text, x, y, width, opts = {}) {
  if (!text?.trim()) return y;
  y = ensurePage(doc, y, 20);

  // Bloc respirant : padding vertical genereux
  y += 4;
  doc.setFontSize(FONT.body + 0.5);
  doc.setFont('helvetica', opts.italic ? 'italic' : 'normal');
  doc.setTextColor(...SOFT_TEXT);

  const paragraphs = text.trim().split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para.replace(/\n/g, ' '), width - 12);
    for (const line of lines) {
      y = ensurePage(doc, y);
      doc.text(line, x + 6, y);
      y += SPACE.lineHeight + 0.8;
    }
    y += 3; // espacement entre paragraphes
  }

  // Ligne subtile doree en bas
  if (opts.signature) {
    y += 4;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(x + 6, y, x + 22, y);
    y += 3;
  }

  return y + 4;
}

// Dessiner un header de section (H1) — style premium
function drawSectionHeader(doc, title, y, margin, opts = {}) {
  const pw = doc.internal.pageSize.getWidth();
  y = ensurePage(doc, y, 22);
  y += SPACE.sectionGap * 0.4;

  // Accent doré à gauche (fine barre verticale)
  doc.setFillColor(...GOLD);
  doc.rect(margin, y - 3, 1.5, 6.5, 'F');

  // Titre en vert
  doc.setFontSize(FONT.h1);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  const maxTitleW = pw - 2 * margin - 6;
  const titleLines = doc.splitTextToSize((title || '').toUpperCase(), maxTitleW);
  let ty = y + 1;
  doc.text(titleLines[0], margin + 5, ty);
  for (let i = 1; i < titleLines.length; i++) {
    ty += 6;
    doc.text(titleLines[i], margin + 5, ty);
  }
  y = ty + 4.5;

  // Ligne fine de separation
  doc.setDrawColor(...SEPARATOR);
  doc.setLineWidth(0.25);
  doc.line(margin, y, pw - margin, y);

  return y + 7;
}

// Dessiner un petit label + valeur (info block) — utile pour profil/strategie
function drawInfoBlock(doc, label, value, x, y, width) {
  if (!value?.trim()) return y;
  doc.setFontSize(FONT.micro);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text(label.toUpperCase(), x, y);
  // V77 : espace label→valeur bumpe de 3.3 → 4.8 pour respirer
  y += 4.8;
  doc.setFontSize(FONT.body);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_TEXT);
  const lines = doc.splitTextToSize(value.trim(), width);
  for (const l of lines) {
    y = ensurePage(doc, y);
    doc.text(l, x, y);
    y += SPACE.lineHeight;
  }
  // V77 : gap entre 2 info blocks bumpe de 3 → 4.5
  y += 4.5;
  return y;
}

// Dessiner une "card" pour un repas (Petit-dejeuner, Dejeuner, etc.)
function drawMealCard(doc, title, content, x, y, width) {
  if (!content?.trim()) return y;
  y = ensurePage(doc, y, 20);

  // Card background subtile
  const padX = 8;
  const padY = 6;
  const contentLines = doc.splitTextToSize(content.trim(), width - padX * 2);
  const h = padY * 2 + 5 + contentLines.length * SPACE.lineHeight;

  doc.setFillColor(...BG_CARD);
  doc.setDrawColor(...SEPARATOR);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, h, 2.5, 2.5, 'FD');

  // Titre (doré, petit)
  doc.setFontSize(FONT.micro);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text((title || '').toUpperCase(), x + padX, y + padY);

  // Contenu
  doc.setFontSize(FONT.body);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_TEXT);
  let cy = y + padY + 5.5;
  for (const l of contentLines) {
    doc.text(l, x + padX, cy);
    cy += SPACE.lineHeight;
  }

  return y + h + SPACE.blockGap * 0.7;
}

// Dessiner une liste a puces propre (avec indentation fine et pas de marker lourd)
function drawBulletList(doc, items, x, y, width, opts = {}) {
  if (!items || !items.length) return y;
  const bulletChar = opts.bullet || '·';
  const indent = SPACE.bulletIndent;
  doc.setFontSize(FONT.body);
  doc.setFont('helvetica', 'normal');

  for (const item of items) {
    const text = typeof item === 'string' ? item : item?.content;
    if (!text?.trim()) continue;
    y = ensurePage(doc, y, 6);
    const lines = doc.splitTextToSize(text.trim(), width - indent - 3);
    doc.setTextColor(...GOLD);
    doc.text(bulletChar, x, y);
    doc.setTextColor(...DARK_TEXT);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) y = ensurePage(doc, y);
      doc.text(lines[i], x + indent, y);
      if (i < lines.length - 1) y += SPACE.lineHeight;
    }
    y += SPACE.lineHeight + 0.5;
  }
  return y + 1;
}

// Parser le contenu d'un supplement et le render en card compacte
function drawSupplementCard(doc, name, fields, x, y, width, locale = 'FR') {
  y = ensurePage(doc, y, 28);
  const padX = 7;
  const padY = 5;

  // Estimer la hauteur approximative
  let estH = padY + 6; // titre
  // V87.1 : TOUS les labels passent par L() pour match strict avec le vocabulaire
  // du prompt. FR = Moment/Dose/Sources/Pourquoi/Duree/Attention.
  // EN = Timing/Dose/Sources/Why/Duration/Caution.
  const rows = [
    { label: L('SUPP_TIMING', locale), val: fields.moment },
    { label: L('SUPP_DOSE', locale), val: fields.dosage },
    { label: L('SUPP_SOURCES', locale), val: fields.sources },
    { label: L('SUPP_WHY', locale), val: fields.justification },
    { label: L('SUPP_DURATION', locale), val: fields.duree },
    { label: L('SUPP_CAUTION', locale), val: fields.interactions },
  ].filter(r => r.val?.trim());

  for (const r of rows) {
    const lines = doc.splitTextToSize(r.val.trim(), width - padX * 2 - 22);
    estH += lines.length * 3.8 + 1.5;
  }
  estH += padY;

  // Card background
  doc.setFillColor(...BG_SOFT);
  doc.roundedRect(x, y, width, estH, 2.5, 2.5, 'F');

  // Accent doré gauche
  doc.setFillColor(...GOLD);
  doc.rect(x, y, 1.5, estH, 'F');

  // Nom du supplement
  doc.setFontSize(FONT.h3);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.text((name || '').toUpperCase(), x + padX, y + padY + 2);

  // Rows
  let cy = y + padY + 8;
  for (const r of rows) {
    doc.setFontSize(FONT.micro);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SOFT_TEXT);
    doc.text(r.label, x + padX, cy);

    doc.setFontSize(FONT.small);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_TEXT);
    const lines = doc.splitTextToSize(r.val.trim(), width - padX * 2 - 22);
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], x + padX + 22, cy);
      if (i < lines.length - 1) cy += 3.8;
    }
    cy += 3.8 + 1.5;
  }

  return y + estH + SPACE.blockGap * 0.8;
}

// Parse un bloc de texte en entrees de supplements structurees
// Formats acceptes :
//   "VITAMINE D3\n— Sources : ...\n— Complement : ...\n— Justification : ..."
//   "VITAMINE D3\nSources : ...\nComplement : ..."
function parseSupplementEntriesStructured(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const entries = [];
  let current = null;

  const isSupplementHeader = (l) => {
    const t = l.trim();
    // Un header : ligne courte, majuscules dominantes, pas de ":" au milieu
    if (!t || t.length > 50) return false;
    if (t.includes(':') && t.indexOf(':') < t.length - 3) return false;
    const upperChars = (t.match(/[A-Z0-9 +\-/()]/g) || []).length;
    return t.length >= 4 && upperChars >= t.length * 0.7;
  };

  const parseField = (l) => {
    // Accepte : "— Sources : xyz" ou "Sources : xyz" ou "• Sources : xyz"
    const m = l.trim().replace(/^[—\-•*·]\s*/, '').match(/^([A-Za-zéè][^:]{0,30}?)\s*:\s*(.+)$/);
    if (!m) return null;
    const rawLabel = m[1].toLowerCase().trim();
    const val = m[2].trim();
    // V87.1 : regex etendues FR + EN (miroir stricte avec nutritionEditorParsers.js)
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

// V66 : render rotation en 2 colonnes (Proteines | Feculents) puis (Legumes | Gras)
// groups = [{ title, items: [] }]
function drawTwoColumnList(doc, groups, x, y, width) {
  if (!groups?.length) return y;
  const colW = (width - 6) / 2;
  for (let i = 0; i < groups.length; i += 2) {
    const left = groups[i];
    const right = groups[i + 1];
    const leftLines = left ? Math.max(2, left.items.length) : 0;
    const rightLines = right ? Math.max(2, right.items.length) : 0;
    const maxLines = Math.max(leftLines, rightLines);
    const cardH = 10 + maxLines * 5 + 4;
    y = ensurePage(doc, y, cardH + 4);
    // Rendu cote gauche
    if (left) drawColGroup(doc, left, x, y, colW);
    if (right) drawColGroup(doc, right, x + colW + 6, y, colW);
    y += cardH + SPACE.blockGap;
  }
  return y;
}
function drawColGroup(doc, group, x, y, width) {
  // Titre colonne
  doc.setFontSize(FONT.h3);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.text(group.title.toUpperCase(), x, y + 4);
  // Trait doré fin
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(x, y + 6, x + width, y + 6);
  // Items
  doc.setFontSize(FONT.body);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_TEXT);
  let ly = y + 11;
  for (const item of group.items) {
    const lines = doc.splitTextToSize(item, width - 2);
    for (const line of lines) {
      doc.text(line, x, ly);
      ly += 5;
    }
  }
}

// V66 : parse une section rotation "Proteines : A / B / C" → groups
function parseRotationGroups(text) {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const groups = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[-–•*·]\s*/, '');
    const m = cleaned.match(/^(Prot[eé]ines?|F[eé]culents?|L[eé]gumes?|Mati[eè]res?\s*grasses?|Lipides?|Gras|Gras?\s*bons?)[^:]{0,30}?\s*:\s*(.+)$/i);
    if (!m) continue;
    const title = m[1].trim();
    const raw = m[2].trim();
    // V71 : Items separes par ", " OU " / " (slash EXIGE des espaces autour)
    // Sinon "1/2 avocat" se fait splitter en "1" + "2 avocat" → bug wrap PDF
    const items = raw.split(/\s*,\s*|\s+\/\s+/).map(s => s.trim()).filter(Boolean);
    if (items.length >= 2) groups.push({ title, items });
  }
  return groups;
}

// V66 : render fiche frigo en bloc compact "À RETENIR"
function drawCompactRulesBlock(doc, items, x, y, width, label = 'À RETENIR') {
  if (!items?.length) return y;
  const lineH = 5.5;
  const padding = 7;
  const bodyH = items.length * lineH + 6;
  const blockH = padding + 6 + bodyH + padding;
  y = ensurePage(doc, y, blockH + 4);
  // Fond carte
  doc.setFillColor(...BG_CARD);
  doc.roundedRect(x, y, width, blockH, 2.5, 2.5, 'F');
  // Border gauche doré (accent)
  doc.setFillColor(...GOLD);
  doc.rect(x, y, 1.8, blockH, 'F');
  // Label
  doc.setFontSize(FONT.small);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text(label, x + padding, y + padding + 2, { charSpace: 1.5 });
  // Items
  doc.setFontSize(FONT.body);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_TEXT);
  let ly = y + padding + 10;
  for (const item of items) {
    const lines = doc.splitTextToSize('• ' + item, width - padding * 2 - 2);
    for (const line of lines) {
      doc.text(line, x + padding, ly);
      ly += lineH;
    }
  }
  return y + blockH + SPACE.blockGap;
}

// V66 : render plan d'action en timeline verticale S1 → S4
function drawTimeline(doc, steps, x, y, width) {
  if (!steps?.length) return y;
  const stepH = 14;
  const totalH = steps.length * stepH + 6;
  y = ensurePage(doc, y, totalH + 4);
  const dotX = x + 3;
  const textX = x + 11;
  // Ligne verticale reliant les dots
  doc.setDrawColor(...GOLD_SOFT);
  doc.setLineWidth(0.6);
  doc.line(dotX, y + 4, dotX, y + stepH * steps.length);
  for (let i = 0; i < steps.length; i++) {
    const cy = y + 4 + i * stepH;
    // Dot doré
    doc.setFillColor(...GOLD);
    doc.circle(dotX, cy, 1.8, 'F');
    // Label semaine en vert
    doc.setFontSize(FONT.h3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREEN);
    doc.text(steps[i].label, textX, cy + 1.2);
    // Texte
    doc.setFontSize(FONT.body);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_TEXT);
    const txt = steps[i].text || '';
    const lines = doc.splitTextToSize(txt, width - 30);
    let ly = cy + 6;
    for (let j = 0; j < lines.length && j < 2; j++) {
      doc.text(lines[j], textX, ly);
      ly += 4.5;
    }
  }
  return y + totalH + SPACE.blockGap;
}

// V66 : parse plan d'action "S1 — texte" → steps
function parseTimelineSteps(text) {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const steps = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[-–•*·]\s*/, '');
    // Match "S1 — texte" ou "Semaine 1 — texte" ou "S1 : texte"
    const m = cleaned.match(/^(S(?:emaine)?\s*\d|S\d)\s*[—\-:]\s*(.+)$/i);
    if (!m) continue;
    const label = m[1].replace(/semaine\s*/i, 'S').toUpperCase().replace(/\s+/g, '');
    steps.push({ label, text: m[2].trim() });
  }
  return steps;
}

// Render un bloc "Tableau horaire des supplements"
function drawScheduleTable(doc, entries, x, y, width) {
  if (!entries?.length) return y;
  y = ensurePage(doc, y, 30);

  doc.setFontSize(FONT.h3);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.text('TABLEAU HORAIRE', x, y);
  y += 6;
  doc.setDrawColor(...SEPARATOR);
  doc.setLineWidth(0.25);
  doc.line(x, y, x + width, y);
  y += 5;

  for (const { moment, supp } of entries) {
    y = ensurePage(doc, y, 6);
    doc.setFontSize(FONT.small);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text(moment, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_TEXT);
    const lines = doc.splitTextToSize(supp, width - 40);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) y += 4;
      doc.text(lines[i], x + 40, y);
    }
    y += SPACE.lineHeight;
  }
  return y + SPACE.blockGap;
}

// Parse une section de texte en paires label/value
function parseLabeledLines(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const pairs = [];
  for (const line of lines) {
    const t = line.trim().replace(/^[—\-•*·]\s*/, '');
    const m = t.match(/^([A-Za-zéèàùûîâôçêŒœ][^:]{2,60}?)\s*:\s*(.+)$/);
    if (m) {
      pairs.push({ label: m[1].trim(), value: m[2].trim() });
    } else if (pairs.length > 0 && t) {
      // Continuation de la derniere pair
      pairs[pairs.length - 1].value += ' ' + t;
    }
  }
  return pairs;
}

// Parse des lignes en items bullet (accepte "- xxx", "— xxx", "• xxx", "1. xxx")
function parseBulletLines(text) {
  if (!text) return [];
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l && /^([—\-•*·]|\d+[\.\)])\s+/.test(l))
    .map(l => l.replace(/^([—\-•*·]|\d+[\.\)])\s+/, '').trim())
    .filter(Boolean);
}

function ensurePage(doc, y, needed = 10) {
  if (y > 272 - needed) {
    doc.addPage();
    doc.setFillColor(...BG_PAGE);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 297, 'F');
    return 20;
  }
  return y;
}

function addHeaderFooter(doc, prenom, pageNum, totalPages, dateStr, locale = 'FR') {
  const pw = doc.internal.pageSize.getWidth();
  const m = 25;

  // ─── Header ───
  doc.setDrawColor(210, 208, 200);
  doc.setLineWidth(0.2);
  doc.line(m, 15, pw - m, 15);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 158, 150);
  doc.text(prenom, m, 12);
  // V86.9 : titre header central localise
  const headerTitle = locale === 'EN' ? 'Personalized nutrition plan' : 'Plan nutrition personnalise';
  doc.text(headerTitle, pw / 2, 12, { align: 'center' });
  doc.text(dateStr || '', pw - m, 12, { align: 'right' });

  // ─── Footer ───
  doc.setDrawColor(210, 208, 200);
  doc.line(m, 281, pw - m, 281);
  doc.setFontSize(7);
  doc.setTextColor(160, 158, 150);
  doc.text(L('FOOTER_BRAND', locale), m, 287);
  doc.text(`${pageNum} / ${totalPages}`, pw / 2, 287, { align: 'center' });
  // V86.9 : footer right localise (FR 'Confidentiel' / EN 'Confidential')
  doc.text(locale === 'EN' ? 'Confidential' : 'Confidentiel', pw - m, 287, { align: 'right' });
}

function addSectionTitle(doc, title, y, margin) {
  y = ensurePage(doc, y, 20);
  y += 4; // extra top margin before section
  doc.setFillColor(...GREEN);
  doc.rect(margin, y - 3.5, 3.5, 5, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  // V55 : wrap long titles to fit page width
  const pw = doc.internal.pageSize.getWidth();
  const maxTitleWidth = pw - margin - (margin + 8) - 2;
  const titleLines = doc.splitTextToSize(title.toUpperCase(), maxTitleWidth);
  const firstLine = titleLines[0];
  doc.text(firstLine, margin + 8, y);
  for (let i = 1; i < titleLines.length; i++) {
    y += 5;
    doc.text(titleLines[i], margin + 8, y);
  }
  y += 4;
  doc.setDrawColor(200, 198, 190);
  doc.setLineWidth(0.25);
  doc.line(margin, y, pw - margin, y);
  return y + 10;
}

function addBody(doc, text, x, y, maxWidth) {
  if (!text) return y;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_TEXT);
  const lines = doc.splitTextToSize(cleanMarkdown(text), maxWidth);
  for (const line of lines) {
    y = ensurePage(doc, y);
    doc.text(line, x, y);
    y += 4.2;
  }
  return y;
}

function renderTokens(doc, tokens, x, y, maxWidth) {
  const pw = doc.internal.pageSize.getWidth();
  const margin = x;

  for (const tok of tokens) {
    switch (tok.type) {
      case 'space':
        y += 4;
        break;

      case 'noteblock': {
        y = ensurePage(doc, y, 18);
        y += 2;
        const noteW = maxWidth - 6;
        const noteText = cleanMarkdown(tok.content);
        const noteLines = doc.splitTextToSize(noteText, noteW - 18);
        const noteH = Math.max(18, noteLines.length * 4.5 + 12);
        // Background
        doc.setFillColor(238, 250, 242);
        doc.roundedRect(margin + 3, y - 4, noteW, noteH, 2, 2, 'F');
        // Green left accent
        doc.setFillColor(74, 222, 128);
        doc.rect(margin + 3, y - 4, 2.5, noteH, 'F');
        // Text
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 100, 60);
        let ny = y + 2;
        for (const nl of noteLines) {
          doc.text(nl, margin + 12, ny);
          ny += 4.5;
        }
        doc.setTextColor(...DARK_TEXT);
        y += noteH + 6;
        break;
      }

      case 'alertblock': {
        y = ensurePage(doc, y, 18);
        y += 2;
        const alertW = maxWidth - 6;
        const alertText = cleanMarkdown(tok.content);
        const alertLines = doc.splitTextToSize(alertText, alertW - 18);
        const alertH = Math.max(18, alertLines.length * 4.5 + 12);
        // Background
        doc.setFillColor(253, 240, 240);
        doc.roundedRect(margin + 3, y - 4, alertW, alertH, 2, 2, 'F');
        // Red left accent
        doc.setFillColor(248, 113, 113);
        doc.rect(margin + 3, y - 4, 2.5, alertH, 'F');
        // Text
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 60, 60);
        let ay = y + 2;
        for (const al of alertLines) {
          doc.text(al, margin + 12, ay);
          ay += 4.5;
        }
        doc.setTextColor(...DARK_TEXT);
        y += alertH + 6;
        break;
      }

      case 'week':
        doc.addPage();
        y = 20;
        doc.setFillColor(247, 249, 247);
        doc.rect(margin - 2, y - 5, maxWidth + 4, 11, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GREEN);
        doc.text(tok.content, margin + 2, y + 1);
        y += 16;
        break;

      case 'section':
        y = ensurePage(doc, y, 18);
        y += 8;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GREEN);
        doc.text(tok.content, margin, y);
        y += 4;
        doc.setDrawColor(200, 198, 190);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pw - margin, y);
        y += 8;
        break;

      case 'title':
        y = ensurePage(doc, y, 14);
        y += 5;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GREEN);
        const titleLines = doc.splitTextToSize(tok.content, maxWidth);
        for (const tl of titleLines) {
          y = ensurePage(doc, y);
          doc.text(tl, margin, y);
          y += 5;
        }
        y += 3;
        break;

      case 'day':
        y = ensurePage(doc, y, 12);
        y += 8;
        doc.setFillColor(240, 238, 232);
        doc.rect(margin - 1, y - 4.5, maxWidth + 2, 8, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GREEN);
        doc.text(tok.content, margin + 3, y);
        y += 10;
        break;

      case 'meal':
        y = ensurePage(doc, y, 14);
        y += 6;
        doc.setFontSize(10.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GREEN);
        doc.text(tok.content, margin + 2, y);
        y += 2.5;
        doc.setDrawColor(...GREEN);
        doc.setLineWidth(0.5);
        doc.line(margin + 2, y, margin + 28, y);
        y += 6;
        break;

      case 'subtitle':
        y = ensurePage(doc, y, 8);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bolditalic');
        doc.setTextColor(85, 85, 85);
        doc.text(tok.content, margin + 5, y);
        y += 5;
        break;

      case 'macro':
        y = ensurePage(doc, y);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...GREY_TEXT);
        const macroLines = doc.splitTextToSize(tok.content, maxWidth - 5);
        for (const ml of macroLines) {
          y = ensurePage(doc, y);
          doc.text(ml, margin + 5, y);
          y += 3.5;
        }
        y += 1;
        break;

      case 'bullet':
        y = ensurePage(doc, y, 6);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        if (hasFormattingMarkers(tok.content)) {
          const prefix = '—  ';
          doc.setTextColor(...DARK_TEXT);
          doc.text(prefix, margin + 6, y);
          const bx = margin + 6 + doc.getTextWidth(prefix);
          if (hasSizeMarkers(tok.content)) {
            renderSizedLine(doc, tok.content, bx, y, DARK_TEXT);
          } else if (hasHighlightMarkers(tok.content)) {
            renderHighlightedLine(doc, tok.content, bx, y, maxWidth - 12, DARK_TEXT);
          } else {
            renderColoredLine(doc, parseColorSegments(tok.content), bx, y, DARK_TEXT);
          }
          y += 4.8;
        } else {
          doc.setTextColor(...DARK_TEXT);
          const bulletLines = doc.splitTextToSize(tok.content, maxWidth - 12);
          bulletLines.forEach((bl, i) => {
            y = ensurePage(doc, y);
            doc.text(i === 0 ? '—  ' + bl : '     ' + bl, margin + 6, y);
            y += 4.5;
          });
          y += 0.5;
        }
        break;

      case 'text':
      default:
        y = ensurePage(doc, y);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        if (hasFormattingMarkers(tok.content)) {
          if (hasSizeMarkers(tok.content)) {
            renderSizedLine(doc, tok.content, margin, y, DARK_TEXT);
          } else if (hasHighlightMarkers(tok.content)) {
            renderHighlightedLine(doc, tok.content, margin, y, maxWidth, DARK_TEXT);
          } else {
            renderColoredLine(doc, parseColorSegments(tok.content), margin, y, DARK_TEXT);
          }
          y += 4.2;
        } else {
          doc.setTextColor(...DARK_TEXT);
          const textLines = doc.splitTextToSize(tok.content, maxWidth);
          for (const tl of textLines) {
            y = ensurePage(doc, y);
            doc.text(tl, margin, y);
            y += 4.2;
          }
        }
        break;
    }
  }
  return y;
}


// ─────────────────────────────────────────────────────
// INTELLIGENT PLAN SPLITTER — categorizes AI output into client-facing sections
// ─────────────────────────────────────────────────────

const SKIP_SECTIONS = /analyse\s+du\s+profil|besoins?\s+calorique|r[eé]partition\s+macro|profil\s+client|notes?\s+pour\s+le\s+coach|observations?\s+nutritionn|bilans?\s+effectu|mifflin|macro.?nutri/i;
const INTRO_SECTIONS = /principes?\s+nutritionn|approche|introduction|en\s+quelques\s+mots/i;
const WEEK_SECTIONS = /semaine\s+\d/i;
const SHOPPING_SECTIONS = /liste\s+de\s+courses/i;
const SUPPLEMENT_SECTIONS = /suppl[eé]ments?|compl[eé]ments?|recommandations?\s+compl[eé]mentaires?|alternatives?\s+naturelles?/i;
const ADVICE_SECTIONS = /conseils?\s+pratiques?|au\s+quotidien|timing|hydratation\s+quotid|meal\s+prep/i;
const RECIPE_SECTIONS = /recettes?/i;

function splitPlanIntoClientSections(planText, supplementsText, recipesText) {
  const result = { intro: '', weeks: [], shopping: [], supplements: '', advice: '', recipes: '' };
  if (!planText) return result;

  const lines = planText.split('\n');
  let currentCategory = 'unknown';
  let currentContent = [];
  let currentWeekTitle = '';
  let currentShoppingTitle = '';
  function flush() {
    const text = currentContent.join('\n').trim();
    if (!text) { currentContent = []; return; }

    if (currentCategory === 'skip') { /* discard */ }
    else if (currentCategory === 'intro') { result.intro += (result.intro ? '\n\n' : '') + text; }
    else if (currentCategory === 'week') { result.weeks.push({ title: currentWeekTitle, content: text }); }
    else if (currentCategory === 'shopping') {
      const title = currentShoppingTitle || currentWeekTitle || `LISTE DE COURSES ${result.shopping.length + 1}`;
      result.shopping.push({ title, content: text });
    }
    else if (currentCategory === 'supplements') { result.supplements += (result.supplements ? '\n\n' : '') + text; }
    else if (currentCategory === 'advice') { result.advice += (result.advice ? '\n\n' : '') + text; }
    else if (currentCategory === 'recipes') { result.recipes += (result.recipes ? '\n\n' : '') + text; }
    else if (currentCategory === 'menu') {
      if (result.weeks.length === 0) result.weeks.push({ title: 'PLAN ALIMENTAIRE', content: text });
      else result.weeks[result.weeks.length - 1].content += '\n\n' + text;
    }
    currentContent = [];
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const headerMatch = trimmed.match(/^#{1,6}\s+(.+)/);
    const isNumbered = /^\d+\.\s+[A-Z]/.test(trimmed) && trimmed.length < 80;
    const boldHeader = /^\*\*(.+)\*\*$/.test(trimmed);
    const cleanHeader = cleanMarkdown(headerMatch ? headerMatch[1] : (boldHeader ? trimmed.replace(/\*\*/g, '') : trimmed));
    const isAllCaps = cleanHeader === cleanHeader.toUpperCase() && cleanHeader.length > 3 && cleanHeader.length < 60 && /[A-Z]{3,}/.test(cleanHeader);
    const isHeader = headerMatch || isNumbered || (isAllCaps && !/^[-–•]/.test(trimmed));

    if (isHeader) {
      flush();
      const h = cleanHeader;
      if (SKIP_SECTIONS.test(h)) { currentCategory = 'skip'; }
      else if (WEEK_SECTIONS.test(h) && !SHOPPING_SECTIONS.test(h)) { currentCategory = 'week'; currentWeekTitle = h.toUpperCase(); }
      else if (SHOPPING_SECTIONS.test(h)) { currentCategory = 'shopping'; currentShoppingTitle = h.toUpperCase(); }
      else if (SUPPLEMENT_SECTIONS.test(h)) { currentCategory = 'supplements'; }
      else if (ADVICE_SECTIONS.test(h)) { currentCategory = 'advice'; }
      else if (RECIPE_SECTIONS.test(h)) { currentCategory = 'recipes'; }
      else if (INTRO_SECTIONS.test(h)) { currentCategory = 'intro'; }
      else if (/plan\s+alimentaire|menus?|repas/i.test(h)) { currentCategory = 'menu'; }
      else if (/ajustement|entra[iî]nement|workout|repos/i.test(h)) { currentCategory = 'advice'; }
      else { currentCategory = 'unknown'; }
      // Don't add the header line itself to content — we use our own titles
    } else {
      currentContent.push(rawLine);
    }
  }
  flush();

  // V64 : si suppText dedie existe (version standardisee/pratique),
  // on l'utilise SEUL et on jette la version narrative extraite du plan
  // (evite le doublon narrative + standardisee dans le PDF client)
  if (supplementsText?.trim()) {
    result.supplements = supplementsText.trim();
  }
  if (recipesText?.trim()) {
    result.recipes += (result.recipes ? '\n\n' : '') + recipesText.trim();
  }

  return result;
}


// ─────────────────────────────────────────────────────
// PDF 1: PLAN NUTRITION PREMIUM (client-facing)
// ─────────────────────────────────────────────────────

export async function exportConsultationPDF(consultation, client) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 25;
  const cw = pw - margin * 2;
  const form = client?.form || {};
  const prenom = form.prenom || 'Client';
  // V86.9 : locale derivee du client (Benfitcoach EN ou FR par defaut).
  // Utilisee pour localiser la cover, le footer, les cards supplement,
  // les labels 'A RETENIR' / 'VARIANTE' / 'LE MOT D\'ANISSA' / etc.
  const locale = resolveLocale(client);
  const dateStr = formatDateFR(consultation.date, locale);
  const objectif = form.objectifPrincipalNutrition || form.objectifSport || '';

  // Use pre-computed sections from structurePlanSections (same as preview) if available,
  // otherwise fall back to splitPlanIntoClientSections for backward compatibility
  const unifiedSections = consultation.sections || null;

  // Legacy fallback — only used when sections are not pre-computed
  const legacySections = unifiedSections ? null : splitPlanIntoClientSections(
    consultation.nutritionPlan, consultation.supplements, consultation.recipes
  );

  // V77 : chargement du logo Anissa (canvas re-encode pour compat jsPDF)
  // Silent fallback si indisponible — pas de blocage PDF.
  const loadCoverLogo = (url) => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve({ data: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  let coverLogo = null;
  try { coverLogo = await loadCoverLogo('/logo-anissa.png'); } catch { coverLogo = null; }

  // Cover page supprimee — generee separement via exportCoverPDF
  // Le contenu demarre directement sur la page 1
  doc.setFillColor(...BG_PAGE);
  doc.rect(0, 0, pw, 297, 'F');
  let isFirstPage = true;
  let y = 20;

  // ─── PROGRESSION (for followup consultations) ───
  if (consultation.isFollowup && consultation.followupData) {
    const fd = consultation.followupData;
    isFirstPage = false;
    y = 20;
    y = addSectionTitle(doc, 'Votre Progression', y, margin);

    // Measures comparison table
    const prevPoids = fd._prevPoids || form.poids || null;
    const prevTourTaille = fd._prevTourTaille || form.tourTaille || null;
    const prevTourHanche = fd._prevTourHanche || form.tourHanche || null;
    const prevTourBras = fd._prevTourBras || form.tourBras || null;
    const prevTourCuisse = fd._prevTourCuisse || form.tourCuisse || null;
    const prevMasseGrasse = fd._prevMasseGrasse || form.masseGrasse || null;

    const measureRows = [
      { label: 'Poids', prev: prevPoids, curr: fd.poids_actuel, unit: 'kg' },
      { label: 'Tour de taille', prev: prevTourTaille, curr: fd.tour_taille, unit: 'cm' },
      { label: 'Tour de hanche', prev: prevTourHanche, curr: fd.tour_hanche, unit: 'cm' },
      { label: 'Tour de bras', prev: prevTourBras, curr: fd.tour_bras, unit: 'cm' },
      { label: 'Tour de cuisse', prev: prevTourCuisse, curr: fd.tour_cuisse, unit: 'cm' },
      { label: 'Masse grasse', prev: prevMasseGrasse, curr: fd.masse_grasse, unit: '%' },
    ].filter(r => r.prev || r.curr);

    if (measureRows.length > 0) {
      // Table header
      const colW = [50, 35, 35, 40];
      const startX = margin;
      doc.setFillColor(26, 46, 31);
      doc.rect(startX, y - 3, cw, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Mesure', startX + 3, y + 2);
      doc.text('Avant', startX + colW[0] + 3, y + 2);
      doc.text("Aujourd'hui", startX + colW[0] + colW[1] + 3, y + 2);
      doc.text('Evolution', startX + colW[0] + colW[1] + colW[2] + 3, y + 2);
      y += 9;

      for (const row of measureRows) {
        const prev = row.prev ? Number(row.prev) : null;
        const curr = row.curr ? Number(row.curr) : null;
        let diffText = '-';
        let isImproved = false;
        let isDegraded = false;
        if (prev && curr) {
          const diff = curr - prev;
          const sign = diff > 0 ? '+' : '';
          diffText = `${sign}${diff.toFixed(1)} ${row.unit}`;
          isImproved = diff < 0;
          isDegraded = diff > 0;
        }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DARK_TEXT);
        doc.text(row.label, startX + 3, y);
        doc.text(prev ? `${prev} ${row.unit}` : '-', startX + colW[0] + 3, y);
        doc.text(curr ? `${curr} ${row.unit}` : '-', startX + colW[0] + colW[1] + 3, y);

        if (isImproved) doc.setTextColor(74, 222, 128);
        else if (isDegraded) doc.setTextColor(248, 113, 113);
        else doc.setTextColor(251, 191, 36);
        doc.setFont('helvetica', 'bold');
        doc.text(diffText, startX + colW[0] + colW[1] + colW[2] + 3, y);

        y += 6;
        doc.setDrawColor(...SEPARATOR);
        doc.setLineWidth(0.15);
        doc.line(startX, y - 2, startX + cw, y - 2);
      }
      y += 6;
    }

    // Evolution ressentie
    const evolItems = [
      { label: 'Energie', value: fd.energie },
      { label: 'Sommeil', value: fd.sommeil },
      { label: 'Digestion', value: fd.digestion },
      { label: 'Stress', value: fd.stress },
      { label: 'Douleurs', value: fd.douleurs },
    ].filter(e => e.value);

    if (evolItems.length > 0) {
      y = ensurePage(doc, y, 20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GREEN);
      doc.text('EVOLUTION RESSENTIE', margin, y);
      y += 8;

      for (const item of evolItems) {
        y = ensurePage(doc, y);
        const isGood = item.value === 'Nettement ameliore' || item.value === 'Legerement ameliore';
        const isBad = item.value === 'Degrade';
        const arrow = isGood ? '  ↑' : isBad ? '  ↓' : '  →';

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK_TEXT);
        doc.text(`${item.label} :`, margin + 3, y);
        if (isGood) doc.setTextColor(74, 222, 128);
        else if (isBad) doc.setTextColor(248, 113, 113);
        else doc.setTextColor(251, 191, 36);
        doc.setFont('helvetica', 'normal');
        doc.text(`${item.value}${arrow}`, margin + 38, y);
        y += 5.5;
      }
      y += 6;
    }

    // Adherence
    if (fd.adherence_plan) {
      y = ensurePage(doc, y, 15);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GREEN);
      doc.text('ADHERENCE AU PLAN PRECEDENT', margin, y);
      y += 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK_TEXT);
      doc.text(`Suivi du plan : ${fd.adherence_plan}`, margin + 3, y);
      y += 5;
      if (fd.supplements_pris) {
        doc.text(`Supplements : ${fd.supplements_pris}`, margin + 3, y);
        y += 5;
      }
    }
  }

  // ─── PLAN SECTIONS ───
  console.log('[PDF RENDER] unifiedSections:', unifiedSections?.length, unifiedSections?.map(s => ({ t: s.title, type: s.type, len: s.content?.length })));
  if (unifiedSections) {
    // Helper: find section by type
    const findSec = (type) => unifiedSections.find(s => s.type === type);

    // V56 : renderSec avec dispatch selon type de section
    const renderSec = (sec) => {
      if (!sec?.content?.trim()) return;
      // V67 : reset charSpace AVANT chaque section pour eviter leak des labels precedents
      // (intro "LE MOT D'ANISSA" charSpace=2, VARIANTE charSpace=1.5, etc.)
      if (typeof doc.setCharSpace === 'function') doc.setCharSpace(0);
      const sectionType = detectSectionType(sec.title);

      // V59 : intro/closing = style lettre manuscrite, pas de header lourd
      if (sectionType === 'intro' || sectionType === 'closing') {
        // Petit label discret en haut (pas un gros header)
        doc.setFontSize(FONT.micro);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GOLD);
        const labelText = sectionType === 'intro' ? L('INTRO_LABEL', locale) : L('CLOSING_LABEL', locale);
        doc.text(labelText, margin + 6, y + 4, { charSpace: 2 });
        y += 9;
        y = drawLetterBlock(doc, sec.content, margin, y, cw, {
          italic: sectionType === 'intro',
          signature: sectionType === 'closing',
        });
        y += SPACE.blockGap;
        return;
      }

      // Header premium (remplace addSectionTitle)
      y = drawSectionHeader(doc, sec.title, y, margin);

      // Dispatch selon type
      switch (sectionType) {
        case 'profile':
        case 'strategy': {
          // Rendu en info blocks (label + value)
          const pairs = parseLabeledLines(sec.content);
          if (pairs.length >= 2) {
            for (const p of pairs) {
              y = drawInfoBlock(doc, p.label, p.value, margin, y, cw);
            }
          } else {
            // Fallback : parser standard
            const tokens = parseNutritionPlan(sec.content);
            y = renderTokens(doc, tokens, margin, y, cw);
          }
          break;
        }

        case 'meals':
        case 'meals_alt': {
          // V66 : label discret "VARIANTE" pour journee alternative
          // V77 : bumped gap de 2 → 5 pour que "VARIANTE" respire au-dessus des repas
          if (sectionType === 'meals_alt') {
            doc.setFontSize(FONT.micro);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...GOLD);
            doc.text(L('VARIANT', locale), margin, y - 2, { charSpace: 1.5 });
            y += 5;
            // V77 : reset charSpace pour eviter le leak sur la card repas suivante
            if (typeof doc.setCharSpace === 'function') doc.setCharSpace(0);
          }
          // Rendu en cartes repas
          const pairs = parseLabeledLines(sec.content);
          const mealPairs = pairs.filter(p => /petit[- ]?dej|dejeuner|diner|collation|goute|snack/i.test(p.label));
          if (mealPairs.length >= 2) {
            for (const p of mealPairs) {
              y = drawMealCard(doc, p.label, p.value, margin, y, cw);
            }
            // Rendre le reste eventuel
            const rest = pairs.filter(p => !mealPairs.includes(p));
            for (const r of rest) {
              y = drawInfoBlock(doc, r.label, r.value, margin, y, cw);
            }
          } else {
            const tokens = parseNutritionPlan(sec.content);
            y = renderTokens(doc, tokens, margin, y, cw);
          }
          break;
        }

        case 'rotation': {
          // V66 : 2 colonnes (Prot | Fec puis Leg | Gras)
          const groups = parseRotationGroups(sec.content);
          if (groups.length >= 2) {
            y = drawTwoColumnList(doc, groups, margin, y, cw);
            // Rendre le reste (ex: exemples substitutions) en bullets
            const restLines = sec.content.split('\n')
              .filter(l => !/^(Prot[eé]ines?|F[eé]culents?|L[eé]gumes?|Mati[eè]res?\s*grasses?|Lipides?|Gras)/i.test(l.trim()))
              .join('\n');
            const bullets = parseBulletLines(restLines);
            if (bullets.length >= 1) {
              y = drawBulletList(doc, bullets, margin + 2, y, cw - 2);
            }
          } else {
            const tokens = parseNutritionPlan(sec.content);
            y = renderTokens(doc, tokens, margin, y, cw);
          }
          break;
        }

        case 'fridge': {
          // V66 : bloc compact "À RETENIR"
          const bullets = parseBulletLines(sec.content);
          if (bullets.length >= 2) {
            y = drawCompactRulesBlock(doc, bullets, margin, y, cw, L('REMEMBER', locale));
          } else {
            const tokens = parseNutritionPlan(sec.content);
            y = renderTokens(doc, tokens, margin, y, cw);
          }
          break;
        }

        case 'action': {
          // V66 : timeline S1 → S4 si detection possible
          const steps = parseTimelineSteps(sec.content);
          if (steps.length >= 2) {
            y = drawTimeline(doc, steps, margin + 2, y, cw - 2);
          } else {
            // Fallback : bullets classiques
            const bullets = parseBulletLines(sec.content);
            if (bullets.length >= 2) {
              y = drawBulletList(doc, bullets, margin + 2, y, cw - 2);
            } else {
              const tokens = parseNutritionPlan(sec.content);
              y = renderTokens(doc, tokens, margin, y, cw);
            }
          }
          break;
        }

        case 'food_yes':
        case 'food_limit':
        case 'food_no': {
          // Rendu en liste a puces propre (contenu souvent "aliment1, aliment2, ...")
          const content = sec.content.trim();
          // Si c'est une liste de mots separes par virgules → bullets
          if (/,/.test(content) && !content.includes('\n\n')) {
            const items = content
              .replace(/\n/g, ', ')
              .split(/,\s*/)
              .map(s => s.trim())
              .filter(Boolean);
            y = drawBulletList(doc, items, margin + 2, y, cw - 2);
          } else {
            const bullets = parseBulletLines(content);
            if (bullets.length >= 2) {
              y = drawBulletList(doc, bullets, margin + 2, y, cw - 2);
            } else {
              const tokens = parseNutritionPlan(sec.content);
              y = renderTokens(doc, tokens, margin, y, cw);
            }
          }
          break;
        }

        case 'protocol':
        case 'adjustments':
        case 'coach': {
          // Rendu en bullets propres si possible
          const bullets = parseBulletLines(sec.content);
          if (bullets.length >= 2) {
            y = drawBulletList(doc, bullets, margin + 2, y, cw - 2);
          } else {
            // Mix labels + bullets : utiliser parser standard
            const tokens = parseNutritionPlan(sec.content);
            y = renderTokens(doc, tokens, margin, y, cw);
          }
          break;
        }

        case 'supplements': {
          // Rendu en mini-cards supplement
          const entries = parseSupplementEntriesStructured(sec.content);
          if (entries.length >= 2) {
            for (const entry of entries) {
              y = drawSupplementCard(doc, entry.name, entry.fields, margin, y, cw, locale);
            }
          } else {
            const tokens = parseNutritionPlan(sec.content);
            y = renderTokens(doc, tokens, margin, y, cw);
          }
          break;
        }

        default: {
          // Rendu standard
          const tokens = parseNutritionPlan(sec.content);
          y = renderTokens(doc, tokens, margin, y, cw);
          break;
        }
      }
      y += SPACE.blockGap;
    };
    const newPage = () => {
      doc.addPage();
      doc.setFillColor(...BG_PAGE);
      doc.rect(0, 0, pw, 297, 'F');
      // V63 : RESET charSpace a chaque nouvelle page pour eviter le leak du cover
      // (charSpace: 2.5 de "PLAN NUTRITIONNEL" leake sinon sur les pages suivantes)
      if (typeof doc.setCharSpace === 'function') doc.setCharSpace(0);
      y = 22;
    };

    // ── COVER — Premium layout V56 ──
    // V73 fix : si une progression a ete dessinee en page 1 (followup), passer a une nouvelle page
    // avant de dessiner la cover, sinon les deux se superposent.
    {
      if (!isFirstPage) newPage();
      isFirstPage = false;
      // Ligne doree fine tout en haut (accent subtil de marque)
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.5);
      doc.line(pw / 2 - 20, 35, pw / 2 + 20, 35);

      // Surtitre discret en doré
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GOLD);
      doc.text(L('COVER_TITLE', locale), pw / 2, 42, { align: 'center', charSpace: 2.5 });

      // Titre principal - grand et élégant
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GREEN);
      doc.text(L('COVER_SUBTITLE', locale), pw / 2, 60, { align: 'center' });

      // Ligne fine de séparation
      doc.setDrawColor(...SEPARATOR);
      doc.setLineWidth(0.3);
      doc.line(pw / 2 - 14, 70, pw / 2 + 14, 70);

      // Prénom du client - grand, centré, respirant
      doc.setFontSize(18);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK_TEXT);
      const prenomFormate = (prenom || '').charAt(0).toUpperCase() + (prenom || '').slice(1).toLowerCase();
      doc.text(prenomFormate, pw / 2, 92, { align: 'center' });

      // Objectif principal dans un cadre doux
      if (objectif) {
        const objY = 108;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GOLD);
        doc.text('OBJECTIF', pw / 2, objY, { align: 'center', charSpace: 1.5 });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...SOFT_TEXT);
        const wrappedObj = doc.splitTextToSize(objectif, 130);
        for (let i = 0; i < Math.min(wrappedObj.length, 3); i++) {
          doc.text(wrappedObj[i], pw / 2, objY + 6 + i * 5, { align: 'center' });
        }
      }

      // Date — discrète
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED_TEXT);
      doc.text(dateStr || '', pw / 2, 148, { align: 'center' });

      // V77 : Logo Anissa dans l'espace vide entre date et signature
      if (coverLogo) {
        const logoH = 40; // hauteur en mm
        const logoW = logoH * (coverLogo.w / coverLogo.h);
        const logoX = (pw - logoW) / 2;
        const logoY = 170; // espace entre date (148) et signature (230)
        try {
          doc.addImage(coverLogo.data, 'PNG', logoX, logoY, logoW, logoH);
        } catch (e) { /* silent fail */ }
      }

      // Bloc signataire — en bas, premium
      const sigY = 230;
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.4);
      doc.line(pw / 2 - 18, sigY, pw / 2 + 18, sigY);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GREEN);
      doc.text('Anissa Deroubaix Nutrition', pw / 2, sigY + 8, { align: 'center' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GREY_TEXT);
      doc.text('Nutritionniste spécialisée en longévité et génétique', pw / 2, sigY + 14, { align: 'center' });

      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED_TEXT);
      doc.text('AB Coaching Sarl  ·  Rue de Rive 28  ·  1260 Nyon', pw / 2, sigY + 20, { align: 'center' });

      // Mention confidentielle en bas de page (discret)
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED_TEXT);
      doc.text(L('CONFIDENTIAL', locale), pw / 2, 282, { align: 'center', charSpace: 1 });

      // V63 : RESET charSpace apres cover pour eviter le leak sur pages suivantes
      if (typeof doc.setCharSpace === 'function') doc.setCharSpace(0);
    }

    // ── RENDER ALL SECTIONS LINEARLY — V56 pagination smart ──
    // V87 : GARDE ANTI-DUPLICATION supplements (defense en profondeur).
    // Meme si structurePlanSections a deja dedupe, on re-verifie ici que
    // le render loop n'emettra JAMAIS plus d'un bloc 'supplements' dans le PDF.
    // Permet de se proteger contre d'eventuels doublons injectes ailleurs
    // (ex: modification manuelle du tableau sections, legacy path, etc.)
    let supplementsRendered = false;
    newPage();
    for (let i = 0; i < unifiedSections.length; i++) {
      const sec = unifiedSections[i];
      if (!sec?.content?.trim()) continue;
      if (sec.type === 'supplements') {
        if (supplementsRendered) continue; // skip doublon
        supplementsRendered = true;
      }

      // V56 : logique anti-orphan - estimer si le titre + 2 lignes min tient
      // Si on est deja tres bas (y > 240) et qu'il reste plus de 2 lignes a ecrire, nouvelle page
      // V75 : types a bloc "tall" (card frigo, cards supplement, timeline) sous-estimees
      // avec la formule generique → bumper a 85mm pour garantir que le header n'est pas orphelin
      const tallBlockTypes = ['fridge', 'supplements', 'action'];
      const contentLines = (sec.content || '').split('\n').filter(l => l.trim()).length;
      const needsSpace = tallBlockTypes.includes(sec.type)
        ? 85
        : 25 + Math.min(contentLines * 4, 40);
      if (i > 0 && y + needsSpace > 275) newPage();

      renderSec(sec);
    }
  } else {
    // Legacy path: splitPlanIntoClientSections (backward compatibility)
    const sections = legacySections;

    if (sections.intro) {
      if (isFirstPage) { isFirstPage = false; } else { doc.addPage(); }
      y = 20;
      y = addSectionTitle(doc, 'Votre Plan En Quelques Mots', y, margin);
      y = addBody(doc, sections.intro, margin, y, cw);
      y += 12;
    }

    for (const week of sections.weeks) {
      if (isFirstPage) { isFirstPage = false; } else { doc.addPage(); }
      y = 20;
      doc.setFillColor(247, 249, 247);
      doc.rect(margin - 2, y - 5, cw + 4, 11, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GREEN);
      doc.text(week.title, margin + 2, y + 1);
      y += 16;
      const tokens = parseNutritionPlan(week.content);
      y = renderTokens(doc, tokens, margin, y, cw);
    }

    if (sections.shopping && sections.shopping.length > 0) {
      doc.addPage();
      y = 20;
      y = addSectionTitle(doc, 'Vos Listes De Courses', y, margin);
      y += 4;
      for (const list of sections.shopping) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFillColor(247, 249, 247);
        doc.rect(margin - 2, y - 5, cw + 4, 10, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GREEN);
        doc.text(list.title, margin + 2, y + 1);
        y += 14;
        const tokens = parseNutritionPlan(list.content);
        y = renderTokens(doc, tokens, margin, y, cw);
        y += 6;
      }
    }

    if (sections.supplements) {
      if (y > 180) { doc.addPage(); y = 20; }
      y = addSectionTitle(doc, 'Recommandations Complementaires', y, margin);
      const tokens = parseNutritionPlan(sections.supplements);
      y = renderTokens(doc, tokens, margin, y, cw);
      y += 8;
    }

    if (sections.recipes) {
      if (y > 200) { doc.addPage(); y = 20; }
      y = addSectionTitle(doc, 'Recettes Recommandees', y, margin);
      const tokens = parseNutritionPlan(sections.recipes);
      y = renderTokens(doc, tokens, margin, y, cw);
      y += 8;
    }

    if (sections.advice) {
      if (y > 200) { doc.addPage(); y = 20; }
      y = addSectionTitle(doc, 'Vos Conseils Au Quotidien', y, margin);
      const tokens = parseNutritionPlan(sections.advice);
      y = renderTokens(doc, tokens, margin, y, cw);
    }
  }

  // ─── CLOSING PAGE ───
  doc.addPage();
  doc.setFillColor(...BG_PAGE);
  doc.rect(0, 0, pw, 297, 'F');

  y = 100;
  // Decorative line
  doc.setDrawColor(200, 198, 190);
  doc.setLineWidth(0.3);
  doc.line(pw / 2 - 30, y, pw / 2 + 30, y);
  y += 14;

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_TEXT);
  const closingLines = [
    L('FOOTER_CLOSING_LINE_1', locale),
    L('FOOTER_CLOSING_LINE_2', locale),
    L('FOOTER_CLOSING_LINE_3', locale),
  ];
  for (const cl of closingLines) {
    doc.text(cl, pw / 2, y, { align: 'center' });
    y += 5.5;
  }

  y += 6;
  doc.setFontSize(9.5);
  doc.setTextColor(...GREY_TEXT);
  doc.text(L('FOOTER_RECOMMENDED_LINE_1', locale), pw / 2, y, { align: 'center' });
  y += 5;
  doc.text(L('FOOTER_RECOMMENDED_LINE_2', locale), pw / 2, y, { align: 'center' });

  y += 20;
  doc.setDrawColor(200, 198, 190);
  doc.line(pw / 2 - 30, y, pw / 2 + 30, y);

  y += 14;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.text(L('FOOTER_BRAND', locale), pw / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GREY_TEXT);
  doc.text(L('FOOTER_ADDRESS', locale), pw / 2, y, { align: 'center' });
  y += 12;
  doc.setFontSize(7.5);
  doc.text(L('CONFIDENTIAL', locale), pw / 2, y, { align: 'center' });

  // ─── HEADERS & FOOTERS (all pages except cover and closing) ───
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 2; i < totalPages; i++) {
    doc.setPage(i);
    addHeaderFooter(doc, prenom, i - 1, totalPages - 2, dateStr, locale);
  }

  const fileName = `plan-nutrition-${prenom.toLowerCase()}-${dateStr.replace(/\./g, '-')}.pdf`;
  doc.save(fileName);
}


// ─────────────────────────────────────────────────────
// MEAL EXTRACTION for Fiche Frigo
// ─────────────────────────────────────────────────────

export function extractMeals(planText) {
  const empty = { breakfast: [], lunch: [], dinner: [], snack: '', hydration: '', toFavor: [], toLimit: [] };
  if (!planText) return empty;

  // Normalize text: strip markdown
  const text = planText
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/__([^_]+)__/g, '$1');

  // Split into lines
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Find meal blocks by scanning line by line
  // V75 : 2 fixes majeurs
  //   1. regex ancree au DEBUT de la ligne + suivi de ":" / "(" / fin
  //      → evite que "Pas de diner apres 19h30" (regle fiche frigo) matche comme header
  //   2. extraction inline du contenu apres ":" sur la meme ligne
  //      → supporte le format "Diner : 100g poisson..." en plus du format multi-ligne
  //   3. stop SYSTEMATIQUE sur tout header de section (pas seulement meals), meme si
  //      le block est vide → evite de polluer avec des lignes fiche frigo/protocoles
  function findMealBlocks(mealPatterns) {
    const results = [];
    const regex = new RegExp(
      '^(?:[-–—•*]\\s*)?(?:' + mealPatterns.join('|') + ')\\s*(?:\\(|:|$)',
      'i'
    );
    const inlineRegex = new RegExp(
      '^(?:[-–—•*]\\s*)?(?:' + mealPatterns.join('|') + ')[^:]*:\\s*(.+)$',
      'i'
    );
    const stopSectionPattern = /^(?:petit[- ]?d[eé]jeuner|d[eé]jeuner|d[iî]ner|collation|go[uû]ter|snack|semaine\s+\d|liste\s+de\s+courses|supplements?|notes\s+pour|fiche\s*frigo|[àa]\s*retenir|protocoles?|ajustements|recommandations|plan\s*d['’]?action|strat[eé]gie|analyse|journ[eé]e\s*type|rotation|exclusions|cl[oô]ture|introduction)\b/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!regex.test(line)) continue;

      const block = [];

      // V75 : inline content — format "Meal : content" (Claire's case)
      const inlineMatch = line.match(inlineRegex);
      if (inlineMatch && inlineMatch[1].trim().length > 3) {
        block.push(inlineMatch[1].trim());
      }

      // V75 : gather next lines only if no inline content (multi-line format)
      if (block.length === 0) {
        for (let j = i + 1; j < lines.length && block.length < 5; j++) {
          const next = lines[j];
          // V75 : stop on ANY section header — not gated on block.length > 0
          if (stopSectionPattern.test(next)) break;
          if (/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i.test(next)) break;
          if (/^\d+\.\s+[A-Z]/.test(next)) break;
          const cleaned = next.replace(/^[-–•*]\s*/, '').trim();
          if (cleaned.length > 3) block.push(cleaned);
        }
      }

      if (block.length > 0) {
        const combined = block.slice(0, 4).join('\n');
        if (!results.includes(combined)) results.push(combined);
      }
      if (results.length >= 3) break;
    }
    return results;
  }

  const breakfast = findMealBlocks([
    'petit[- ]?d[eé]jeuner', 'PETIT[- ]?DEJEUNER', 'Petit[- ]?D[eé]jeuner',
  ]);
  const lunch = findMealBlocks([
    '(?<!petit[- ]?)d[eé]jeuner(?!\\s*\\()', '(?<!PETIT[- ]?)DEJEUNER(?!\\s*\\()', '(?<!Petit[- ]?)D[eé]jeuner(?!\\s*\\()',
  ]);
  const dinner = findMealBlocks([
    'd[iî]ner', 'DINER', 'D[iî]ner', 'DINNER',
  ]);

  // Snack
  let snack = '';
  for (const line of lines) {
    if (/collation|go[uû]ter|snack/i.test(line)) {
      const cleaned = line.replace(/^.*(?:collation|go[uû]ter|snack)[:\s]*/i, '').replace(/^[-–•*]\s*/, '').trim();
      if (cleaned.length > 3 && cleaned.length < 100) { snack = cleaned; break; }
      // Check next line
      const idx = lines.indexOf(line);
      if (idx < lines.length - 1) {
        const next = lines[idx + 1].replace(/^[-–•*]\s*/, '').trim();
        if (next.length > 3 && next.length < 100) { snack = next; break; }
      }
    }
  }

  // Hydration
  let hydration = '';
  for (const line of lines) {
    if (/hydratation|eau\s*(par|quotid|recommand|:)/i.test(line)) {
      const match = line.match(/(\d[\d.,]*\s*(?:l(?:itres?)?|ml|verres?))/i);
      if (match) { hydration = match[0]; break; }
      hydration = line.replace(/^.*(?:hydratation|eau)[:\s]*/i, '').trim().substring(0, 50);
      break;
    }
  }

  // ── Clean food extraction: pull only plain food names ──
  const toFavor = extractFoodList(lines, text, 'favor');
  const toLimit = extractFoodList(lines, text, 'limit');

  return { breakfast, lunch, dinner, snack, hydration, toFavor, toLimit };
}

// ── Food name extraction helpers ──

// Words that indicate a line is NOT a simple food name
const NON_FOOD_RE = /(?:kcal|kilocal|calories?|g\s*\/\s*jour|g\/j|mg\b|mcg\b|µg|\bui\b|\d+\s*%|pourcentage|protocol|protocole|phase|approche|principe|r[eé]gime|methylation|m[ée]tabolisme|sensibilit[eé]|pathologie|micronutri|macronutri|lipides?\s*:|proteines?\s*:|glucides?\s*:|hydratation|objectif|ratio|\d+\s*g\b|\d+\s*-\s*\d+|jour\s+d[''\s]entra)/i;

// Common French food words (used as a safelist to detect food lines)
const FOOD_WORDS_RE = /\b(?:saumon|sardines?|maquereau|thon|truite|poisson|cabillaud|crevettes?|moules?|huitres?|poulet|dinde|boeuf|veau|agneau|porc|lapin|foie|oeufs?|jambon|tofu|tempeh|seitan|legumineuses?|lentilles?|pois|haricots?|quinoa|riz|sarrasin|avoine|flocons?|millet|epautre|boulgour|pates?|pain|patate|courge|potimarron|butternut|patate\s*douce|epinards?|brocoli|chou|kale|asperges?|artichauts?|aubergine|courgette|tomate|poivron|carotte|radis|navet|betterave|celeri|fenouil|concombre|salade|laitue|roquette|mache|endive|champignon|oignon|ail|poireau|avocat|olive|huile|vinaigre|citron|pamplemousse|orange|pomme|poire|banane|kiwi|fraise|framboise|myrtille|mure|cerise|peche|abricot|raisin|figue|datte|ananas|mangue|papaye|grenade|cassis|noix|noisette|amande|pistache|cajou|pecan|noix\s*du\s*bresil|graines?|courge|tournesol|lin|chia|sesame|chanvre|yaourt|fromage|kefir|cottage|ricotta|feta|mozzarella|parmesan|miso|kimchi|choucroute|kombucha|cacao|chocolat\s*noir|matcha|the|tisane|curcuma|gingembre|persil|basilic|coriandre|menthe|romarin|thym|cannelle|muscade|poivre|spiruline|chlorella|algues?|wakame|nori|levure\s*nutritionnelle|bouillon|miel)\b/i;

// Known bad-foods regex (things to limit)
const BAD_FOOD_WORDS_RE = /\b(?:sucre|sirop|glucose|fructose|edulcorant|aspartame|produits?\s*(?:ultra[-\s]?)?transform[eé]s?|ultra[-\s]?transform|plats?\s*(?:pr[eé]par[eé]s?|industriels?)|fast[-\s]?food|junk|charcuterie|saucisse|bacon|lard|nuggets|viandes?\s*transform|gluten|ble|farine\s*blanche|pain\s*blanc|pates?\s*blanches|riz\s*blanc|laitages?|lait\s*de\s*vache|fromages?\s*industriels?|beurre|margarine|huile\s*de\s*palme|huile\s*de\s*tournesol|huile\s*de\s*mais|friture|alcool|vin|biere|soda|jus\s*de\s*fruits?|boissons?\s*sucr[eé]es?|energy\s*drinks?|cafe(?!ine)|cafeine|the\s*noir|chocolat\s*au\s*lait|viennoiseries?|patisseries?|gateaux|biscuits?|bonbons|chips|crackers|cereales?\s*industrielles?|soja|produits?\s*laitiers?|conservateurs?|additifs?|colorants?|pesticides?|ogm|aliments?\s*frits?)\b/i;

// Strip markdown, bullets, labels, macros from a line
function cleanFoodLine(raw) {
  if (!raw) return '';
  let s = raw.trim();
  // Strip leading bullet/dash chars
  s = s.replace(/^[-–—•*▪●◦]+\s*/, '');
  // Strip double dashes (— —)
  s = s.replace(/[-–—]\s*[-–—]/g, ' ');
  // Strip markdown
  s = s.replace(/\*\*|__|`|^#+\s*/g, '');
  // Strip category label at start ("Lipides :", "Proteines:", "Points d'attention :", etc.)
  s = s.replace(/^(?:lipides?|prot[eé]ines?|glucides?|fibres?|macros?|micros?|points?\s*d['']attention|exemples?|sources?|astuces?|conseils?|principes?|objectifs?|r[eé]partition|ratio)[\s:—-]+/i, '');
  // Strip inline macros/dosages in parens or after
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/\d+[-–]\d+\s*(?:g|mg|mcg|%|kcal|ui)/gi, '');
  s = s.replace(/\d+[\d.,]*\s*(?:g|mg|mcg|%|kcal|ui)/gi, '');
  s = s.replace(/\s+/g, ' ');
  // Strip trailing colons / punctuation
  s = s.replace(/[\s:;,.]+$/, '').trim();
  return s;
}

// Split a cleaned line into multiple foods (split on commas, slashes, "et")
function splitFoods(line) {
  if (!line) return [];
  return line
    .split(/,|;|\/|\s+et\s+|\s+ou\s+|\s{2,}/i)
    .map(s => s.trim())
    .filter(Boolean);
}

function isLikelyFood(candidate, mode) {
  if (!candidate) return false;
  const s = candidate.trim();
  if (s.length < 3 || s.length > 50) return false;
  if (NON_FOOD_RE.test(s)) return false;
  // Must not be all uppercase header-like
  if (/^[A-ZÀ-Ÿ\s]{6,}$/.test(s)) return false;
  // Must not start with a digit
  if (/^\d/.test(s)) return false;
  // Must contain at least one food word (either good or bad depending on mode)
  if (mode === 'favor' && FOOD_WORDS_RE.test(s)) return true;
  if (mode === 'limit' && (BAD_FOOD_WORDS_RE.test(s) || FOOD_WORDS_RE.test(s))) return true;
  // Otherwise reject: too risky to include arbitrary text
  return false;
}

function extractFoodList(lines, fullText, mode) {
  // Find the header index for the target section
  const headerRe = mode === 'favor'
    ? /(?:a\s+privil[eé]gier|privil[eé]gier|aliments?\s+prioritaires?|aliments?\s+recommand[eé]s?|aliments?\s+cl[eé]s?|a\s+favoriser|sources?\s+(?:naturelles?|prioritaires?))/i
    : /(?:a\s+limiter|a\s+[eé]viter|aliments?\s+a\s+[eé]viter|aliments?\s+a\s+limiter|[aà]\s+r[eé]duire|[aà]\s+supprimer|a\s+[eé]liminer)/i;

  // Stop when we hit a new big section
  const stopRe = mode === 'favor'
    ? /(?:a\s+limiter|a\s+[eé]viter|supplements|supplementation|notes?\s+pour|notes?\s+coach|semaine\s+\d|recettes|conseils\s+pratiques|tableau\s+horaire|plan\s+alimentaire|structure)/i
    : /(?:supplements|supplementation|notes?\s+pour|notes?\s+coach|semaine\s+\d|recettes|conseils\s+pratiques|tableau\s+horaire|a\s+privil[eé]gier|plan\s+alimentaire|structure|principes?\s+nutrition)/i;

  const found = new Set();
  const collected = [];

  // Scan all header occurrences in the text (there may be multiple, e.g. in different sections)
  for (let i = 0; i < lines.length; i++) {
    if (!headerRe.test(lines[i])) continue;
    for (let j = i + 1; j < lines.length && collected.length < 30; j++) {
      const line = lines[j];
      if (!line) continue;
      if (stopRe.test(line)) break;
      // Inline header like "A privilegier : saumon, brocoli, ..."
      // Handle it by looking at content after a colon
      const afterColon = line.indexOf(':') >= 0 ? line.slice(line.indexOf(':') + 1) : line;
      const cleaned = cleanFoodLine(afterColon);
      if (!cleaned) continue;
      const chunks = splitFoods(cleaned);
      for (const c of chunks) {
        const key = c.toLowerCase();
        if (found.has(key)) continue;
        if (isLikelyFood(c, mode)) {
          found.add(key);
          collected.push(c);
        }
      }
      if (collected.length >= 20) break;
    }
    if (collected.length >= 8) break;
  }

  // Fallback for "favor" mode: harvest food words from the meal descriptions
  if (mode === 'favor' && collected.length < 6) {
    for (const line of lines) {
      const cleaned = cleanFoodLine(line);
      if (!cleaned || cleaned.length > 120) continue;
      if (NON_FOOD_RE.test(cleaned)) continue;
      // Extract all food words from the line via global regex
      const matches = cleaned.match(new RegExp(FOOD_WORDS_RE.source, 'gi'));
      if (!matches) continue;
      for (const m of matches) {
        const key = m.toLowerCase();
        if (found.has(key)) continue;
        if (collected.length >= 15) break;
        found.add(key);
        collected.push(m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
      }
      if (collected.length >= 15) break;
    }
  }

  // Fallback for "limit" mode: scan for common bad-food words in the plan
  if (mode === 'limit' && collected.length < 4) {
    const matches = fullText.match(new RegExp(BAD_FOOD_WORDS_RE.source, 'gi'));
    if (matches) {
      for (const m of matches) {
        const key = m.toLowerCase();
        if (found.has(key)) continue;
        if (collected.length >= 10) break;
        found.add(key);
        collected.push(m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
      }
    }
  }

  // Cap at reasonable sizes
  return mode === 'favor' ? collected.slice(0, 15) : collected.slice(0, 10);
}


// ─────────────────────────────────────────────────────
// STRUCTURED FRIDGE DATA from plan sections
// ─────────────────────────────────────────────────────

/**
 * Extract fridge data from structured sections (from structurePlanSections / parsePlanToSections).
 * Looks for FICHE FRIGO section first, then falls back to SEMAINE 1 / REGLES.
 * Returns null if no usable data found (caller should fall back to regex).
 */
export function extractFridgeDataFromSections(sections) {
  if (!sections || sections.length === 0) return null;

  // Find the fiche frigo section
  const frigoSection = sections.find(s =>
    /fiche\s*frigo/i.test(s.title)
  );

  if (frigoSection && frigoSection.content?.trim()) {
    const data = parseFridgeContent(frigoSection.content);
    if (data) return data;
  }

  // Fallback: try SEMAINE 1 for meal data + other sections for lists
  const week1 = sections.find(s => /semaine\s*1/i.test(s.title));
  const regles = sections.find(s => /r[eè]gles?\s*(?:simples?|cl[eé]s?)?/i.test(s.title));
  if (!week1 && !regles) return null;

  const result = { breakfast: [], lunch: [], dinner: [], snack: '', hydration: '', toFavor: [], toLimit: [] };

  if (week1) {
    const meals = extractMealsFromContent(week1.content);
    Object.assign(result, meals);
  }

  if (regles) {
    const hydMatch = regles.content.match(/(?:hydratation|eau)[^.\n]*?(\d[\d.,]*\s*(?:l(?:itres?)?|ml))/i);
    if (hydMatch) result.hydration = hydMatch[1];
  }

  // Look for privilegier/limiter in any section
  for (const sec of sections) {
    if (!result.toFavor.length) {
      const favor = extractListFromContent(sec.content, 'favor');
      if (favor.length) result.toFavor = favor;
    }
    if (!result.toLimit.length) {
      const limit = extractListFromContent(sec.content, 'limit');
      if (limit.length) result.toLimit = limit;
    }
  }

  const hasData = result.breakfast.length || result.lunch.length || result.dinner.length;
  return hasData ? result : null;
}

function parseFridgeContent(content) {
  const lines = content.split('\n');
  const result = { breakfast: [], lunch: [], dinner: [], snack: '', hydration: '', toFavor: [], toLimit: [] };

  let currentField = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect sub-headers
    const cleaned = line.replace(/\*\*/g, '').replace(/^#{1,4}\s*/, '').replace(/^[-–•*]\s*/, '').trim();
    const upper = cleaned.toUpperCase();

    if (/petit[- ]?d[eé]jeuner/i.test(cleaned)) { currentField = 'breakfast'; continue; }
    if (/(?<!petit[- ]?)d[eé]jeuner/i.test(cleaned) && !/petit/i.test(cleaned)) { currentField = 'lunch'; continue; }
    if (/d[iî]ner/i.test(cleaned)) { currentField = 'dinner'; continue; }
    if (/collation|go[uû]ter|snack/i.test(cleaned)) { currentField = 'snack'; continue; }
    if (/a\s+privil[eé]gier|aliments?\s+recommand/i.test(cleaned)) { currentField = 'toFavor'; continue; }
    if (/a\s+limiter|a\s+[eé]viter/i.test(cleaned)) { currentField = 'toLimit'; continue; }
    if (/hydratation/i.test(cleaned)) { currentField = 'hydration'; continue; }

    if (!currentField) continue;

    // Extract bullet content
    const bullet = line.replace(/^[-–•*\d.)\s]+/, '').trim();
    if (!bullet || bullet.length < 3) continue;

    switch (currentField) {
      case 'breakfast': result.breakfast.push(bullet); break;
      case 'lunch': result.lunch.push(bullet); break;
      case 'dinner': result.dinner.push(bullet); break;
      case 'snack':
        result.snack = result.snack ? result.snack + '\n' + bullet : bullet;
        break;
      case 'toFavor': result.toFavor.push(...bullet.split(/,\s*/).filter(s => s.length > 2)); break;
      case 'toLimit': result.toLimit.push(...bullet.split(/,\s*/).filter(s => s.length > 2)); break;
      case 'hydration':
        if (!result.hydration) result.hydration = bullet;
        break;
    }
  }

  const hasData = result.breakfast.length || result.lunch.length || result.dinner.length;
  return hasData ? result : null;
}

function extractMealsFromContent(content) {
  const result = { breakfast: [], lunch: [], dinner: [], snack: '' };
  const lines = content.split('\n');
  let currentMeal = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const cleaned = line.replace(/\*\*/g, '').replace(/^#{1,4}\s*/, '').trim();

    if (/petit[- ]?d[eé]jeuner/i.test(cleaned)) { currentMeal = 'breakfast'; continue; }
    if (/(?<!petit[- ]?)d[eé]jeuner/i.test(cleaned) && !/petit/i.test(cleaned)) { currentMeal = 'lunch'; continue; }
    if (/d[iî]ner/i.test(cleaned)) { currentMeal = 'dinner'; continue; }
    if (/collation|go[uû]ter|snack/i.test(cleaned)) { currentMeal = 'snack'; continue; }
    if (/semaine|section|jour\s*(type|repos|entra)/i.test(cleaned)) { currentMeal = null; continue; }

    if (!currentMeal) continue;
    const bullet = line.replace(/^[-–•*\d.)\s]+/, '').trim();
    if (!bullet || bullet.length < 3) continue;

    if (currentMeal === 'snack') {
      if (!result.snack) result.snack = bullet;
    } else if (result[currentMeal].length < 4) {
      result[currentMeal].push(bullet);
    }
  }

  return result;
}

function extractListFromContent(content, mode) {
  const headerRe = mode === 'favor'
    ? /a\s+privil[eé]gier|aliments?\s+recommand/i
    : /a\s+limiter|a\s+[eé]viter/i;
  const stopRe = mode === 'favor'
    ? /a\s+limiter|a\s+[eé]viter|supplements|collation|hydratation/i
    : /a\s+privil[eé]gier|supplements|collation|hydratation/i;

  const lines = content.split('\n');
  const items = [];
  let collecting = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (headerRe.test(line)) { collecting = true; continue; }
    if (collecting && stopRe.test(line)) break;
    if (!collecting) continue;

    const bullet = line.replace(/^[-–•*\d.)\s]+/, '').trim();
    if (bullet.length > 2) {
      items.push(...bullet.split(/,\s*/).filter(s => s.length > 2));
    }
    if (items.length >= 15) break;
  }

  return items;
}


// ─────────────────────────────────────────────────────
// SUPPLEMENT EXTRACTION for Fiche Frigo
// ─────────────────────────────────────────────────────

// Dosage pattern: captures 30mg, 2000 UI, 500 mcg, 10 milliards UFC, 2g, 1 gel., etc.
const DOSAGE_RE = /\d+[\d.,]*\s*(?:mg|mcg|µg|ui|g\b|milliards?\s*ufc|milliards?|gelules?|g[eé]l\.?|comprim[eé]s?|capsules?|gouttes?|ml)/i;

// Library of known supplement names to their default moment
const SUPPLEMENT_MOMENT_MAP = [
  { re: /\b(fer|iron|bisglycinate\s+de\s+fer)\b/i, moment: 'morningFasting' },
  { re: /\b(probiotiques?|lactobacill|bifidobact)\b/i, moment: 'morningFasting' },
  { re: /\b(l[-\s]?glutamine|glutamine)\b/i, moment: 'morningFasting' },
  { re: /\b(nac|n[-\s]?ac[eé]tyl)\b/i, moment: 'morningFasting' },

  { re: /\b(vitamine\s*d3?|cholecalciferol)\b/i, moment: 'breakfast' },
  { re: /\b(vitamine\s*k2|menaquinone|mk[-\s]?7)\b/i, moment: 'breakfast' },
  { re: /\b(complexe\s*b|vitamine?s?\s*b[-\s]?complex)\b/i, moment: 'breakfast' },
  { re: /\b(vitamine\s*b12|methylcobalamine|cobalamine)\b/i, moment: 'breakfast' },
  { re: /\b(folates?|b9|methylfolate|acide\s+folique)\b/i, moment: 'breakfast' },
  { re: /\b(selenium|sel[eé]nium)\b/i, moment: 'breakfast' },
  { re: /\b(iode|iodine)\b/i, moment: 'breakfast' },
  { re: /\b(coq10|co[-\s]?enzyme\s*q10|ubiquinol)\b/i, moment: 'breakfast' },
  { re: /\b(rhodiola)\b/i, moment: 'breakfast' },
  { re: /\b(resveratrol|resv[eé]ratrol)\b/i, moment: 'breakfast' },
  { re: /\b(collag[eè]ne|collagen)\b/i, moment: 'breakfast' },

  { re: /\b(om[eé]ga[-\s]?3|epa|dha|huile\s*de\s*poisson)\b/i, moment: 'lunch' },
  { re: /\b(curcuma|curcumine?|turmeric)\b/i, moment: 'lunch' },
  { re: /\b(chrome|chromium)\b/i, moment: 'lunch' },
  { re: /\b(gla|huile\s*d['’]?onagre|bourrache)\b/i, moment: 'lunch' },
  { re: /\b(enzymes?\s*digestives?|bromelaine|papaine)\b/i, moment: 'lunch' },

  { re: /\b(zinc)\b/i, moment: 'dinner' },
  { re: /\b(calcium)\b/i, moment: 'dinner' },

  { re: /\b(magn[eé]sium|magnesium|bisglycinate\s+de\s+magn)\b/i, moment: 'bedtime' },
  { re: /\b(ashwagandha|withania)\b/i, moment: 'bedtime' },
  { re: /\b(m[eé]latonine|melatonin)\b/i, moment: 'bedtime' },
  { re: /\b(l[-\s]?th[eé]anine|theanine)\b/i, moment: 'bedtime' },
  { re: /\b(psyllium)\b/i, moment: 'bedtime' },
];

function detectMomentFromName(name) {
  for (const { re, moment } of SUPPLEMENT_MOMENT_MAP) {
    if (re.test(name)) return moment;
  }
  return null;
}

// Parse a single "entry" string that may contain multiple supplements
// and returns [{ name, dosage }]
function parseSupplementEntries(text) {
  if (!text) return [];
  const results = [];
  // Split on commas or "+" or "et" between dosage-containing fragments
  // Strategy: find each "Name ... <dosage>" chunk
  const cleaned = text
    .replace(/\([^)]*\)/g, '')     // remove parenthetical notes (brands, etc.)
    .replace(/\s+/g, ' ')
    .trim();

  // Regex that captures a name preceding a dosage
  // Name = sequence of letters/accents/spaces/dashes until a dosage
  const re = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s\-']{1,40}?)\s*(\d+[\d.,]*\s*(?:mg|mcg|µg|UI|ui|g\b|milliards?\s*(?:UFC|ufc)?|g[eé]l\.?|gelules?|comprim[eé]s?|capsules?|gouttes?|ml))/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    let name = m[1].trim();
    // Clean up leading separators/articles
    name = name.replace(/^(?:[-–—•*,]|\s|et\b|ou\b|le\b|la\b|l[''])+/gi, '').trim();
    // Strip trailing "à" / "a" / "au" / "de" / "avec"
    name = name.replace(/\s+(?:a|à|au|de|avec|pour|en|par)$/i, '').trim();
    if (name.length < 2) continue;
    const dosage = m[2].trim().replace(/\s+/g, ' ');
    // Format: "Name dosage"
    results.push({ name, dosage, full: `${name} ${dosage}` });
  }
  return results;
}

export function extractSupplements(supplementsText) {
  const empty = {
    morningFasting: [],
    breakfast: [],
    lunch: [],
    dinner: [],
    bedtime: [],
  };
  if (!supplementsText || !supplementsText.trim()) return empty;

  const text = supplementsText
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/__([^_]+)__/g, '$1');

  const lines = text.split('\n').map(l => l.trim());

  // Strategy 1: look for the "TABLEAU HORAIRE" block and parse its 5 lines
  const result = { ...empty, morningFasting: [], breakfast: [], lunch: [], dinner: [], bedtime: [] };
  let tableauStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/tableau\s+horaire/i.test(lines[i])) {
      tableauStart = i;
      break;
    }
  }

  const bucketPatterns = [
    { key: 'morningFasting', re: /matin\s*[àa]?\s*jeun/i },
    { key: 'breakfast',      re: /(matin|petit[- ]?d[eé]jeuner)/i },
    { key: 'lunch',          re: /midi|d[eé]jeuner|lunch/i },
    { key: 'dinner',         re: /soir(?!\s*\/?\s*coucher)|d[iî]ner|diner|dinner/i },
    { key: 'bedtime',        re: /coucher|bedtime|nuit/i },
  ];

  if (tableauStart >= 0) {
    // Parse the lines after the header
    for (let i = tableauStart + 1; i < lines.length && i < tableauStart + 15; i++) {
      const raw = lines[i];
      if (!raw) continue;
      // Each line like "- MATIN A JEUN : Fer 30mg + Vitamine C 500mg"
      const cleaned = raw.replace(/^[-–•*]\s*/, '').trim();
      // Split label : content
      const colon = cleaned.indexOf(':');
      if (colon <= 0) continue;
      const label = cleaned.slice(0, colon);
      const content = cleaned.slice(colon + 1).trim();
      if (!content || /^aucun|^rien|^[-–—]?$/i.test(content)) continue;

      // Determine bucket — prefer "matin a jeun" then "matin" then others
      let key = null;
      if (bucketPatterns[0].re.test(label)) key = 'morningFasting';
      else if (/petit[- ]?d[eé]jeuner|avec\s+petit[- ]?d[eé]j|matin/i.test(label)) key = 'breakfast';
      else if (bucketPatterns[2].re.test(label)) key = 'lunch';
      else if (/soir|d[iî]ner/i.test(label)) key = 'dinner';
      else if (bucketPatterns[4].re.test(label)) key = 'bedtime';

      if (!key) continue;
      const entries = parseSupplementEntries(content);
      if (entries.length > 0) {
        result[key].push(...entries.map(e => e.full));
      } else {
        // Fallback: push raw content if it looks meaningful
        if (content.length > 2 && content.length < 200) result[key].push(content);
      }
    }
  }

  // Strategy 2 (fallback or supplement): scan the whole text for supplements and auto-assign by name
  const allEntries = parseSupplementEntries(text);
  const seen = new Set();
  for (const arr of Object.values(result)) arr.forEach(s => seen.add(s.toLowerCase()));

  for (const { name, dosage, full } of allEntries) {
    const key = detectMomentFromName(name);
    if (!key) continue;
    if (seen.has(full.toLowerCase())) continue;
    // Avoid duplicates within the same bucket
    const alreadyInBucket = result[key].some(x => x.toLowerCase().includes(name.toLowerCase()));
    if (alreadyInBucket) continue;
    result[key].push(full);
    seen.add(full.toLowerCase());
  }

  return result;
}


// ─────────────────────────────────────────────────────
// PDF 2: FICHE FRIGO
// ─────────────────────────────────────────────────────

export async function exportFicheFrigoPDF(consultation, client, editedMeals) {
  if (!consultation.nutritionPlan) {
    alert('Generez d\'abord le plan nutrition avant d\'exporter la fiche frigo.');
    return;
  }

  // ─── Premium Anissa Deroubaix design ───
  // Palette : crème chaud + vert très foncé + vert pâle + rose pâle
  const CREAM = [245, 242, 236];      // #F5F2EC fond
  const DARK_GREEN = [26, 46, 31];    // #1A2E1F titres/footer
  const SAGE_GREEN = [184, 193, 175]; // #B8C1AF fond bloc compléments
  const FAVOR_BG = [232, 244, 232];   // #E8F4E8 "à privilégier"
  const LIMIT_BG = [253, 240, 240];   // #FDF0F0 "à limiter"
  const LIMIT_TITLE = [139, 32, 32];  // #8B2020 titre "à limiter"
  const BORDER = [212, 208, 200];     // #D4D0C8 bordures fines

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pw = doc.internal.pageSize.getWidth();   // 297
  const ph = doc.internal.pageSize.getHeight();  // 210
  const margin = 10;
  const radius = 4; // coins arrondis 4px
  const form = client?.form || {};
  const dateStr = formatDateFR(consultation.date);
  const meals = editedMeals || extractMeals(consultation.nutritionPlan);
  const supplementsData = (editedMeals && editedMeals.supplements)
    || extractSupplements(consultation.supplements || '');
  const noContent = 'Generez un plan nutrition plus detaille';

  // ─── Fond crème plein ───
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, pw, ph, 'F');

  // ══════════════════════════════════════════════════════════════
  //  GRILLE — constantes de base (colH est calculé dynamiquement plus bas)
  // ══════════════════════════════════════════════════════════════
  const headerH    = 28;
  const footerY    = ph - 22;                         // 188, toujours collé en bas
  const footerH    = 12;                              // bandeau 12mm
  const colTop     = headerH + 8;                     // 36

  // ══════════════════════════════════════════════════════════════
  //  HEADER : logo gauche + titre centré + date droite
  // ══════════════════════════════════════════════════════════════
  const yLogo = margin;

  // Titre vertically centered with logo (logo center Y = yLogo + 11)
  const titleCenterY = yLogo + 11;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...DARK_GREEN);
  doc.setCharSpace(0);
  doc.text(
    `FICHE NUTRITION  —  ${(form.prenom || 'CLIENT').toUpperCase()}`,
    pw / 2,
    titleCenterY + 2,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...DARK_GREEN);
  doc.text(dateStr, pw - margin, titleCenterY + 2, { align: 'right' });

  // Séparation sous le header (à headerH + 2)
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, headerH + 2, pw - margin, headerH + 2);

  // ══════════════════════════════════════════════════════════════
  //  3 COLONNES REPAS — hauteur dynamique partagée
  //  Calcul: on mesure la hauteur naturelle de chaque colonne,
  //  puis on prend le max pour que les 3 cartes soient alignées.
  // ══════════════════════════════════════════════════════════════
  const colGap = 6;
  const colWidth = (pw - margin * 2 - colGap * 2) / 3;

  const cols = [
    { title: 'PETIT-DEJEUNER', items: meals.breakfast },
    { title: 'DEJEUNER', items: meals.lunch },
    { title: 'DINER', items: meals.dinner },
  ];

  const bandH = 10;
  const contentPad = 5;
  const linesPerOption = 6; // plafond de lignes par option

  // Mesure la hauteur requise pour rendre une colonne (doit rester
  // en phase avec le forEach de rendu ci-dessous : mêmes incréments)
  const measureColHeight = (items) => {
    const contentW = colWidth - contentPad * 2;
    let h = bandH + 4;   // bandeau titre + gap avant contenu
    h += 2;              // cy démarre à contentTop + 2
    const maxOptions = Math.min(items?.length || 0, 3);
    if (maxOptions === 0) {
      h += 14;           // placeholder "empty"
    } else {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      for (let i = 0; i < maxOptions; i++) {
        if (i > 0) h += 2.5;                        // séparateur
        h += 4;                                     // "Option N"
        const lines = doc.splitTextToSize(items[i], contentW);
        const take = Math.min(lines.length, linesPerOption);
        h += take * 3.5;
        h += 1.5;                                   // trailing gap
      }
    }
    h += 4;              // marge basse dans la carte
    return h;
  };

  const colH       = Math.max(...cols.map(c => measureColHeight(c.items)));
  const suppTop    = colTop + colH + 4;
  // Bloc MES COMPLÉMENTS — toujours rendu (sert de zone d'écriture si vide)
  const suppBandH  = 9;              // bandeau titre vert foncé
  const suppBodyH  = 20;             // zone sage green (sub-headers + lignes)
  const suppH      = suppBandH + suppBodyH;
  const sectionTop = suppTop + suppH + 4;
  // sectionH calculé dynamiquement plus bas, après les constantes BTM_*

  cols.forEach((col, idx) => {
    const cx = margin + idx * (colWidth + colGap);

    // Carte blanche, bordure fine, coins 4px
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cx, colTop, colWidth, colH, radius, radius, 'FD');

    // Bandeau titre vert foncé plein
    doc.setFillColor(...DARK_GREEN);
    doc.roundedRect(cx, colTop, colWidth, bandH, radius, radius, 'F');
    // Masque pour carrer les coins bas du bandeau
    doc.rect(cx, colTop + bandH - radius, colWidth, radius, 'F');

    // Titre centré horizontalement dans la colonne : x = cx + colWidth/2
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setCharSpace(0);
    doc.text(col.title, cx + colWidth / 2, colTop + 6.8, { align: 'center' });

    // Zone contenu dans la carte
    const contentX = cx + contentPad;
    const contentW = colWidth - contentPad * 2;
    const contentTop = colTop + bandH + 4;
    const contentBottom = colTop + colH - 4;
    let cy = contentTop + 2;

    const maxOptions = Math.min(col.items.length, 3);

    if (col.items.length > 0) {
      for (let i = 0; i < maxOptions; i++) {
        if (cy > contentBottom - 6) break;

        if (i > 0) {
          doc.setDrawColor(...BORDER);
          doc.setLineWidth(0.2);
          doc.line(contentX, cy - 1, contentX + contentW, cy - 1);
          cy += 2.5;
        }

        doc.setFont('helvetica', 'bolditalic');
        doc.setFontSize(8);
        doc.setTextColor(...DARK_GREEN);
        doc.text(`Option ${i + 1}`, contentX, cy);
        cy += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...DARK_TEXT);
        const itemLines = doc.splitTextToSize(col.items[i], contentW);
        const take = Math.min(itemLines.length, linesPerOption);
        for (let j = 0; j < take; j++) {
          if (cy > contentBottom - 2) break;
          doc.text(itemLines[j], contentX, cy);
          cy += 3.5;
        }
        cy += 1.5;
      }
    } else {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...GREY_TEXT);
      doc.text(noContent, cx + colWidth / 2, colTop + colH / 2, { align: 'center' });
    }
  });

  // ══════════════════════════════════════════════════════════════
  //  MES COMPLÉMENTS — bloc pleine largeur, 5 colonnes horaires
  // ══════════════════════════════════════════════════════════════
  const suppWidth = pw - margin * 2;
  const suppSlots = [
    { label: 'MATIN À JEUN',   key: 'morningFasting' },
    { label: 'PETIT-DÉJEUNER', key: 'breakfast' },
    { label: 'MIDI',           key: 'lunch' },
    { label: 'SOIR',           key: 'dinner' },
    { label: 'COUCHER',        key: 'bedtime' },
  ];
  const suppColW = suppWidth / suppSlots.length;

  // Carte de fond : sage green, coins arrondis
  doc.setFillColor(...SAGE_GREEN);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, suppTop, suppWidth, suppH, radius, radius, 'FD');

  // Bandeau titre vert foncé plein (même style que les colonnes repas)
  doc.setFillColor(...DARK_GREEN);
  doc.roundedRect(margin, suppTop, suppWidth, suppBandH, radius, radius, 'F');
  // Carrer les coins bas du bandeau
  doc.rect(margin, suppTop + suppBandH - radius, suppWidth, radius, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.setCharSpace(0);
  doc.text('MES COMPLÉMENTS', margin + suppWidth / 2, suppTop + 6.3, { align: 'center' });

  // Sous-entêtes (libellés horaires) + contenu par cellule
  const subHeaderH  = 5;
  const subLineY    = suppTop + suppBandH + subHeaderH + 0.5;
  const bodyContentTop    = suppTop + suppBandH + subHeaderH + 1.5;
  const bodyContentBottom = suppTop + suppH - 2;

  suppSlots.forEach((slot, i) => {
    const sx = margin + i * suppColW;

    // Séparateur vertical entre cellules (sauf avant la première)
    if (i > 0) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(sx, suppTop + suppBandH + 1, sx, suppTop + suppH - 1);
    }

    // Libellé horaire (sous-entête) en DARK_GREEN sur sage green
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...DARK_GREEN);
    doc.setCharSpace(0);
    doc.text(slot.label, sx + suppColW / 2, suppTop + suppBandH + 3.6, { align: 'center' });

    // Trait fin sous les sous-entêtes, pleine largeur de la cellule
    doc.setDrawColor(...DARK_GREEN);
    doc.setLineWidth(0.15);
    doc.line(sx + 2, subLineY, sx + suppColW - 2, subLineY);

    // Contenu
    const items = supplementsData[slot.key] || [];
    const cellPadX = 3;
    const cellW = suppColW - cellPadX * 2;
    const lineH = 3.2;

    if (items.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...DARK_TEXT);
      let cy = bodyContentTop + 2;
      for (const item of items) {
        const lines = doc.splitTextToSize(String(item), cellW);
        for (const ln of lines) {
          if (cy > bodyContentBottom) break;
          doc.text(ln, sx + cellPadX, cy);
          cy += lineH;
        }
        if (cy > bodyContentBottom) break;
      }
    } else {
      // Vide : lignes d'écriture (blanches sur sage green)
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.25);
      let ly = bodyContentTop + 2;
      while (ly <= bodyContentBottom) {
        doc.line(sx + cellPadX, ly, sx + suppColW - cellPadX, ly);
        ly += lineH;
      }
    }
  });

  // ══════════════════════════════════════════════════════════════
  //  À PRIVILÉGIER / À LIMITER — hauteur dynamique partagée
  // ══════════════════════════════════════════════════════════════
  const btmGap = 6;
  const btmWidth = (pw - margin * 2 - btmGap) / 2;

  // Constantes partagées pour l'alignement strict des deux blocs
  const BTM_TITLE_FONT = 11;
  const BTM_TITLE_H = 8;         // hauteur reservée au titre
  const BTM_INNER_PAD = 8;       // padding gauche/droite identique
  const BTM_LIST_FONT = 8;
  const BTM_LINE_H = 3.6;
  const BTM_SUB_GAP = 4;

  // Mesure la hauteur naturelle requise pour rendre une section
  // (doit rester en phase avec renderFoodList ci-dessous)
  const measureSectionHeight = (items) => {
    if (!items || items.length === 0) {
      // placeholder "—" centré : on réserve une hauteur minimale
      return BTM_TITLE_H + 7 + 14 + 3;
    }
    const subColW = (btmWidth - BTM_INNER_PAD * 2 - BTM_SUB_GAP) / 2;
    const half = Math.ceil(items.length / 2);
    const leftText  = items.slice(0, half).join(', ');
    const rightText = items.slice(half).join(', ');
    doc.setFontSize(BTM_LIST_FONT);
    doc.setFont('helvetica', 'normal');
    const leftLines  = doc.splitTextToSize(leftText,  subColW);
    const rightLines = doc.splitTextToSize(rightText, subColW);
    const nLines = Math.max(leftLines.length, rightLines.length);
    return BTM_TITLE_H + 7 + nLines * BTM_LINE_H + 3;
  };

  // Hauteur commune = max des 2 sections, bornée par l'espace dispo
  // jusqu'au footer pour éviter tout chevauchement.
  const naturalSectionH = Math.max(
    measureSectionHeight(meals.toFavor),
    measureSectionHeight(meals.toLimit)
  );
  const sectionH = Math.min(naturalSectionH, footerY - sectionTop - 4);

  function renderFoodList(items, x0, y0, boxW, boxH) {
    const listTop = y0 + BTM_TITLE_H + 7;
    const listBottom = y0 + boxH - 3;
    const subColW = (boxW - BTM_INNER_PAD * 2 - BTM_SUB_GAP) / 2;

    doc.setFontSize(BTM_LIST_FONT);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_TEXT);

    if (!items || items.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...GREY_TEXT);
      doc.text('—', x0 + boxW / 2, y0 + boxH / 2 + 2, { align: 'center' });
      return;
    }

    const half = Math.ceil(items.length / 2);
    const leftText = items.slice(0, half).join(', ');
    const rightText = items.slice(half).join(', ');

    const leftLines = doc.splitTextToSize(leftText, subColW);
    const rightLines = doc.splitTextToSize(rightText, subColW);
    const maxLines = Math.floor((listBottom - listTop) / BTM_LINE_H);

    const xLeft = x0 + BTM_INNER_PAD;
    const xRight = x0 + BTM_INNER_PAD + subColW + BTM_SUB_GAP;

    let ly = listTop;
    for (let i = 0; i < Math.min(leftLines.length, maxLines); i++) {
      doc.text(leftLines[i], xLeft, ly);
      ly += BTM_LINE_H;
    }
    let ry = listTop;
    for (let i = 0; i < Math.min(rightLines.length, maxLines); i++) {
      doc.text(rightLines[i], xRight, ry);
      ry += BTM_LINE_H;
    }
  }

  // À PRIVILÉGIER — fond vert pâle (top=sectionTop, hauteur=sectionH)
  doc.setFillColor(...FAVOR_BG);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, sectionTop, btmWidth, sectionH, radius, radius, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BTM_TITLE_FONT);
  doc.setTextColor(...DARK_GREEN);
  doc.setCharSpace(0);
  doc.text('À PRIVILÉGIER', margin + btmWidth / 2, sectionTop + 7, { align: 'center' });
  renderFoodList(meals.toFavor, margin, sectionTop, btmWidth, sectionH);

  // À LIMITER — fond rose pâle (même top, même hauteur)
  const limX = margin + btmWidth + btmGap;
  doc.setFillColor(...LIMIT_BG);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(limX, sectionTop, btmWidth, sectionH, radius, radius, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BTM_TITLE_FONT);
  doc.setTextColor(...LIMIT_TITLE);
  doc.setCharSpace(0);
  doc.text('À LIMITER', limX + btmWidth / 2, sectionTop + 7, { align: 'center' });
  renderFoodList(meals.toLimit, limX, sectionTop, btmWidth, sectionH);

  // ══════════════════════════════════════════════════════════════
  //  FOOTER : bandeau vert foncé (Y fixe à footerY = ph - 22)
  // ══════════════════════════════════════════════════════════════
  doc.setFillColor(...DARK_GREEN);
  doc.roundedRect(margin, footerY, pw - margin * 2, footerH, radius, radius, 'F');

  // Gauche : Hydratation + Collation
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const leftX = margin + 6;
  let fy = footerY + 5;
  const hydration = meals.hydration || form.hydratation;
  if (hydration) {
    doc.text('HYDRATATION', leftX, fy);
    doc.setFont('helvetica', 'normal');
    doc.text(String(hydration), leftX + 26, fy);
    fy += 4;
  }
  if (meals.snack) {
    doc.setFont('helvetica', 'bold');
    doc.text('COLLATION', leftX, fy);
    doc.setFont('helvetica', 'normal');
    const snackLines = doc.splitTextToSize(String(meals.snack), 110);
    doc.text(snackLines[0] || '', leftX + 22, fy);
  }

  // Droite : coordonnées Anissa, centrées verticalement dans le bandeau
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  const rightX = pw - margin - 6;
  doc.text(
    'anissa.nutri@gmail.com  ·  www.anissanutrition.ch  ·  076 621 02 05',
    rightX,
    footerY + footerH / 2 + 1,
    { align: 'right' }
  );

  doc.save(`fiche-frigo-${(form.prenom || 'client').toLowerCase()}-${dateStr.replace(/\./g, '-')}.pdf`);
}

// ─────────────────────────────────────────────────────
// PDF 3: COVER PERSONNALISÉE (Anissa Deroubaix)
// ─────────────────────────────────────────────────────

export async function exportCoverPDF(consultation, client) {
  // Palette premium Anissa — cohérente avec la fiche frigo
  const CREAM      = [245, 242, 236];   // #F5F2EC fond principal
  const CREAM_DARK = [237, 233, 224];   // fond section client (légèrement plus foncé)
  const DARK_GREEN = [26, 46, 31];      // #1A2E1F titres
  const INK        = [49, 45, 45];      // corps de texte
  const GREY       = [136, 136, 136];   // libellés discrets
  const BORDER     = [212, 208, 200];   // filets fins

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth();   // 210
  const ph = doc.internal.pageSize.getHeight();  // 297
  const margin = 18;

  const form = client?.form || {};
  const cf = consultation?.coverFields || {};
  const prenom = (cf.prenom || form.prenom || 'Client').trim();
  const rawObjectif = (cf.objectif || form.objectifPrincipalNutrition || form.objectifSport || '-').trim();
  // Tronque à 80 chars avec ... si plus long (l'objectif vient d'un textarea libre)
  const objectif = rawObjectif.length > 80
    ? rawObjectif.substring(0, 79).trimEnd() + '…'
    : rawObjectif;
  const dateStr = cf.date || formatDateFR(new Date().toISOString());
  const sousTitre = cf.sousTitre || 'PROTOCOLE NUTRITIONNEL PERSONNALIS\u00c9';

  // Type de bilan dérivé des flags de consultation (supporte snake_case et camelCase)
  const blood = !!consultation?.blood_test_done || !!consultation?.bloodTestDone;
  const dna   = !!consultation?.dna_test_done   || !!consultation?.dnaTestDone;
  const mgdRec = consultation?.mgdRecommendation
    || consultation?.mgd_recommendation
    || (blood && dna ? 'advanced' : blood ? 'blood' : 'none');
  let typeBilan = 'Bilan Nutritionnel';
  if (blood && dna) typeBilan = 'Bilan Nutritionnel, Sanguin & ADN';
  else if (blood)   typeBilan = 'Bilan Nutritionnel & Sanguin';
  else if (dna)     typeBilan = 'Bilan Nutritionnel & ADN';

  console.log('[Cover] generating for', { prenom, objectifLen: rawObjectif.length, typeBilan, dateStr });

  // ─── Chargement du logo Anissa (skip silencieux si indisponible) ───
  // On utilise le chemin canvas (<img> + canvas.toDataURL('image/png'))
  // plutôt que loadImageAsBase64 qui passe par FileReader.readAsDataURL.
  // Raison : le fichier public/logo-anissa.png est servi par Vite avec
  // Content-Type: image/png basé sur l'extension, mais son contenu réel
  // est un JPEG/JFIF (1024×1024). FileReader produirait un data URL
  // malformé (préfixe image/png sur des bytes JPEG) que jsPDF ne peut
  // pas décoder. Le canvas, lui, décode via <img> (transparent au format
  // réel) puis ré-encode proprement en PNG.
  const loadCoverLogo = (url) => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('[Cover] canvas re-encode failed:', e);
        resolve(null);
      }
    };
    img.onerror = (e) => {
      console.warn('[Cover] image load error:', e);
      resolve(null);
    };
    img.src = url;
  });

  let logoData = null;
  try {
    logoData = await loadCoverLogo('/logo-anissa.png');
    console.log('[Cover] logo:', logoData ? 'OK' : 'FAILED');
  } catch (err) {
    console.warn('[Cover] logo load error (skipped):', err);
    logoData = null;
  }

  // ─── Fond crème plein ───
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, pw, ph, 'F');

  // ══════════════════════════════════════════════════════════════
  //  HEADER — nom Anissa à gauche, localisation à droite
  //  NOTE: on force charSpace=0 systématiquement avant chaque text()
  //  pour garantir le rendu (le bug "header invisible" était lié au
  //  charSpace non reset, pas aux accents). Les polices intégrées
  //  helvetica/times supportent les caractères Latin-1 étendus
  //  (é, à, è, É, —, «, », ·) via l'encodage WinAnsi.
  // ══════════════════════════════════════════════════════════════
  const headerY = 22;
  doc.setCharSpace(0);

  // Ligne 1 : ANISSA DEROUBAIX (bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...DARK_GREEN);
  doc.text('ANISSA DEROUBAIX', margin, headerY);
  console.log('[Cover] header line 1 drawn at', { x: margin, y: headerY });

  // Ligne 2 : sous-titre principal
  doc.setCharSpace(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text('Nutritionniste — Optimisation métabolique & longévité', margin, headerY + 5);

  // Ligne 3 : sous-titre secondaire en gris
  doc.setCharSpace(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text('Approche basée sur données biologiques & physiologie appliquée', margin, headerY + 9.5);

  // Coin haut-droit : localisation
  doc.setCharSpace(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(
    'Nutritionniste · Longévité & Biomarqueurs · Nyon',
    pw - margin,
    headerY,
    { align: 'right' }
  );

  // Filet sous le header
  const headerBottomY = headerY + 16;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, headerBottomY, pw - margin, headerBottomY);

  // ══════════════════════════════════════════════════════════════
  //  LOGO CENTRÉ (25×25mm) — au-dessus du titre
  // ══════════════════════════════════════════════════════════════
  const logoSize = 25;
  const logoY    = 48;
  if (logoData) {
    doc.addImage(logoData, 'PNG', pw / 2 - logoSize / 2, logoY, logoSize, logoSize);
  }

  // ══════════════════════════════════════════════════════════════
  //  TITRE PRINCIPAL (serif, centré sur 2 lignes)
  // ══════════════════════════════════════════════════════════════
  const titleY = 86;
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...DARK_GREEN);
  const titleLines = doc.splitTextToSize(sousTitre.toUpperCase(), pw - margin * 2);
  for (let i = 0; i < titleLines.length; i++) {
    doc.text(titleLines[i], pw / 2, titleY + i * 10, { align: 'center' });
  }

  // Filet décoratif court sous le titre
  doc.setDrawColor(...DARK_GREEN);
  doc.setLineWidth(0.6);
  const rulerW = 28;
  doc.line(pw / 2 - rulerW / 2, titleY + 17, pw / 2 + rulerW / 2, titleY + 17);

  // ══════════════════════════════════════════════════════════════
  //  PARAGRAPHE DESCRIPTIF
  // ══════════════════════════════════════════════════════════════
  const paragraphY = titleY + 30;
  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  const intro = "Ce protocole a été élaboré à partir de votre profil biologique, de vos objectifs de longévité et des recommandations nutritionnelles adaptées à votre physiologie. Chaque choix alimentaire est guidé par la science et votre singularité.";
  const introLines = doc.splitTextToSize(intro, pw - margin * 2 - 20);
  let py = paragraphY;
  introLines.forEach(line => {
    doc.text(line, pw / 2, py, { align: 'center' });
    py += 5.5;
  });

  // ══════════════════════════════════════════════════════════════
  //  SECTION CLIENT — fond crème foncé, hauteur dynamique
  //  L'objectif peut wrapper sur 2 lignes max ; les lignes
  //  suivantes (Consultation, Date) et la hauteur de la carte
  //  s'adaptent en conséquence.
  // ══════════════════════════════════════════════════════════════
  const boxX = margin;
  const boxY = py + 10;
  const boxW = pw - margin * 2;
  const kvAvailW = boxW - 20; // marge intérieure pour le wrapping

  // Gap fixe en mm entre un label "X :" et sa valeur — nécessaire car
  // doc.getTextWidth() strippe les espaces de fin, donc un trailing " "
  // dans la chaîne label ne produit AUCUN décalage quand on rend la valeur.
  const KV_GAP = 1.5;

  // Pré-mesure de la valeur "Objectif" : max 2 lignes, wrapping strict
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const objLabel = 'Objectif :';
  const objLabelW = doc.getTextWidth(objLabel);
  doc.setFont('helvetica', 'normal');
  const objLinesAll = doc.splitTextToSize(objectif, kvAvailW - objLabelW - KV_GAP);
  const objLines = objLinesAll.slice(0, 2);
  const objLineCount = objLines.length;

  // Layout vertical dynamique de la carte
  const kvFirstY  = 38;
  const kvLineH   = 7;
  const objLastY  = kvFirstY + (objLineCount - 1) * 4.8; // 2e ligne sous la 1re
  const consultY  = objLastY + kvLineH;
  const dateYOff  = consultY + kvLineH;
  const boxH      = dateYOff + 8; // marge basse

  doc.setFillColor(...CREAM_DARK);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, boxY, boxW, boxH, 4, 4, 'FD');

  // Label "PRÉPARÉ POUR" — charSpace=0 forcé, sinon le centrage align='center'
  // est faussé (jsPDF ne prend pas en compte le charSpace dans le calcul de
  // largeur du texte, même bug que sur les titres de la fiche frigo).
  doc.setCharSpace(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text('PRÉPARÉ POUR', pw / 2, boxY + 10, { align: 'center' });

  // Prénom en grand serif
  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...DARK_GREEN);
  doc.text(prenom.toUpperCase(), pw / 2, boxY + 23, { align: 'center' });

  // Filet fin sous le prénom
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  const sepW = 40;
  doc.line(pw / 2 - sepW / 2, boxY + 28, pw / 2 + sepW / 2, boxY + 28);

  // Ligne KV simple (label bold gris + valeur normale sombre, centrée en bloc).
  // Utilise KV_GAP (mm) comme décalage fixe entre la fin du label ":" et la
  // valeur, parce que jsPDF strippe les espaces de fin dans getTextWidth.
  const drawKV = (label, value, yy) => {
    const labelText = `${label} :`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const labelW = doc.getTextWidth(labelText);
    doc.setFont('helvetica', 'normal');
    const valueW = doc.getTextWidth(value);
    const totalW = labelW + KV_GAP + valueW;
    const startX = pw / 2 - totalW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREY);
    doc.text(labelText, startX, yy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    doc.text(value, startX + labelW + KV_GAP, yy);
  };

  // Objectif — 1 ou 2 lignes (le label n'apparaît qu'en face de la 1re ligne,
  // la 2e ligne de wrapping est centrée dessous sans label).
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const firstLineValueW = doc.getTextWidth(objLines[0] || '');
  const firstLineTotalW = objLabelW + KV_GAP + firstLineValueW;
  const firstLineStartX = pw / 2 - firstLineTotalW / 2;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREY);
  doc.text(objLabel, firstLineStartX, boxY + kvFirstY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...INK);
  doc.text(objLines[0] || '', firstLineStartX + objLabelW + KV_GAP, boxY + kvFirstY);
  if (objLineCount > 1) {
    // 2e ligne centrée sous la précédente, sans label
    doc.text(objLines[1], pw / 2, boxY + kvFirstY + 4.8, { align: 'center' });
  }

  drawKV('Consultation', typeBilan, boxY + consultY);
  drawKV('Date',         dateStr,   boxY + dateYOff);

  // Y de référence pour la suite du layout — position dynamique après la carte
  const yAfterCard = boxY + boxH;

  // ══════════════════════════════════════════════════════════════
  //  CITATION (italic serif, centrée) — positionnée dynamiquement
  // ══════════════════════════════════════════════════════════════
  const quoteBlockY = yAfterCard + 15;
  doc.setDrawColor(...DARK_GREEN);
  doc.setLineWidth(0.4);
  doc.line(pw / 2 - 10, quoteBlockY - 7, pw / 2 + 10, quoteBlockY - 7);

  doc.setCharSpace(0);
  doc.setFont('times', 'italic');
  doc.setFontSize(11.5);
  doc.setTextColor(...DARK_GREEN);
  const quote = "« Votre corps suit des règles biologiques. Ce protocole s'y adapte avec précision. »";
  const quoteLines = doc.splitTextToSize(quote, pw - margin * 2 - 30);
  let qy = quoteBlockY;
  quoteLines.forEach(line => {
    doc.text(line, pw / 2, qy, { align: 'center' });
    qy += 6;
  });

  // ══════════════════════════════════════════════════════════════
  //  FOOTER — position fixe en bas de page (ph - 15)
  // ══════════════════════════════════════════════════════════════
  const footerTextY = ph - 15;
  const footerLineY = footerTextY - 5;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, footerLineY, pw - margin, footerLineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(
    '076 621 02 05  ·  Rue de Rive 28, 1260 Nyon  ·  anissa.nutri@gmail.com  ·  www.anissanutrition.ch',
    pw / 2,
    footerTextY,
    { align: 'center' }
  );

  console.log('[Cover] layout', { yAfterCard, quoteBlockY, footerTextY, objLineCount });

  doc.save(`cover-${prenom.toLowerCase()}-${dateStr.replace(/\./g, '-')}.pdf`);
}


// ─────────────────────────────────────────────────────
// PACK CLIENT COMPLET — single PDF with cover + plan + fiche frigo + guide
// Architecture: strict, deterministic, no duplication.
// Each section type appears AT MOST once. Fiche frigo is rendered from the
// structured 'frigo' section (not re-extracted from the full plan text).
// ─────────────────────────────────────────────────────

export async function exportClientPackPDF(consultation, client, { sections: unifiedSections, coverFields, mgdCorrelation } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 25;
  const cw = pw - margin * 2;
  const form = client?.form || {};
  const prenom = (coverFields?.prenom || form.prenom || 'Client').trim();
  const dateStr = formatDateFR(consultation.date || new Date().toISOString());
  const objectif = (coverFields?.objectif || form.objectifPrincipalNutrition || form.objectifSport || '').trim();
  const sousTitre = coverFields?.sousTitre || 'Plan nutrition personnalise';

  // ═══════════ PAGE 1: COVER ═══════════
  doc.setFillColor(...BG_PAGE);
  doc.rect(0, 0, pw, ph, 'F');

  let y = 60;
  doc.setDrawColor(200, 198, 190);
  doc.setLineWidth(0.3);
  doc.line(pw / 2 - 35, y, pw / 2 + 35, y);

  y += 16;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GREY_TEXT);
  doc.text('Anissa Deroubaix Nutrition', pw / 2, y, { align: 'center' });

  y += 20;
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.text(sousTitre.toUpperCase(), pw / 2, y, { align: 'center' });

  y += 14;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_TEXT);
  doc.text(prenom, pw / 2, y, { align: 'center' });

  if (objectif) {
    y += 20;
    doc.setFontSize(10);
    doc.setTextColor(...GREY_TEXT);
    const objLines = doc.splitTextToSize(objectif, cw - 20);
    for (const ol of objLines) {
      doc.text(ol, pw / 2, y, { align: 'center' });
      y += 5;
    }
  }

  y = 200;
  doc.setDrawColor(200, 198, 190);
  doc.line(pw / 2 - 35, y, pw / 2 + 35, y);
  y += 12;
  doc.setFontSize(9);
  doc.setTextColor(...GREY_TEXT);
  doc.text(dateStr, pw / 2, y, { align: 'center' });
  y += 6;
  doc.text('AB Coaching Sarl · Rue de Rive 28, 1260 Nyon', pw / 2, y, { align: 'center' });
  y += 10;
  doc.setFontSize(7.5);
  doc.text('Document confidentiel — usage personnel uniquement', pw / 2, y, { align: 'center' });

  // ═══════════ PAGES 2+: PLAN SECTIONS (strict order, deduplicated) ═══════════
  // Canonical order — each type appears at most once.
  const SECTION_ORDER = consultation.isFollowup
    ? ['suivi', 'analyse', 'plan', 'supplements', 'conseils', 'notes_coach', 'other']
    : ['analyse', 'principes', 'plan', 'rotation', 'protocoles', 'ajustements', 'coach', 'action', 'supplements', 'other'];
  // NOTE: 'frigo' is intentionally NOT in this list — it gets its own dedicated page below.
  // NOTE: 'conseils' and 'notes_coach' are excluded from non-followup packs (internal only).

  if (unifiedSections && unifiedSections.length > 0) {
    // Render all sections linearly (same order as editor), skip frigo (handled separately)
    for (const sec of unifiedSections) {
      if (sec.type === 'frigo') continue;
      if (!sec.content?.trim()) continue;
      doc.addPage();
      doc.setFillColor(...BG_PAGE);
      doc.rect(0, 0, pw, ph, 'F');
      y = 20;
      y = addSectionTitle(doc, sec.title, y, margin);
      const tokens = parseNutritionPlan(sec.content);
      y = renderTokens(doc, tokens, margin, y, cw);
    }
  }

  // ═══════════ FICHE FRIGO PAGE (single source, no re-extraction) ═══════════
  // Priority: structured 'frigo' section from unifiedSections → extractFridgeDataFromSections fallback
  const frigoSection = (unifiedSections || []).find(s => s.type === 'frigo');
  let frigoRendered = false;

  if (frigoSection && frigoSection.content?.trim()) {
    // Render the fiche frigo section as a standard content page
    doc.addPage();
    doc.setFillColor(...BG_PAGE);
    doc.rect(0, 0, pw, ph, 'F');
    y = 20;
    y = addSectionTitle(doc, 'Votre Fiche Frigo', y, margin);
    const tokens = parseNutritionPlan(frigoSection.content);
    y = renderTokens(doc, tokens, margin, y, cw);
    frigoRendered = true;
  }

  if (!frigoRendered && unifiedSections && unifiedSections.length > 0) {
    // Fallback: extract fridge data from structured sections (not full plan text)
    const fridgeData = extractFridgeDataFromSections(unifiedSections);
    if (fridgeData) {
      doc.addPage();
      doc.setFillColor(...BG_PAGE);
      doc.rect(0, 0, pw, ph, 'F');
      y = 20;
      y = addSectionTitle(doc, 'Votre Fiche Frigo', y, margin);
      y = renderFridgeData(doc, fridgeData, margin, y, cw);
      frigoRendered = true;
    }
  }

  // ═══════════ RECOMMANDATIONS BIOLOGIQUES MGD ═══════════
  if (mgdRec && mgdRec !== 'none') {
    doc.addPage();
    doc.setFillColor(...BG_PAGE);
    doc.rect(0, 0, pw, ph, 'F');
    y = 20;

    // Titre section
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(106, 191, 138);
    doc.text('RECOMMANDATIONS BIOLOGIQUES', margin, y);
    y += 6;

    // Ligne séparatrice
    doc.setDrawColor(106, 191, 138);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pw - margin, y);
    y += 6;

    // Contenu
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 50);

    const mgdText = mgdRec === 'advanced'
      ? 'Un bilan avanc\u00e9 (sanguin + ADN) est recommand\u00e9 pour affiner la personnalisation de votre protocole nutritionnel.'
      : 'Un bilan sanguin est recommand\u00e9 afin d\'optimiser votre accompagnement nutritionnel.';

    const mgdDetail = mgdRec === 'advanced'
      ? 'Bilan sanguin complet \u00b7 Test ADN nutritionnel \u00b7 Laboratoire MGD'
      : 'Om\u00e9ga-3 \u00b7 Glyc\u00e9mie / Insuline \u00b7 CRP \u00b7 Vitamine D \u00b7 Laboratoire MGD';

    const mgdLines = doc.splitTextToSize(mgdText, pw - margin * 2);
    doc.text(mgdLines, margin, y);
    y += mgdLines.length * 5 + 3;

    doc.setTextColor(120, 100, 60);
    doc.setFontSize(7.5);
    doc.text(mgdDetail, margin, y);
    y += 10;

    // Synthèse clinique si corrélation disponible
    if (mgdCorrelation?.clinicalSummary) {
      const cs = mgdCorrelation.clinicalSummary;
      y += 4;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 50);
      const priorityText = `Priorité : ${cs.mainIssue} — confirmé par ${cs.confirmedBy}`;
      const priorityLines = doc.splitTextToSize(priorityText, pw - margin * 2);
      doc.text(priorityLines, margin, y);
      y += priorityLines.length * 4.5 + 3;
      if (cs.topAction) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 80, 40);
        const actionLines = doc.splitTextToSize(`→ ${cs.topAction}`, pw - margin * 2);
        doc.text(actionLines, margin, y);
        y += actionLines.length * 4.5 + 4;
      }
    }
  }

  // ═══════════ GUIDE DE DÉMARRAGE (last page) ═══════════
  doc.addPage();
  doc.setFillColor(...BG_PAGE);
  doc.rect(0, 0, pw, ph, 'F');
  y = 20;
  y = addSectionTitle(doc, 'Guide de demarrage', y, margin);

  const guideLines = [
    'Commencez par la Semaine 1 : suivez les trames de repas sans chercher la perfection.',
    'Preparez vos courses a l\'avance avec la fiche frigo — collez-la sur votre refrigerateur.',
    'Buvez un grand verre d\'eau au reveil et avant chaque repas.',
    'Ne sautez pas le petit-dejeuner — c\'est la cle de la stabilite energetique.',
    'Mastiquez lentement (20 mastications par bouchee) pour ameliorer la digestion.',
    'Les jours d\'entrainement, ajoutez un feculent a chaque repas.',
    'Si fringale l\'apres-midi : 10 amandes + 1 fruit, pas de sucre raffine.',
    'Notez votre energie, digestion et sommeil chaque soir (note sur 10).',
    'Apres 2 semaines, commencez a varier avec les rotations proposees.',
    'En cas de doute, contactez votre nutritionniste avant de modifier le plan.',
  ];

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_TEXT);
  for (const line of guideLines) {
    y = ensurePage(doc, y, 8);
    const wrapped = doc.splitTextToSize(line, cw - 12);
    wrapped.forEach((wl, i) => {
      doc.text(i === 0 ? '—  ' + wl : '     ' + wl, margin + 6, y);
      y += 4.8;
    });
    y += 2;
  }

  y += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GREY_TEXT);
  doc.text('La regularite bat l\'intensite. Mieux vaut un plan simple suivi a 90%', pw / 2, y, { align: 'center' });
  y += 5;
  doc.text('qu\'un plan parfait suivi a 50%.', pw / 2, y, { align: 'center' });

  // ═══════════ HEADERS & FOOTERS (all pages except cover) ═══════════
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    addHeaderFooter(doc, prenom, i - 1, totalPages - 1, dateStr);
  }

  const fileName = `pack-${prenom.toLowerCase()}-${dateStr.replace(/\./g, '-')}.pdf`;
  doc.save(fileName);
}

// Helper: render extracted fridge data as formatted PDF content
function renderFridgeData(doc, meals, margin, startY, cw) {
  let y = startY;

  const mealBlocks = [
    { label: 'PETIT-DEJEUNER', items: meals.breakfast },
    { label: 'DEJEUNER', items: meals.lunch },
    { label: 'DINER', items: meals.dinner },
  ];

  for (const block of mealBlocks) {
    if (!block.items.length) continue;
    y = ensurePage(doc, y, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREEN);
    doc.text(block.label, margin + 2, y);
    y += 2;
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.4);
    doc.line(margin + 2, y, margin + 28, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_TEXT);
    for (let i = 0; i < Math.min(block.items.length, 3); i++) {
      const lines = doc.splitTextToSize(block.items[i], cw - 10);
      for (const l of lines) {
        y = ensurePage(doc, y);
        doc.text('—  ' + l, margin + 6, y);
        y += 4.5;
      }
      y += 2;
    }
    y += 4;
  }

  if (meals.snack) {
    y = ensurePage(doc, y, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREEN);
    doc.text('COLLATION', margin + 2, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_TEXT);
    doc.text('—  ' + meals.snack, margin + 6, y);
    y += 8;
  }

  if (meals.toFavor.length) {
    y = ensurePage(doc, y, 14);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREEN);
    doc.text('A PRIVILEGIER', margin + 2, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_TEXT);
    doc.text(meals.toFavor.slice(0, 10).join(', '), margin + 6, y);
    y += 8;
  }

  if (meals.toLimit.length) {
    y = ensurePage(doc, y, 14);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 60, 60);
    doc.text('A LIMITER', margin + 2, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_TEXT);
    doc.text(meals.toLimit.slice(0, 10).join(', '), margin + 6, y);
    y += 8;
  }

  return y;
}
