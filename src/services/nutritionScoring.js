// V94.26 : extrait depuis NutritionConsultation.jsx (Phase 1.A refactor)
// Fonctions pures de scoring + validation + nettoyage du plan nutrition.
// Aucune dépendance React/state — peut être testé/utilisé partout.

/**
 * Score le plan sur 4 axes (coherence, simplicity, applicability, constraints).
 * @returns {object} { coherence, simplicity, applicability, constraints, total,
 *                     normalized (0-10), hardFails[], penalties[], notes[],
 *                     hasHardFail }
 */
export function scorePlanQuality(planText, supplementsText, form, { isFollowup = false, followupWeek = 0 } = {}) {
  const plan = (planText || '').toLowerCase();
  const supps = (supplementsText || '').toLowerCase();
  const full = plan + '\n' + supps;
  const hardFails = [];
  const penalties = [];
  const notes = []; // indicateurs secondaires non scores

  // --- Helpers ---
  function extractList(field) {
    return (form?.[field] || '').split(/[,;/]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 2);
  }

  // --- AXIS 1: COHERENCE (constraints respected, no contradictions) ---
  let coherence = 10;

  // NOTE: forbidden food hard-fail check REMOVED.
  // The coach (Anissa) manages intolerances/allergies manually — she knows her clients
  // and will never prescribe forbidden foods. The automated check generated too many
  // false positives (profile text, exclusion mentions, contextual notes) and blocked
  // legitimate exports. Coherence scoring continues below without this axis.

  // Check calorie/macro mentions
  const hasCalories = /\d{3,4}\s*(kcal|calories)/i.test(planText || '');
  const hasMacros = /prot[eé]ines.*\d+\s*g/i.test(planText || '');
  if (!isFollowup) {
    if (!hasCalories) { coherence -= 2; penalties.push('Calories non mentionnees'); }
    if (!hasMacros) { coherence -= 2; penalties.push('Macros non detailles'); }
  } else {
    // Followup: macros/calories moins critiques (ajustements partiels)
    if (!hasCalories && !hasMacros) { coherence -= 1; penalties.push('Macros/calories absents du suivi'); }
  }

  // Penalty (not hard fail): "a limiter" items found in menus
  const limitSection = full.match(/[àa] limiter.*?(?=\n\n|\nsemaine|$)/s);
  if (limitSection) {
    const limitedItems = limitSection[0].match(/[-–•]\s*(.+)/g)?.map(l => l.replace(/^[-–•]\s*/, '').trim().toLowerCase()) || [];
    const menuSection = plan.slice(plan.indexOf('semaine'));
    const contradictions = limitedItems.filter(item => item.length > 3 && menuSection.includes(item));
    if (contradictions.length > 0) {
      coherence -= 2;
      penalties.push(`Aliments "a limiter" dans les menus : ${contradictions.slice(0, 3).join(', ')}`);
    }
  }

  // Followup: clinical priority check (nuanced — needs 3 conditions for hard fail)
  if (isFollowup) {
    const wf = form?._weeklyFeedback || {};
    const digestionDegraded = wf.digestion === 'Degrade';
    const adherenceDegraded = wf.adherence === 'Degrade';
    const hasSimplification = /simplifi|redui|retir|supprimer|alleger/i.test(planText || '');
    const performanceDominant = (() => {
      const perfCount = (plan.match(/performance|entrainement|workout|pre.?workout|post.?workout/gi) || []).length;
      const digiCount = (plan.match(/digestion|digestif|ballonnement|transit|intestin/gi) || []).length;
      return perfCount > 3 && digiCount < 2;
    })();

    if ((digestionDegraded || adherenceDegraded) && performanceDominant && !hasSimplification) {
      hardFails.push('Priorite clinique : digestion/adherence degradee, pas de simplification, optimisation performance dominante');
      coherence = Math.min(coherence, 2);
    } else if (digestionDegraded && !hasSimplification) {
      coherence -= 2;
      penalties.push('Digestion degradee sans simplification visible');
    }
  }

  // Formulations interdites (ton mou / generique)
  if (!isFollowup) {
    const softPhrases = [
      /vous pouvez/gi, /idealement/gi, /si vous souhaitez/gi, /il est conseill[eé]/gi,
      /n'h[eé]sitez pas/gi, /eventuellement/gi, /au choix/gi, /vous pourriez/gi,
      /manger [eé]quilibr[eé]/gi, /varier l'alimentation/gi, /boire suffisamment/gi,
    ];
    let softCount = 0;
    for (const rx of softPhrases) { softCount += (plan.match(rx) || []).length; }
    if (softCount > 0) {
      const penalty = Math.min(softCount, 3); // cap -3
      coherence -= penalty;
      penalties.push(`Formulations molles detectees (${softCount}x)`);
    }
  }

  coherence = Math.max(coherence, 0);

  // --- AXIS 2: SIMPLICITY ---
  let simplicity = 10;

  // Word count (primary measure)
  const wordCount = (planText || '').split(/\s+/).filter(w => w.length > 0).length;
  if (!isFollowup) {
    if (wordCount > 2000) { simplicity -= 3; penalties.push(`Plan trop long (${wordCount} mots, max 1600)`); }
    else if (wordCount > 1600) { simplicity -= 1; penalties.push(`Plan un peu long (${wordCount} mots)`); }
  }

  // Line count (secondary)
  const lineCount = (planText || '').split('\n').filter(l => l.trim()).length;
  if (!isFollowup) {
    if (lineCount > 200) { simplicity -= 2; penalties.push(`Plan tres long (${lineCount} lignes)`); }
    else if (lineCount > 150) { simplicity -= 1; }
  } else {
    if (lineCount > 200) { simplicity -= 3; penalties.push(`Suivi trop long (>${200} lignes)`); }
    else if (lineCount > 120) { simplicity -= 1; }
  }

  // Supplements count
  const suppCount = (supps.match(/\b\d+\s*mg\b/gi) || []).length;
  if (suppCount > 12) { simplicity -= 3; penalties.push(`Trop de supplements (${suppCount})`); }
  else if (suppCount > 8) { simplicity -= 1; }

  // Followup: adjustment count
  if (isFollowup) {
    const adjustmentMatches = plan.match(/^\s*\d+[.)]/gm) || [];
    const maxAdjust = (followupWeek === 1 || followupWeek === 4) ? 3 : 4;
    if (adjustmentMatches.length > maxAdjust + 2) {
      simplicity -= 2;
      penalties.push(`Trop d'ajustements (${adjustmentMatches.length}) pour semaine ${followupWeek}`);
    }
  }

  simplicity = Math.max(simplicity, 0);

  // --- AXIS 3: APPLICABILITY ---
  let applicability = 10;

  const hasQuantities = /\d+\s*g\b/i.test(planText || '');
  const hasMealStructure = /petit.?d[eé]j|d[eé]jeuner|d[iî]ner|collation/i.test(planText || '');
  const hasFichefrigo = /fiche\s*frigo/i.test(planText || '');
  const hasHydration = /hydratation|eau.*litre|litre.*eau|\d+\s*l.*eau/i.test(planText || '');

  if (isFollowup) {
    if (!hasQuantities && !hasMealStructure) { applicability -= 1; penalties.push('Pas de detail concret dans les ajustements'); }
  } else {
    if (!hasQuantities) { applicability -= 2; penalties.push('Quantites absentes'); }
    if (!hasMealStructure) { applicability -= 3; penalties.push('Structure repas absente'); }
    if (!hasFichefrigo) { applicability -= 1; penalties.push('Fiche frigo absente'); }
    if (!hasHydration) { applicability -= 1; }

    const expectedSections = [
      /analyse\s*du\s*profil/i,
      /strat[eé]gie\s*nutritionnelle/i,
      /semaine\s*1/i,
      /rotation/i,
      /fiche\s*frigo/i,
      /protocoles?\s*cibl[eé]s?/i,
      /ajustements?\s*(environnement|entra[iî]nement)/i,
      /recommandations?\s*coach/i,
      /plan\s*d.action/i,
    ];
    const missingSections = expectedSections.filter(rx => !rx.test(planText || ''));
    if (missingSections.length > 3) {
      applicability -= 3; penalties.push(`${missingSections.length} sections manquantes sur 9`);
    } else if (missingSections.length > 0) {
      applicability -= missingSections.length;
      penalties.push(`${missingSections.length} section(s) manquante(s)`);
    }
  }

  applicability = Math.max(applicability, 0);

  // --- AXIS 4: CONSTRAINTS ---
  let constraints = 10;

  const pathologies = extractList('pathologies');
  if (pathologies.length > 0) {
    const addressed = pathologies.filter(p => full.includes(p));
    if (addressed.length === 0) { constraints -= 3; penalties.push('Pathologies non prises en compte'); }
  }

  const sportFreq = form?.frequenceSport || '';
  if (sportFreq && sportFreq !== 'Jamais' && !/entra[iî]nement|sport|workout|repos/i.test(planText || '')) {
    constraints -= 2; penalties.push('Pas d\'adaptation sport');
  }

  constraints = Math.max(constraints, 0);

  // --- SECONDARY INDICATORS (not scored) ---
  if (supps && !/burgerstein|pure encapsulations|nahrin|sekoya/i.test(supps)) {
    notes.push('Aucune marque suisse mentionnee');
  }

  // V96.16 — hardFail "Fiche frigo manquante" SUPPRIME : la fiche frigo est gere
  // dans l'onglet dedie (fiche_frigo_json + fridgeDataBuilder), pas dans la
  // section 5 du plan textuel. Faux positif a ne plus declencher.

  // --- TOTALS ---
  const total = coherence + simplicity + applicability + constraints;
  const normalized = Math.round((total / 40) * 100) / 10;

  return {
    coherence,
    simplicity,
    applicability,
    constraints,
    total,
    normalized,
    hardFails,
    penalties,
    notes,
    hasHardFail: hardFails.length > 0,
  };
}

