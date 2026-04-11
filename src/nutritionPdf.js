import { jsPDF } from 'jspdf';

const LOGO_URL = 'https://cdn.prod.website-files.com/69c276fd79d460813b99867a/69d411dfafbbe967e3d992c4_Design_sans_titre_1_-removebg-preview.png';
const GREEN = [26, 46, 31];
const DARK_TEXT = [49, 45, 45];
const GREY_TEXT = [136, 136, 136];
const SEPARATOR = [232, 230, 225];
const BG_PAGE = [247, 246, 243];

function formatDateFR(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

function ensurePage(doc, y, needed = 10) {
  if (y > 272 - needed) { doc.addPage(); return 20; }
  return y;
}

function addHeaderFooter(doc, prenom, pageNum, totalPages) {
  const pw = doc.internal.pageSize.getWidth();
  const m = 25;
  doc.setDrawColor(...SEPARATOR);
  doc.setLineWidth(0.3);
  doc.line(m, 14, pw - m, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(153, 153, 153);
  doc.text(`Plan Nutrition — ${prenom}`, m, 12);
  doc.text('Anissa Deroubaix Nutrition', pw - m, 12, { align: 'right' });
  doc.line(m, 282, pw - m, 282);
  doc.text('Document confidentiel', m, 288);
  doc.text(`Page ${pageNum}/${totalPages}`, pw - m, 288, { align: 'right' });
}

function addSectionTitle(doc, title, y, margin) {
  y = ensurePage(doc, y, 15);
  doc.setFillColor(...GREEN);
  doc.rect(margin, y - 3, 4, 4, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.text(title.toUpperCase(), margin + 8, y);
  y += 3;
  doc.setDrawColor(...SEPARATOR);
  doc.setLineWidth(0.3);
  doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);
  return y + 8;
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
        y += 3;
        break;

      case 'noteblock': {
        y = ensurePage(doc, y, 16);
        const noteW = maxWidth - 4;
        const noteText = cleanMarkdown(tok.content);
        const noteLines = doc.splitTextToSize(noteText, noteW - 16);
        const noteH = Math.max(16, noteLines.length * 4.2 + 10);
        // Background
        doc.setFillColor(240, 253, 244);
        doc.rect(margin + 2, y - 3, noteW, noteH, 'F');
        // Green left border
        doc.setFillColor(74, 222, 128);
        doc.rect(margin + 2, y - 3, 2.5, noteH, 'F');
        // Text
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(74, 222, 128);
        let ny = y + 2;
        for (const nl of noteLines) {
          doc.text(nl, margin + 10, ny);
          ny += 4.2;
        }
        doc.setTextColor(...DARK_TEXT);
        y += noteH + 4;
        break;
      }

      case 'alertblock': {
        y = ensurePage(doc, y, 16);
        const alertW = maxWidth - 4;
        const alertText = cleanMarkdown(tok.content);
        const alertLines = doc.splitTextToSize(alertText, alertW - 16);
        const alertH = Math.max(16, alertLines.length * 4.2 + 10);
        // Background
        doc.setFillColor(254, 242, 242);
        doc.rect(margin + 2, y - 3, alertW, alertH, 'F');
        // Red left border
        doc.setFillColor(248, 113, 113);
        doc.rect(margin + 2, y - 3, 2.5, alertH, 'F');
        // Text
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(248, 113, 113);
        let ay = y + 2;
        for (const al of alertLines) {
          doc.text(al, margin + 10, ay);
          ay += 4.2;
        }
        doc.setTextColor(...DARK_TEXT);
        y += alertH + 4;
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
        y = ensurePage(doc, y, 14);
        y += 6;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GREEN);
        doc.text(tok.content, margin, y);
        y += 3;
        doc.setDrawColor(...SEPARATOR);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pw - margin, y);
        y += 8;
        break;

      case 'title':
        y = ensurePage(doc, y, 12);
        y += 3;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GREEN);
        const titleLines = doc.splitTextToSize(tok.content, maxWidth);
        for (const tl of titleLines) {
          y = ensurePage(doc, y);
          doc.text(tl, margin, y);
          y += 5;
        }
        y += 2;
        break;

      case 'day':
        y = ensurePage(doc, y, 10);
        y += 6;
        doc.setFillColor(248, 250, 248);
        doc.rect(margin - 1, y - 4, maxWidth + 2, 7, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GREEN);
        doc.text(tok.content, margin + 2, y);
        y += 8;
        break;

      case 'meal':
        y = ensurePage(doc, y, 12);
        y += 4;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GREEN);
        doc.text(tok.content, margin, y);
        y += 2;
        doc.setDrawColor(...GREEN);
        doc.setLineWidth(0.4);
        doc.line(margin, y, margin + 30, y);
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
        y = ensurePage(doc, y);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        if (hasFormattingMarkers(tok.content)) {
          const prefix = '—  ';
          doc.setTextColor(...DARK_TEXT);
          doc.text(prefix, margin + 5, y);
          const bx = margin + 5 + doc.getTextWidth(prefix);
          if (hasSizeMarkers(tok.content)) {
            renderSizedLine(doc, tok.content, bx, y, DARK_TEXT);
          } else if (hasHighlightMarkers(tok.content)) {
            renderHighlightedLine(doc, tok.content, bx, y, maxWidth - 10, DARK_TEXT);
          } else {
            renderColoredLine(doc, parseColorSegments(tok.content), bx, y, DARK_TEXT);
          }
          y += 4.2;
        } else {
          doc.setTextColor(...DARK_TEXT);
          const bulletLines = doc.splitTextToSize(tok.content, maxWidth - 10);
          bulletLines.forEach((bl, i) => {
            y = ensurePage(doc, y);
            doc.text(i === 0 ? '—  ' + bl : '    ' + bl, margin + 5, y);
            y += 4.2;
          });
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

  // Merge external supplements/recipes
  if (supplementsText?.trim()) {
    result.supplements += (result.supplements ? '\n\n' : '') + supplementsText.trim();
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
  const dateStr = formatDateFR(consultation.date);
  const objectif = form.objectifPrincipalNutrition || form.objectifSport || '';

  // Split the AI plan into client-facing sections
  const sections = splitPlanIntoClientSections(
    consultation.nutritionPlan, consultation.supplements, consultation.recipes
  );

  // ─── PAGE 1: COVER ───
  doc.setFillColor(...BG_PAGE);
  doc.rect(0, 0, pw, 297, 'F');

  let logoData = null;
  try { logoData = await loadImageAsBase64(LOGO_URL); } catch {}

  let y = 65;
  if (logoData) { doc.addImage(logoData, 'PNG', pw / 2 - 25, y, 50, 50); y += 58; }

  y += 10;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.text('PLAN NUTRITION', pw / 2, y, { align: 'center' });
  y += 8;
  doc.text('PERSONNALISE', pw / 2, y, { align: 'center' });
  y += 10;

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(pw / 2 - 14, y, pw / 2 + 14, y);
  y += 14;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_TEXT);
  doc.text(prenom, pw / 2, y, { align: 'center' });
  y += 10;

  if (objectif) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GREY_TEXT);
    const objLines = doc.splitTextToSize(`Votre objectif : ${objectif}`, cw);
    for (const ol of objLines) { doc.text(ol, pw / 2, y, { align: 'center' }); y += 5; }
    y += 2;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GREY_TEXT);
  doc.text(dateStr, pw / 2, y, { align: 'center' });

  doc.setFontSize(9);
  doc.text('Anissa Deroubaix Nutrition · AB Coaching Sarl', pw / 2, 268, { align: 'center' });
  doc.text('Rue de Rive 28, 1260 Nyon', pw / 2, 274, { align: 'center' });

  // ─── PAGE 2: PROGRESSION (for followup consultations) ───
  if (consultation.isFollowup && consultation.followupData) {
    const fd = consultation.followupData;
    doc.addPage();
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

  // ─── INTRODUCTION (if available) ───
  if (sections.intro) {
    doc.addPage();
    y = 20;
    y = addSectionTitle(doc, 'Votre Plan En Quelques Mots', y, margin);
    y = addBody(doc, sections.intro, margin, y, cw);
    y += 12;
  }

  // ─── WEEKS (each on new page) ───
  for (const week of sections.weeks) {
    doc.addPage();
    y = 20;
    // Week title with subtle background
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

  // ─── SHOPPING LISTS (one page, one section per week) ───
  if (sections.shopping && sections.shopping.length > 0) {
    doc.addPage();
    y = 20;
    y = addSectionTitle(doc, 'Vos Listes De Courses', y, margin);
    y += 4;
    for (const list of sections.shopping) {
      if (y > 250) { doc.addPage(); y = 20; }
      // Week subtitle with background
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

  // ─── SUPPLEMENTS & NATURAL ALTERNATIVES ───
  if (sections.supplements) {
    if (y > 180) { doc.addPage(); y = 20; }
    y = addSectionTitle(doc, 'Recommandations Complementaires', y, margin);
    const tokens = parseNutritionPlan(sections.supplements);
    y = renderTokens(doc, tokens, margin, y, cw);
    y += 8;
  }

  // ─── RECIPES ───
  if (sections.recipes) {
    if (y > 200) { doc.addPage(); y = 20; }
    y = addSectionTitle(doc, 'Recettes Recommandees', y, margin);
    const tokens = parseNutritionPlan(sections.recipes);
    y = renderTokens(doc, tokens, margin, y, cw);
    y += 8;
  }

  // ─── PRACTICAL ADVICE ───
  if (sections.advice) {
    if (y > 200) { doc.addPage(); y = 20; }
    y = addSectionTitle(doc, 'Vos Conseils Au Quotidien', y, margin);
    const tokens = parseNutritionPlan(sections.advice);
    y = renderTokens(doc, tokens, margin, y, cw);
  }

  // ─── CLOSING PAGE ───
  doc.addPage();
  y = 80;
  doc.setFillColor(...BG_PAGE);
  doc.rect(0, 0, pw, 297, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_TEXT);
  const closingLines = [
    `Ce plan a ete elabore specifiquement pour vous par Anissa Deroubaix,`,
    `nutritionniste specialisee en biohacking et genetique.`,
    ``,
    `Il est recommande de suivre ce plan pendant 4 semaines`,
    `avant d'envisager des ajustements.`,
  ];
  for (const cl of closingLines) {
    doc.text(cl, pw / 2, y, { align: 'center' });
    y += 5;
  }

  y += 12;
  doc.setFontSize(9);
  doc.setTextColor(...GREY_TEXT);
  doc.text('Anissa Deroubaix Nutrition · AB Coaching Sarl', pw / 2, y, { align: 'center' });
  y += 5;
  doc.text('Rue de Rive 28, 1260 Nyon', pw / 2, y, { align: 'center' });
  y += 10;
  doc.setFontSize(8);
  doc.text('Document confidentiel — usage personnel uniquement', pw / 2, y, { align: 'center' });

  // ─── HEADERS & FOOTERS (all pages except cover and closing) ───
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 2; i < totalPages; i++) {
    doc.setPage(i);
    addHeaderFooter(doc, prenom, i - 1, totalPages - 2);
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
  function findMealBlocks(mealPatterns) {
    const results = [];
    const regex = new RegExp(mealPatterns.join('|'), 'i');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!regex.test(line)) continue;

      // Gather next 3-5 content lines after this header
      const block = [];
      for (let j = i + 1; j < lines.length && block.length < 5; j++) {
        const next = lines[j];
        // Stop if we hit another meal/section header
        if (/petit[- ]?d[eé]jeuner|d[eé]jeuner|d[iî]ner|collation|go[uû]ter|snack|semaine\s+\d|liste\s+de\s+courses|supplements|notes\s+pour/i.test(next) && block.length > 0) break;
        if (/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i.test(next) && block.length > 0) break;
        if (/^\d+\.\s+[A-Z]/.test(next)) break;
        const cleaned = next.replace(/^[-–•*]\s*/, '').trim();
        if (cleaned.length > 3) block.push(cleaned);
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
  const sectionTop = colTop + colH + 4;
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
    'anissanutrition@gmail.com  ·  www.anissanutrition.ch  ·  076 621 02 05',
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
  const prenom = (form.prenom || 'Client').trim();
  const rawObjectif = (form.objectifPrincipalNutrition || form.objectifSport || '-').trim();
  // Tronque à 80 chars avec ... si plus long (l'objectif vient d'un textarea libre)
  const objectif = rawObjectif.length > 80
    ? rawObjectif.substring(0, 79).trimEnd() + '…'
    : rawObjectif;
  const dateStr = formatDateFR(new Date().toISOString());

  // Type de bilan dérivé des flags de consultation (supporte snake_case et camelCase)
  const blood = !!consultation?.blood_test_done || !!consultation?.bloodTestDone;
  const dna   = !!consultation?.dna_test_done   || !!consultation?.dnaTestDone;
  let typeBilan = 'Bilan Nutritionnel';
  if (blood && dna) typeBilan = 'Bilan Nutritionnel, Sanguin & ADN';
  else if (blood)   typeBilan = 'Bilan Nutritionnel & Sanguin';
  else if (dna)     typeBilan = 'Bilan Nutritionnel & ADN';

  console.log('[Cover] generating for', { prenom, objectifLen: rawObjectif.length, typeBilan, dateStr });

  // ─── Chargement du logo Anissa (skip silencieux si indisponible) ───
  let logoData = null;
  try {
    logoData = await loadImageAsBase64('/logo-anissa.png');
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
  //  et on évite l'em-dash "—" (rendu capricieux dans certaines configs
  //  jsPDF) — remplacé par un hyphen " - ".
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
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text('Nutritionniste - Optimisation metabolique & longevite', margin, headerY + 5);

  // Ligne 3 : sous-titre secondaire en gris
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text('Approche basee sur donnees biologiques & physiologie appliquee', margin, headerY + 9.5);

  // Coin haut-droit : localisation
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(
    'Nutritionniste · Longevite & Biomarqueurs · Nyon',
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
  doc.text('PROTOCOLE NUTRITIONNEL', pw / 2, titleY, { align: 'center' });
  doc.text('PERSONNALISÉ',           pw / 2, titleY + 10, { align: 'center' });

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

  // Label "PREPARE POUR" — charSpace=0 forcé, sinon le centrage align='center'
  // est faussé (jsPDF ne prend pas en compte le charSpace dans le calcul de
  // largeur du texte, même bug que sur les titres de la fiche frigo).
  doc.setCharSpace(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text('PREPARE POUR', pw / 2, boxY + 10, { align: 'center' });

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

  doc.setFont('times', 'italic');
  doc.setFontSize(11.5);
  doc.setTextColor(...DARK_GREEN);
  const quote = "« Votre corps suit des regles biologiques. Ce protocole s'y adapte avec precision. »";
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
    '076 621 02 05  ·  Rue de Rive 28, 1260 Nyon  ·  anissanutrition@gmail.com  ·  www.anissanutrition.ch',
    pw / 2,
    footerTextY,
    { align: 'center' }
  );

  console.log('[Cover] layout', { yAfterCard, quoteBlockY, footerTextY, objLineCount });

  doc.save(`cover-${prenom.toLowerCase()}-${dateStr.replace(/\./g, '-')}.pdf`);
}
