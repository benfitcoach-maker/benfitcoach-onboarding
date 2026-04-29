// V94.29 : extrait depuis NutritionConsultation.jsx (Phase 1.D refactor)
// Formatters de plans nutritionnels :
// - decoupage en sections (structurePlanSections)
// - garde anti-doublon supplements
// - heuristique isLikelySupplementName pour eviter les sections parasites

import { cleanPlanForPDF } from './nutritionScoring';
import { detectSectionType } from './nutritionParsers';

// V91.0.1 : noms de supplements en majuscules nues sont parfois interpretes
// comme des headers de section quand ils apparaissent en majuscules nues
// (sans #) au milieu d'une autre section (ex: "MAGNESIUM GLYCINATE" dans
// RECOMMANDATIONS COACH). Sinon le splitter cree des sections parasites
// qui dedoublent la vraie SUPPLEMENTS RECOMMANDES — bug visible sur le PDF
// Melissa avec dosages contradictoires entre les 2 blocs.
export const SUPPLEMENT_NAME_RE = /(GLYCINATE|PICOLINATE|EPA[\/\s]*DHA|VITAMINE\s*[BD]\s*\d|VITAMIN\s*[BD]\s*\d|OMEGA[\s\-]?3|MAGNESIUM|ASHWAGANDHA|PROBIOTIQUES?|PROBIOTICS|BERB[EÉ]RINE|BERBERINE|CHROME(?:\s+PICOLINATE)?|ZINC\s*BISGLYCINATE|D3\s*\+?\s*K2|MULTI[\s-]?SOUCHES|RHODIOLA|CO\s*Q\s*10|GLUTAMINE|COLLAG[EÉ]NE|MELATONINE|QUERCETINE|RESVERATROL|CURCUMA|TURMERIC|SPIRULINE|LACTOFERRINE|NAC|TAURINE)/i;

export function isLikelySupplementName(line) {
  const t = line.trim();
  if (t.length > 50 || t.length < 4) return false;
  if (t !== t.toUpperCase()) return false; // doit etre tout en majuscules
  return SUPPLEMENT_NAME_RE.test(t);
}

export function structurePlanSections(planText, supplementsText, { isFollowup = false, locale = 'FR' } = {}) {
  const raw = [];
  const text = cleanPlanForPDF(planText);
  const lines = text.split('\n');

  let currentTitle = '';
  let currentContent = [];

  const flushSection = () => {
    if (currentTitle || currentContent.length > 0) {
      const content = currentContent.join('\n').trim();
      if (content) {
        raw.push({ title: currentTitle || 'Introduction', content, type: detectSectionType(currentTitle) });
      }
    }
    currentContent = [];
  };

  for (const line of lines) {
    // V91.0.1 : un nom de supplement nu (sans #) ne doit PAS creer de section
    // parasite. On le laisse dans currentContent — il sera rendu comme texte
    // dans la section en cours (typiquement RECOMMANDATIONS COACH ou
    // PROTOCOLES CIBLES) au lieu d'etre splittee en card.
    const isSuppNameNoHash = !line.startsWith('#') && isLikelySupplementName(line);
    const headerMatch = !isSuppNameNoHash && (
      line.match(/^#{1,3}\s+(.+)/) ||
      (line === line.toUpperCase() && line.trim().length > 5 && line.trim().length < 80 ? [null, line.trim()] : null)
    );
    if (headerMatch) {
      flushSection();
      currentTitle = headerMatch[1].trim();
    } else {
      currentContent.push(line);
    }
  }
  flushSection();

  // Deduplicate: merge sections with identical titles (case-insensitive)
  const sections = [];
  const seen = new Map();
  for (const s of raw) {
    const key = s.title.toLowerCase();
    if (seen.has(key)) {
      const existing = seen.get(key);
      existing.content += '\n\n' + s.content;
    } else {
      const entry = { ...s };
      sections.push(entry);
      seen.set(key, entry);
    }
  }

  // Add supplements as separate section
  // V86.9 : si le plan body contient deja une section type 'supplements'
  // (l'IA a parfois inclus les supps dans le plan malgre l'interdit), on ne
  // rajoute PAS un second bloc depuis supplementsText. Sinon, dedoublage visible
  // dans l'editeur et dans le PDF (un bloc EN + un bloc FR legacy).
  const hasSupplementsInPlan = sections.some(s => s.type === 'supplements');
  if (supplementsText?.trim() && !hasSupplementsInPlan) {
    sections.push({
      title: locale === 'EN' ? 'Recommended supplements' : 'Supplements recommandes',
      content: cleanPlanForPDF(supplementsText),
      type: 'supplements',
    });
  }

  // V87 : GARDE ANTI-DUPLICATION FORTE
  // Meme si tout le flow amont est propre, on s'assure en sortie qu'il n'y a
  // JAMAIS plus d'UNE section type 'supplements' dans le resultat. Si l'IA
  // a emis deux blocs supplements (ex : titre EN + titre FR mal normalises,
  // ou une section redondante), on ne garde que le premier et on jette les
  // suivants. Fix garantit qu'aucun doublon ne peut atteindre le PDF.
  let supplementsKept = false;
  const deduped = [];
  for (const s of sections) {
    if (s.type === 'supplements') {
      if (supplementsKept) continue;
      supplementsKept = true;
    }
    deduped.push(s);
  }
  return deduped;
}