/** Decide si le plan necessite une correction automatique. */
export function shouldAutoCorrect(score) {
  if (!score) return false;
  return score.hasHardFail || score.normalized < 6.5 || score.coherence < 6 || score.constraints < 6;
}

/** Construit le prompt de correction pour l'IA. */
export function buildCorrectionPrompt(planText, score, form, auditResult) {
  return `Tu recois un plan nutritionnel qui contient des problemes de qualite. Corrige-le.

ECHECS CRITIQUES :
${score.hardFails.length > 0 ? score.hardFails.map(p => `- ${p}`).join('\n') : '- Aucun'}

PENALITES :
${score.penalties.length > 0 ? score.penalties.map(p => `- ${p}`).join('\n') : '- Aucune'}

SCORES ACTUELS :
- Coherence : ${score.coherence}/10
- Simplicite : ${score.simplicity}/10
- Applicabilite : ${score.applicability}/10
- Contraintes : ${score.constraints}/10
- Global : ${score.normalized}/10

${auditResult ? `AUDIT DE COHERENCE :\n${auditResult}\n\n` : ''}CONTRAINTES CLIENT :
- Allergies : ${form?.allergies || 'Aucune'}
- Aliments evites : ${form?.alimentsEvites || 'Aucun'}
- Pathologies : ${form?.pathologies || 'Aucune'}
- Traitements : ${form?.traitements || 'Aucun'}
- Sport : ${form?.frequenceSport || 'Non renseigne'}

PLAN A CORRIGER :
${planText}

REGLES DE CORRECTION :
1. Supprimer tout aliment interdit (allergies, intolerances) des menus
2. Corriger les contradictions entre sections "a limiter" et menus
3. Si coherence macros/calories insuffisante : ajouter ou corriger les totaux
4. Si trop complexe : simplifier (moins de supplements, menus plus courts)
5. Si digestion/adherence en cause : privilegier des aliments neutres et simples
6. Conserver au maximum ce qui fonctionne — ne pas reecrire les sections sans probleme
7. Ne PAS ajouter de commentaires sur les corrections — renvoyer uniquement le plan corrige
8. Ne PAS introduire de nouveaux aliments interdits

Renvoie le plan complet corrige, pret a etre utilise.`;
}

/**
 * Valide qu'un plan peut etre exporte en PDF (placeholders, contenu vague,
 * sections en double, contradictions supplements, etc.).
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePlanForPDF(planText, planScore, { isFollowup = false } = {}) {
  const errors = [];
  const text = (planText || '').toLowerCase();

  // Hard fail from scoring blocks export
  if (planScore?.hasHardFail) {
    errors.push(...planScore.hardFails.map(h => `Echec critique : ${h}`));
  }

  // Placeholders
  const placeholderPatterns = [
    /\[a completer\]/i, /\[todo\]/i, /\[placeholder\]/i, /\[insert/i,
    /\.\.\.a definir/i, /lorem ipsum/i, /\[\.{3,}\]/,
  ];
  for (const pat of placeholderPatterns) {
    if (pat.test(text)) errors.push(`Placeholder detecte : ${pat.source}`);
  }

  // Lazy/vague content
  const lazyPhrases = ['menus adaptes', 'routine optimisee', 'selon vos besoins', 'a personnaliser selon'];
  const lazyFound = lazyPhrases.filter(p => text.includes(p));
  if (lazyFound.length >= 2) {
    errors.push(`Contenu trop vague (${lazyFound.join(', ')})`);
  }

  // Minimum content length
  const minLength = isFollowup ? 100 : 200;
  if ((planText || '').trim().length < minLength) {
    errors.push('Contenu trop court');
  }

  // Duplicate section headings
  const REPEATABLE_HEADINGS = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|petit.?d[eé]j|d[eé]jeuner|d[iî]ner|collation|jour\s+\d|option|variante|alternative|liste de courses)/i;
  const headings = (planText || '').match(/^#{1,3}\s+.+$/gm) || [];
  const headingTexts = headings.map(h => h.replace(/^#+\s+/, '').trim().toLowerCase());
  const seen = new Set();
  for (const h of headingTexts) {
    if (REPEATABLE_HEADINGS.test(h)) continue;
    if (seen.has(h)) errors.push(`Section en double : "${h}"`);
    seen.add(h);
  }

  // Supplement timing contradictions
  if (/\bfer\b/.test(text) && /fer.*soir|soir.*fer/i.test(text) && !/jamais.*fer.*soir|eviter.*fer.*soir/i.test(text)) {
    errors.push('Supplement : fer mentionne le soir');
  }
  if (/coq10.*soir|soir.*coq10/i.test(text) && !/jamais.*soir|eviter.*soir/i.test(text)) {
    errors.push('Supplement : CoQ10 mentionne le soir');
  }

  // Supplement coherence
  const hasTableau = /tableau horaire/i.test(text);
  const hasSupplementSection = /supplements?\s*recommand/i.test(text);
  if (hasTableau && hasSupplementSection) {
    const tableauSection = text.slice(text.indexOf('tableau horaire'));
    const suppSection = text.slice(text.indexOf('supplement'), text.indexOf('tableau horaire') > 0 ? text.indexOf('tableau horaire') : undefined);
    if (tableauSection.includes('magnesium') && !suppSection.includes('magnesium')) {
      errors.push('Incoherence : magnesium dans le tableau mais absent des recommandations');
    }
  }

  // V96.16 — check "section 5 FICHE FRIGO" SUPPRIME (la fiche frigo est gere
  // dans l'onglet dedie via fridgeDataBuilder, faux positif). Les autres
  // sections (1-4, 6-8) restent verifiees pour detecter de vrais saut de
  // contenu structurel — Anissa peut juger en regardant le plan texte.
  if (!isFollowup) {
    const REQUIRED_SECTIONS = [
      { regex: /(^|\n)\s*##?\s*1\.|analyse\s*du\s*profil/i, label: 'Analyse du profil (section 1)' },
      { regex: /(^|\n)\s*##?\s*2\.|strategie\s*nutritionnelle/i, label: 'Strategie nutritionnelle (section 2)' },
      { regex: /(^|\n)\s*##?\s*3\.|semaine\s*1/i, label: 'Semaine 1 (section 3)' },
      { regex: /(^|\n)\s*##?\s*4\.|alternatives\s*par\s*repas/i, label: 'Alternatives par repas (section 4)' },
      { regex: /(^|\n)\s*##?\s*6\.|protocoles\s*cibles/i, label: 'Protocoles cibles (section 6)' },
      { regex: /(^|\n)\s*##?\s*7\.|ajustements\s*environnementaux/i, label: 'Ajustements environnementaux (section 7)' },
      { regex: /(^|\n)\s*##?\s*8\.|recommandations\s*coach/i, label: 'Recommandations coach (section 8)' },
    ];
    for (const { regex, label } of REQUIRED_SECTIONS) {
      if (!regex.test(planText || '')) {
        errors.push(`Section obligatoire manquante : ${label}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Nettoie le plan markdown pour export PDF (strip cover/branding/audit). */
export function cleanPlanForPDF(planText) {
  let text = planText || '';

  text = text.replace(/\n---\n\nAUDIT DE COHERENCE :[\s\S]*$/, '');
  text = text.replace(/^PLAN NUTRITION(?:NEL)?\s*PERSONNALIS[EÉ]?\s*$/gmi, '');
  text = text.replace(/^PROTOCOLE NUTRITIONNEL.*$/gmi, '');
  text = text.replace(/^Anissa Deroubaix.*$/gmi, '');
  text = text.replace(/^AB Coaching.*$/gmi, '');
  text = text.replace(/^Rue de Rive.*$/gmi, '');
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/^[–—]\s/gm, '- ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.split('\n').map(l => l.trimEnd()).join('\n').trim();

  return text;
}
