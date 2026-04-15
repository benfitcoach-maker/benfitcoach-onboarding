import { useState, useEffect, useRef } from 'react';
import { getClient, getNutritionConsultations, savePlanVersion, getPlanVersions, saveClient, saveDraft, loadDraft, clearDraft } from './store';
import { supabase, isCloudEnabled } from './supabaseClient';
import { FORMULES } from './formSteps';
import NutritionTemplates from './NutritionTemplates';
import NutritionEditor from './NutritionEditor';
import FicheFrigoPreview from './FicheFrigoPreview';
import MedicalSummary from './MedicalSummary';
import FollowUpStep, { buildFollowupSummary } from './FollowUpStep';
import { exportConsultationPDF, exportFicheFrigoPDF, exportCoverPDF, exportClientPackPDF, extractFridgeDataFromSections, extractMeals, extractSupplements } from './nutritionPdf';
import { buildSuggestions, getScoreColor, getScoreLabel } from './services/planAnalysis';
import { analyzeFullPlan } from './services/aiClient';
import { optimizeSection, optimizeAllSections } from './services/aiPlanOptimizer';
import { SmartTextarea } from './KeywordHints';
import ContraIndicationAlert, { detectContraIndications } from './ContraIndicationAlert';
import { getEnrichedMGDRecommendations } from './mgdAnalysisMatrix';
import { analyzeLabResults } from './labInterpretationEngine';
import { buildMGDCorrelation, formatCorrelationForPrompt } from './mgd/mgdCorrelation';

// ─── PROMPT MODULES (composition conditionnelle) ───

const SYSTEM_PROMPT = `Tu es un coach en nutrition specialise en optimisation de la sante, de l'energie, de la composition corporelle et de la longevite.

Ta mission : creer un plan nutritionnel 100% personnalise, directement applicable, sans reflexion necessaire pour le client.
Le plan est un protocole d'execution, pas une explication.

METHODE D'ANALYSE OBLIGATOIRE :
1. Identifier le probleme principal du client
2. Identifier 2 problemes secondaires
3. Identifier les facteurs bloquants
4. Evaluer le niveau de discipline reel
5. Adapter la difficulte du plan au profil reel

PRIORISATION :
- Le probleme principal doit guider au moins 70% des decisions du plan : choix alimentaires, protocoles, ajustements, recommandations
- Les 2 autres problemes restent secondaires — traites uniquement si compatibles avec l'axe principal
- Si plusieurs strategies sont possibles, choisir la plus efficace et ignorer les autres
- Priorite clinique : pathologie > digestion > energie > objectif
- Le probleme principal doit influencer la structure des repas, les choix alimentaires, les protocoles et les recommandations. Ne pas equilibrer les problemes, forcer un axe dominant.

DECISION CLINIQUE PRIORITAIRE :
Aucune recommandation ne doit etre standard ou generique.
Chaque choix alimentaire doit repondre directement a un probleme physiologique identifie.
Si une recommandation est correcte mais generique, la remplacer par une version plus specifique et ciblee.
Toujours privilegier la precision metabolique a la simplicite generique.

LOGIQUE PHYSIOLOGIQUE AVANCEE :
Le plan doit reposer sur une logique metabolique implicite, meme sans donnees biologiques.
Simuler une lecture clinique a partir des symptomes et du profil :
- Glycemie instable (fringales, fatigue post-repas, antecedents familiaux) → stabilisation insulinique
- Dysbiose / digestion fragile (ballonnements, inconfort) → reduction charge digestive + soutien microbiote
- Stress / fatigue (sommeil court, stress eleve) → gestion cortisol + stabilite energetique
- Inflammation latente (fatigue, retention, inconfort) → reduction aliments pro-inflammatoires
Chaque decision alimentaire doit refleter cette logique, sans jamais l'expliquer.
Le plan doit donner l'impression d'etre base sur des biomarqueurs, meme s'ils ne sont pas fournis.

APPROCHE BIOMARQUEURS IMPLICITES :
Sans jamais mentionner de valeurs biologiques :
- Simuler une optimisation de : glycemie, inflammation, cortisol, sante digestive
- Les recommandations doivent sembler ciblees et precises, comme si basees sur des analyses
- Ne jamais citer de marqueurs, uniquement agir comme si ils etaient connus

ADAPTATION :
- Respecter strictement allergies, intolerances, aliments problematiques, preferences, rythme de vie
- Adapter le nombre de repas au profil reel
- Choisir pour le client, ne pas proposer un catalogue d'options
- Le plan doit etre specifique, differenciant, non generique
- Calories/macros : calculer avec Mifflin-St Jeor — la journee entiere doit etre coherente
- Aucun aliment interdit ne doit apparaitre dans les menus
- Si donnee manquante → ecrire exactement : "a individualiser"

TIMING NUTRITIONNEL (CHRONOLOGIE) :
Organiser les repas selon la physiologie :
- Matin : stabilisation glycemique et cortisol (proteines + lipides, limiter sucres rapides)
- Midi : repas principal metabolique (densite nutritionnelle, glucides complexes si necessaire)
- Soir : digestion facile, charge reduite, favoriser recuperation. Le diner doit etre plus simple, plus digestible et moins dense que le dejeuner. Eviter les melanges complexes et la surcharge digestive.
Adapter selon le profil :
- Si fatigue → renforcer petit-dejeuner
- Si digestion fragile → alleger diner
- Si fringales → structurer les apports dans la journee
Le diner est adapte au probleme principal :
- Digestion : repas tres digestible, faible charge digestive
- Glycemie : limiter les pics insuliniques, eviter les combinaisons a forte charge glycemique
- Cortisol : favoriser un effet apaisant et stabilisant
Le timing doit etre optimise sans etre explique.

NIVEAU DE DIFFICULTE :
- Simple = client peu structure, faible discipline, execution minimale
- Modere = client capable de suivre une structure claire avec quelques ajustements
- Strict = client tres discipline, capable d'un protocole precis
- Choisir un seul niveau et l'assumer

REGLES :
- Systeme metrique (grammes, ml, kg). Prix adaptes Suisse.
- Aliments de saison, locaux, biologiques.
- JAMAIS de medicaments — uniquement supplements nutritionnels.
- Aucune valeur medicale brute (conformite nLPD Suisse).
- Ne JAMAIS citer de references par nom. Le plan doit sembler venir de l'expertise d'Anissa.

STYLE :
- Ton de coach expert : decisions claires, imposees calmement, sans justification excessive
- Le coach sait ce qui est bon pour le client — il ne demande pas, il prescrit
- Utiliser : faire, supprimer, ajouter, remplacer, imposer, garder
- Chaque recommandation liee implicitement a un probleme du client — le lien doit etre evident sans explication
- Le client ne doit jamais avoir a reflechir ou choisir
- Le plan doit etre impossible a confondre avec un plan standard internet
- Chaque detail doit montrer un raisonnement implicite avance

INTERDIT :
- "vous pouvez", "idealement", "si vous souhaitez", "il est conseille", "manger equilibre", "varier l'alimentation", "boire suffisamment d'eau"
- Conseils vagues ou generiques qui s'appliqueraient a n'importe qui
- Recommandations sans lien direct avec les donnees du profil
- Explications biologiques, justifications longues, paragraphes longs, repetitions
- Contenu generique ou ton hesitant
- Parentheses explicatives dans les listes (ex : "epinard (riche en magnesium)" → ecrire juste "epinard")`;

const SWISS_BRANDS_PROMPT = `
CONTEXTE SUISSE :
Recommande des complements disponibles en Suisse. Cite une marque entre parentheses :
- Burgerstein (pharmacie), Pure Encapsulations (pro), Nahrin (rapport qualite/prix), Sekoya (digestif/mobilite).`;

const SUPPLEMENT_PROMPT = `
SUPPLEMENTS :
- Source alimentaire naturelle EN PREMIER pour chaque nutriment. Complement en option si insuffisant.
- Moment de prise obligatoire : matin a jeun (fer, probiotiques), matin (D3+K2, B-complexe), midi/soir (omega-3, zinc), coucher (magnesium).
- Associations obligatoires : D3+K2+Mg, Fer+VitC, Curcuma+Piperine+gras, Collagene+VitC.
- Interdictions : Fer jamais avec cafe/the/calcium (2h min). Calcium jamais avec Mg (2h). Pas de CoQ10/B12/Rhodiola le soir. Zinc >8 sem → ajouter Cuivre.
- Terminer par un TABLEAU HORAIRE PERSONNALISE (matin a jeun / petit-dej / midi / soir / coucher).`;

const FOUR_WEEKS_PROMPT = `
Produis le plan strictement avec les sections suivantes, dans cet ordre, sans rien ajouter avant ou apres.
1200 a 1600 mots maximum pour l'ensemble.

## 1. ANALYSE DU PROFIL
Format tres court. Inclure uniquement :
- Objectif principal
- Probleme principal
- 2 problemes secondaires
- Facteurs bloquants
- Niveau de difficulte du plan
Maximum 5 lignes.

## 2. STRATEGIE NUTRITIONNELLE
Donner UNE strategie centrale unique. Inclure :
- Axe principal
- Structure alimentaire imposee
- Priorites d'action
- Ajustements cles
Maximum 5 puces.

## 3. SEMAINE 1 — STRUCTURE ALIMENTAIRE
Donner une journee type claire et directement applicable.
Format :
Petit-dejeuner :
Dejeuner :
Diner :
Collation :
1 ligne maximum par repas.

## 4. ROTATION DES REPAS
Donner uniquement des remplacements utiles.
- 2 rotations proteines
- 2 rotations feculents
- 2 substitutions rapides
Rester tres concis.

## 5. FICHE FRIGO
Format ultra court.
PETIT-DEJEUNER — 2 options max
DEJEUNER — 2 options max
DINER — 2 options max
COLLATION — 2 options max
ALIMENTS AUTORISES — liste simple
ALIMENTS LIMITES — liste simple
ALIMENTS INTERDITS — liste simple
Aucun texte explicatif. Aucune parenthese. Aucun commentaire.

## 6. PROTOCOLES CIBLES
Maximum 3 protocoles. Uniquement si justifies par le profil.
Format par protocole :
Nom :
- action 1
- action 2
- action 3
1 ligne maximum par action. Aucune progression semaine par semaine.

## 7. AJUSTEMENTS ENVIRONNEMENTAUX
Inclure seulement les ajustements utiles sur :
- Hydratation
- Sommeil
- Rythme de vie
Maximum 5 puces.

## 8. RECOMMANDATIONS COACH
- 3 regles directes (ton affirmatif uniquement)
- 3 erreurs a eviter
- 1 focus prioritaire pour les 2 prochaines semaines

## 9. PLAN D'ACTION
Progression logique obligatoire :
Semaine 1 — Mise en place : installer les bases, supprimer les blocages
Semaine 2 — Stabilisation : ancrer les habitudes, ajuster si necessaire
Semaine 3 — Optimisation : affiner timing, quantites, protocoles
Semaine 4 — Automatisation : rendre le plan autonome, preparer la suite
1 a 2 actions concretes maximum par semaine.
Chaque semaine doit refleter une progression sur le probleme principal, pas une structure generique.
Chaque semaine doit produire un effet physiologique different et identifiable sur le probleme principal.
La progression doit suivre une logique : mise en place → stabilisation → optimisation → automatisation.
Interdit : progression generique ou interchangeable.

REGLES DE SORTIE :
- Aucune section bonus, aucune annexe, aucun resume supplementaire
- Aucun tableau de supplements (gere separement)
- Aucune conclusion, aucun commentaire de wordcount
- Stop strict apres la section 9`;

const AUDIT_PROMPT = `Tu es un auditeur nutrition. Analyse ce plan nutritionnel et verifie :

1. ALLERGIES/INTOLERANCES : aucun aliment interdit ne doit apparaitre dans les menus
2. COHERENCE MACROS : les macros de chaque repas doivent etre coherents avec le total calcule
3. CONTRADICTIONS : aucune recommandation ne doit contredire une autre section
4. SUPPLEMENTS : si presents, verifier timing correct et pas de combinaisons interdites
5. COMPLETUDE : toutes les sections attendues sont presentes

Pour chaque probleme trouve :
- Decris le probleme
- Indique la correction exacte

Si aucun probleme : reponds "AUDIT OK — aucune incoherence detectee."
Si problemes : liste-les et fournis le texte corrige pour chaque section concernee.`;

// Helper: build the system prompt with conditional modules
// fullPlan: true = plan 4 semaines (premiere consultation), false = ajustements (suivi)
function buildSystemPrompt(form, { isFollowup = false, clientFormule = '', followupWeek = 0 } = {}) {
  const parts = [SYSTEM_PROMPT, SWISS_BRANDS_PROMPT];

  // Supplements: include if client is open to them (Oui or Peut-etre)
  const pretProtocole = form?.pretProtocole || '';
  if (pretProtocole === 'Oui' || pretProtocole === 'Peut-etre') {
    parts.push(SUPPLEMENT_PROMPT);
  }

  if (isFollowup && followupWeek > 0) {
    // Followup: progressive adjustment prompt based on week number
    parts.push(buildFollowupPrompt(followupWeek));
  } else {
    // 4-week plan: include for formules with ongoing nutritional follow-up
    const recurrentFormules = ['suivi', 'intensif', 'autonome', 'nutrition', 'custom'];
    const normalizedFormule = (clientFormule || '').trim().toLowerCase();
    const isFullPlanFormule = recurrentFormules.includes(normalizedFormule);
    if (isFullPlanFormule) {
      parts.push(FOUR_WEEKS_PROMPT);
    }
  }

  return parts.join('\n\n');
}

// ─── FOLLOWUP WEEKLY PROMPTS ───

const INITIAL_WEEKLY_FEEDBACK = {
  energy: '',
  digestion: '',
  hunger: '',
  adherence: '',
  performance: '',
  cravings: '',
  notes: '',
};

const FOLLOWUP_WEEK_INSTRUCTIONS = {
  1: `SEMAINE 1 — TOLERANCE & ADHERENCE :
- Objectif : evaluer la tolerance au plan initial et l'adherence du client.
- Ajustements autorises : MINIMES (digestion, portions, horaires repas).
- Ne PAS modifier les macros ni la structure globale.
- Si adherence faible : simplifier, pas complexifier.
- Si troubles digestifs : reduire fibres/fermentes, revenir a des aliments neutres.
- Maximum 2-3 ajustements concrets.`,

  2: `SEMAINE 2 — PREMIERS AJUSTEMENTS :
- Objectif : ajuster energie, faim et digestion selon le feedback.
- Ajustements autorises : portions, repartition glucides, timing collations, hydratation.
- Si faim excessive : augmenter proteines ou ajouter collation.
- Si energie basse : verifier glucides pre-entrainement et sommeil.
- Si digestion ok : introduction progressive d'aliments plus varies.
- Maximum 3-4 ajustements concrets.`,

  3: `SEMAINE 3 — OPTIMISATION :
- Objectif : optimiser portions, timing, recuperation et performance.
- Ajustements autorises : macros fins, timing peri-entrainement, supplements si pertinent.
- Si performance stagne : ajuster glucides autour de l'effort.
- Si cravings persistantes : verifier deficits (magnesium, chrome, sommeil).
- Commencer a preparer l'autonomie du client.
- Maximum 3-4 ajustements concrets.`,

  4: `SEMAINE 4 — CONSOLIDATION & AUTONOMIE :
- Objectif : consolider les acquis, preparer le client a etre autonome.
- Proposer des substitutions pour varier sans perdre l'equilibre.
- Valider les habitudes installees, identifier celles a renforcer.
- Fournir un mini-guide d'autonomie : quoi faire si voyage, restaurant, fatigue.
- Ajustements uniquement si necessaire — stabiliser.
- Maximum 2-3 ajustements concrets.`,
};

function buildFollowupPrompt(weekNum) {
  const week = Math.min(Math.max(weekNum || 1, 1), 4);
  return `
CONSULTATION DE SUIVI — SEMAINE ${week}/4

Tu generes un AJUSTEMENT du plan existant, PAS un nouveau plan complet.
Le client suit deja un protocole nutritionnel. Tu dois :
1. Analyser le feedback hebdomadaire du client
2. Comparer avec les objectifs initiaux
3. Proposer des ajustements cibles et progressifs

PRIORITE CLINIQUE DU SUIVI (TOUJOURS respecter cet ordre) :
digestion > adherence > energie > faim/cravings > performance > objectif
Si digestion ou adherence sont mauvaises → simplifier le plan avant toute optimisation.
Ne jamais optimiser timing/portions/performance si la base (digestion + adherence) n'est pas stable.

${FOLLOWUP_WEEK_INSTRUCTIONS[week]}

FORMAT DE SORTIE :
- BILAN DE LA SEMAINE : resume factuel du feedback (3-5 lignes)
- AJUSTEMENTS PROPOSES : liste numerotee, chaque ajustement = 1 action concrete
- PLAN MIS A JOUR : uniquement les repas/jours modifies (pas tout le plan)
- PROCHAINE ETAPE : ce que le client doit observer pour la semaine suivante`;
}

const SUPPLEMENTS_INSTRUCTION = `Genere SEPAREMENT la section SUPPLEMENTS RECOMMANDES.
Pour chaque supplement :
1. Source alimentaire naturelle (aliments, quantites)
2. Si insuffisant : complement avec dosage, moment de prise, forme biodisponible, marque suisse
3. Justification basee sur le profil client
4. Interactions a eviter
Termine par le TABLEAU HORAIRE PERSONNALISE. Ecris uniquement cette section.`;

// ─── PLAN QUALITY SCORING ───

function scorePlanQuality(planText, supplementsText, form, { isFollowup = false, followupWeek = 0 } = {}) {
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
      // Count performance vs digestion mentions in plan
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

  // --- AXIS 3: APPLICABILITY (contextual to plan type) ---
  let applicability = 10;

  const hasQuantities = /\d+\s*g\b/i.test(planText || '');
  const hasMealStructure = /petit.?d[eé]j|d[eé]jeuner|d[iî]ner|collation/i.test(planText || '');
  const hasFichefrigo = /fiche\s*frigo/i.test(planText || '');
  const hasHydration = /hydratation|eau.*litre|litre.*eau|\d+\s*l.*eau/i.test(planText || '');

  if (isFollowup) {
    // Followup: meal structure and quantities less critical
    if (!hasQuantities && !hasMealStructure) { applicability -= 1; penalties.push('Pas de detail concret dans les ajustements'); }
  } else {
    // Plan initial: full expectations
    if (!hasQuantities) { applicability -= 2; penalties.push('Quantites absentes'); }
    if (!hasMealStructure) { applicability -= 3; penalties.push('Structure repas absente'); }
    if (!hasFichefrigo) { applicability -= 1; penalties.push('Fiche frigo absente'); }
    if (!hasHydration) { applicability -= 1; }

    // Section completeness: check 9 expected sections
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

  // --- AXIS 4: CONSTRAINTS (respects client profile) ---
  let constraints = 10;

  // NOTE: forbidden food constraint check removed (coach manages manually)

  // Pathologies addressed
  const pathologies = extractList('pathologies');
  if (pathologies.length > 0) {
    const addressed = pathologies.filter(p => full.includes(p));
    if (addressed.length === 0) { constraints -= 3; penalties.push('Pathologies non prises en compte'); }
  }

  // Sport adaptation
  const sportFreq = form?.frequenceSport || '';
  if (sportFreq && sportFreq !== 'Jamais' && !/entra[iî]nement|sport|workout|repos/i.test(planText || '')) {
    constraints -= 2; penalties.push('Pas d\'adaptation sport');
  }

  constraints = Math.max(constraints, 0);

  // --- SECONDARY INDICATORS (not scored) ---
  if (supps && !/burgerstein|pure encapsulations|nahrin|sekoya/i.test(supps)) {
    notes.push('Aucune marque suisse mentionnee');
  }

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

// Score display component
function PlanQualityScore({ score, autoCorrected }) {
  if (!score) return null;

  const getColor = (val, max = 10) => {
    const pct = val / max;
    if (pct >= 0.8) return '#2a9d5c';
    if (pct >= 0.6) return '#e8a040';
    return '#d45c4c';
  };

  const axes = [
    { key: 'coherence', label: 'Coherence', desc: 'Allergies, macros, contradictions, ton' },
    { key: 'simplicity', label: 'Simplicite', desc: 'Mots, lignes, nb supplements' },
    { key: 'applicability', label: 'Applicabilite', desc: 'Quantites, structure, sections, fiche frigo' },
    { key: 'constraints', label: 'Contraintes', desc: 'Pathologies, sport, profil client' },
  ];

  return (
    <div style={{ background: 'rgba(124,92,191,.06)', border: '1px solid rgba(124,92,191,.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <strong style={{ fontSize: '.9rem' }}>Score du plan actuel</strong>
        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: getColor(score.normalized) }}>
          {score.normalized}/10
        </span>
      </div>

      {autoCorrected && (
        <div style={{ background: 'rgba(42,157,92,.1)', border: '1px solid rgba(42,157,92,.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '.8rem', color: '#2a9d5c', fontWeight: 600 }}>
          Auto-correction appliquee — le plan a ete corrige automatiquement
        </div>
      )}

      {score.hasHardFail && (
        <div style={{ background: 'rgba(212,92,76,.12)', border: '1px solid rgba(212,92,76,.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '.8rem', color: '#d45c4c', fontWeight: 600 }}>
          ECHEC CRITIQUE : {score.hardFails.join(' | ')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {axes.map(({ key, label, desc }) => (
          <div key={key} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '.78rem', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: '.78rem', fontWeight: 700, color: getColor(score[key]) }}>{score[key]}/10</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 4 }}>
              <div style={{ height: '100%', width: `${score[key] * 10}%`, background: getColor(score[key]), borderRadius: 4, transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: '.68rem', color: '#6b5f48', marginTop: 3 }}>{desc}</div>
          </div>
        ))}
      </div>

      {score.penalties.length > 0 && (
        <div style={{ marginTop: 8, fontSize: '.72rem', color: '#8a8a7a' }}>
          Penalites : {score.penalties.join(' · ')}
        </div>
      )}
      {score.notes.length > 0 && (
        <div style={{ marginTop: 4, fontSize: '.68rem', color: '#5f5848', fontStyle: 'italic' }}>
          Notes : {score.notes.join(' · ')}
        </div>
      )}
    </div>
  );
}

// ─── AUTO-CORRECTION ───

function shouldAutoCorrect(score) {
  if (!score) return false;
  return score.hasHardFail || score.normalized < 6.5 || score.coherence < 6 || score.constraints < 6;
}

function buildCorrectionPrompt(planText, score, form, auditResult) {
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

// ─── LEARNING SIGNAL ───

const LEARNING_LOG_KEY = 'bfc_nutrition_learning';

function buildLearningSignal(form, { isFollowup, followupWeek, initialScore, finalScore, autoCorrected }) {
  return {
    timestamp: new Date().toISOString(),
    isFollowup,
    followupWeek: followupWeek || null,
    profile: {
      hasAllergies: !!(form?.allergies || '').trim(),
      hasPathologies: !!(form?.pathologies || '').trim(),
      hasSport: !!(form?.frequenceSport && form.frequenceSport !== 'Jamais'),
      hasSupplements: form?.pretProtocole === 'Oui' || form?.pretProtocole === 'Peut-etre',
      formule: form?._clientFormule || null,
    },
    initialScore: initialScore ? {
      normalized: initialScore.normalized,
      coherence: initialScore.coherence,
      simplicity: initialScore.simplicity,
      applicability: initialScore.applicability,
      constraints: initialScore.constraints,
      hasHardFail: initialScore.hasHardFail,
      hardFails: initialScore.hardFails,
      penalties: initialScore.penalties,
    } : null,
    finalScore: finalScore ? {
      normalized: finalScore.normalized,
      coherence: finalScore.coherence,
      simplicity: finalScore.simplicity,
      applicability: finalScore.applicability,
      constraints: finalScore.constraints,
      hasHardFail: finalScore.hasHardFail,
      hardFails: finalScore.hardFails,
      penalties: finalScore.penalties,
    } : null,
    autoCorrected,
  };
}

function saveLearningSignal(signal) {
  try {
    const logs = JSON.parse(localStorage.getItem(LEARNING_LOG_KEY) || '[]');
    logs.push(signal);
    // Keep last 50 entries
    if (logs.length > 50) logs.splice(0, logs.length - 50);
    localStorage.setItem(LEARNING_LOG_KEY, JSON.stringify(logs));
  } catch { /* silent */ }
}

function getLearningInsights() {
  try {
    const logs = JSON.parse(localStorage.getItem(LEARNING_LOG_KEY) || '[]');
    if (logs.length === 0) return null;

    const total = logs.length;
    const autoCorrectedCount = logs.filter(l => l.autoCorrected).length;
    const initialHardFailCount = logs.filter(l => l.initialScore?.hasHardFail).length;
    const finalHardFailCount = logs.filter(l => l.finalScore?.hasHardFail).length;

    // Top penalties (flatten + count)
    const penaltyCounts = {};
    for (const log of logs) {
      for (const p of (log.initialScore?.penalties || [])) {
        penaltyCounts[p] = (penaltyCounts[p] || 0) + 1;
      }
    }
    const topPenalties = Object.entries(penaltyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([penalty, count]) => ({ penalty, count, pct: Math.round((count / total) * 100) }));

    // Average scores
    const avgInitial = logs.reduce((s, l) => s + (l.initialScore?.normalized || 0), 0) / total;
    const avgFinal = logs.reduce((s, l) => s + (l.finalScore?.normalized || l.initialScore?.normalized || 0), 0) / total;

    // Profile patterns in corrections
    const correctedLogs = logs.filter(l => l.autoCorrected);
    const profilePatterns = {};
    for (const log of correctedLogs) {
      const p = log.profile;
      if (p.hasAllergies) profilePatterns['allergies'] = (profilePatterns['allergies'] || 0) + 1;
      if (p.hasPathologies) profilePatterns['pathologies'] = (profilePatterns['pathologies'] || 0) + 1;
      if (p.hasSport) profilePatterns['sport'] = (profilePatterns['sport'] || 0) + 1;
    }

    return {
      total,
      autoCorrectionRate: Math.round((autoCorrectedCount / total) * 100),
      initialHardFailRate: Math.round((initialHardFailCount / total) * 100),
      finalHardFailRate: Math.round((finalHardFailCount / total) * 100),
      avgScoreInitial: Math.round(avgInitial * 10) / 10,
      avgScoreFinal: Math.round(avgFinal * 10) / 10,
      topPenalties,
      profilePatterns,
    };
  } catch { return null; }
}

// ─── PDF VALIDATION & CLEANUP (body nutrition uniquement, pas de cover) ───

function validatePlanForPDF(planText, planScore, { isFollowup = false } = {}) {
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

  // Lazy/vague content (AI sometimes outputs filler)
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

  // Duplicate section headings (major sections only)
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

  // Supplement coherence: if tableau horaire exists, check it doesn't contradict the text
  const hasTableau = /tableau horaire/i.test(text);
  const hasSupplementSection = /supplements?\s*recommand/i.test(text);
  if (hasTableau && hasSupplementSection) {
    // Check for supplements in tableau but not in text body (or vice versa)
    const tableauSection = text.slice(text.indexOf('tableau horaire'));
    const suppSection = text.slice(text.indexOf('supplement'), text.indexOf('tableau horaire') > 0 ? text.indexOf('tableau horaire') : undefined);
    if (tableauSection.includes('magnesium') && !suppSection.includes('magnesium')) {
      errors.push('Incoherence : magnesium dans le tableau mais absent des recommandations');
    }
  }

  return { valid: errors.length === 0, errors };
}

function cleanPlanForPDF(planText) {
  let text = planText || '';

  // Remove audit section (internal)
  text = text.replace(/\n---\n\nAUDIT DE COHERENCE :[\s\S]*$/, '');

  // Remove cover/branding that may leak from AI
  text = text.replace(/^PLAN NUTRITION(?:NEL)?\s*PERSONNALIS[EÉ]?\s*$/gmi, '');
  text = text.replace(/^PROTOCOLE NUTRITIONNEL.*$/gmi, '');
  text = text.replace(/^Anissa Deroubaix.*$/gmi, '');
  text = text.replace(/^AB Coaching.*$/gmi, '');
  text = text.replace(/^Rue de Rive.*$/gmi, '');

  // Remove markdown fences
  text = text.replace(/```[\s\S]*?```/g, '');

  // Normalize dashes and bullets
  text = text.replace(/^[–—]\s/gm, '- ');

  // Clean excessive blank lines (3+ → 2)
  text = text.replace(/\n{3,}/g, '\n\n');

  // Trim lines
  text = text.split('\n').map(l => l.trimEnd()).join('\n').trim();

  return text;
}

function structurePlanSections(planText, supplementsText, { isFollowup = false } = {}) {
  const raw = [];
  const text = cleanPlanForPDF(planText);
  const lines = text.split('\n');

  let currentTitle = '';
  let currentContent = [];

  const flushSection = () => {
    if (currentTitle || currentContent.length > 0) {
      const content = currentContent.join('\n').trim();
      if (content) {
        raw.push({ title: currentTitle || 'Introduction', content, type: classifySection(currentTitle) });
      }
    }
    currentContent = [];
  };

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,3}\s+(.+)/) ||
      (line === line.toUpperCase() && line.trim().length > 5 && line.trim().length < 80 ? [null, line.trim()] : null);
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
  if (supplementsText?.trim()) {
    sections.push({
      title: 'Supplements recommandes',
      content: cleanPlanForPDF(supplementsText),
      type: 'supplements',
    });
  }

  return sections;
}

function classifySection(title) {
  const t = (title || '').toLowerCase();
  if (/profil|analyse|bilan|metabol/i.test(t)) return 'analyse';
  if (/strat[eé]gie|principe|nutritionnel|approche/i.test(t)) return 'principes';
  if (/semaine|structure\s*alimentaire|menu|repas|lundi|mardi/i.test(t)) return 'plan';
  if (/rotation/i.test(t)) return 'rotation';
  if (/fiche\s*frigo/i.test(t)) return 'frigo';
  if (/protocole/i.test(t)) return 'protocoles';
  if (/ajustement/i.test(t)) return 'ajustements';
  if (/recommandation.*coach/i.test(t)) return 'coach';
  if (/plan\s*d.action/i.test(t)) return 'action';
  if (/suppl[eé]ment|compl[eé]ment|tableau horaire/i.test(t)) return 'supplements';
  if (/conseil|pratique|hydratation|astuce|meal.?prep/i.test(t)) return 'conseils';
  if (/suivi|progression|bilan.*semaine/i.test(t)) return 'suivi';
  if (/coach|benoit|note/i.test(t)) return 'notes_coach';
  return 'other';
}

// Body PDF preview component (body nutrition uniquement, pas de cover)

function renderSectionContent(content, type) {
  // Parse content into structured blocks for premium rendering
  const lines = (content || '').split('\n');
  const blocks = [];
  let currentBlock = [];

  for (const line of lines) {
    if (line.trim() === '' && currentBlock.length > 0) {
      blocks.push(currentBlock);
      currentBlock = [];
    } else if (line.trim()) {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) blocks.push(currentBlock);

  return blocks.map((block, bi) => {
    // Detect sub-headers (### or ** bold lines or CAPS short lines)
    const firstLine = block[0] || '';
    const isSubHeader = /^#{1,4}\s+/.test(firstLine) ||
      /^\*\*[^*]+\*\*\s*$/.test(firstLine) ||
      (firstLine === firstLine.toUpperCase() && /^[A-ZÀ-Ü]/.test(firstLine.trim()) && firstLine.trim().length > 3 && firstLine.trim().length < 60 && !/^[-–•\d]/.test(firstLine));

    if (isSubHeader) {
      const title = firstLine.replace(/^#+\s+/, '').replace(/\*\*/g, '').trim();
      const rest = block.slice(1);
      return (
        <div key={bi} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#1A2E1F', marginBottom: 4, letterSpacing: '.3px' }}>
            {title}
          </div>
          {rest.map((l, li) => renderLine(l, li, type))}
        </div>
      );
    }

    // Detect meal blocks (plan type: lines starting with repas names)
    if (type === 'plan' && /petit.?d[eé]j|d[eé]jeuner|d[iî]ner|collation/i.test(firstLine)) {
      return (
        <div key={bi} style={{ background: '#fff', border: '1px solid rgba(26,46,31,.08)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
          {block.map((l, li) => renderLine(l, li, type))}
        </div>
      );
    }

    // Detect supplement timing blocks
    if (type === 'supplements' && /matin|midi|soir|coucher|jeun/i.test(firstLine)) {
      return (
        <div key={bi} style={{ background: '#fff', borderLeft: '3px solid #1A2E1F', borderRadius: '0 8px 8px 0', padding: '8px 14px', marginBottom: 6 }}>
          {block.map((l, li) => renderLine(l, li, type))}
        </div>
      );
    }

    // Default paragraph block
    return (
      <div key={bi} style={{ marginBottom: 8 }}>
        {block.map((l, li) => renderLine(l, li, type))}
      </div>
    );
  });
}

function renderLine(line, key, type) {
  const trimmed = line.trim();

  // Bullet point
  if (/^[-–•]\s/.test(trimmed)) {
    const text = trimmed.replace(/^[-–•]\s+/, '');
    return (
      <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
        <span style={{ color: '#2a9d5c', fontWeight: 700, flexShrink: 0 }}>-</span>
        <span style={{ color: '#4A4A42' }}>{text}</span>
      </div>
    );
  }

  // Numbered item
  if (/^\d+[.)]\s/.test(trimmed)) {
    const num = trimmed.match(/^(\d+)[.)]\s/)[1];
    const text = trimmed.replace(/^\d+[.)]\s+/, '');
    return (
      <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
        <span style={{ color: '#1A2E1F', fontWeight: 700, minWidth: 18, flexShrink: 0 }}>{num}.</span>
        <span style={{ color: '#4A4A42' }}>{text}</span>
      </div>
    );
  }

  // Bold line (**text**)
  if (/^\*\*[^*]+\*\*/.test(trimmed)) {
    return (
      <div key={key} style={{ fontWeight: 600, color: '#1A2E1F', marginBottom: 2 }}>
        {trimmed.replace(/\*\*/g, '')}
      </div>
    );
  }

  // Regular line
  return <div key={key} style={{ color: '#4A4A42', marginBottom: 2 }}>{trimmed}</div>;
}

function NutritionPdfBody({ sections, isFollowup, clientName, date, followupWeek }) {
  if (!sections || sections.length === 0) return null;

  const sectionOrder = isFollowup
    ? ['suivi', 'analyse', 'plan', 'supplements', 'conseils', 'notes_coach', 'other']
    : ['analyse', 'principes', 'plan', 'supplements', 'conseils', 'notes_coach', 'other'];

  const sorted = [...sections].sort((a, b) => {
    const ia = sectionOrder.indexOf(a.type);
    const ib = sectionOrder.indexOf(b.type);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const docType = isFollowup ? `Suivi semaine ${followupWeek || ''}/4` : 'Plan nutritionnel';

  // Styles
  const pageHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(26,46,31,.12)', paddingBottom: 8, marginBottom: 16, fontSize: '.7rem', color: '#8a8a7a' };
  const sectionStyle = { marginBottom: 24, pageBreakInside: 'avoid' };
  const titleStyle = { color: '#1A2E1F', fontSize: '.88rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '2px solid #1A2E1F', paddingBottom: 6, marginBottom: 14 };

  return (
    <div style={{ background: '#F5F2EC', color: '#1A2E1F', borderRadius: 10, padding: '24px 28px', marginTop: 12, fontSize: '.83rem', lineHeight: 1.65, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Page header */}
      <div style={pageHeader}>
        <span>{clientName}</span>
        <span>{docType}</span>
        <span>{date}</span>
      </div>

      {/* Sections */}
      {sorted.map((sec, i) => (
        <div key={i} style={sectionStyle}>
          <h4 style={titleStyle}>
            {sec.title}
          </h4>
          <div>{renderSectionContent(sec.content, sec.type)}</div>
        </div>
      ))}

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(26,46,31,.1)', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: '#8a8a7a' }}>
        <span>Apercu du contenu nutrition</span>
        <span>{sorted.length} section{sorted.length > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// ─── QUALITY DASHBOARD ───

function NutritionQualityDashboard() {
  const insights = getLearningInsights();
  if (!insights || insights.total === 0) {
    return (
      <div style={{ background: '#F5F2EC', borderRadius: 10, padding: '16px 20px', marginTop: 12, fontSize: '.82rem', color: '#4A4A42' }}>
        Aucune donnee de generation disponible.
      </div>
    );
  }

  const { total, avgScoreInitial, avgScoreFinal, autoCorrectionRate, initialHardFailRate, finalHardFailRate, topPenalties, profilePatterns } = insights;

  const getColor = (val, good, bad) => val >= good ? '#2a9d5c' : val >= bad ? '#e8a040' : '#d45c4c';

  const MetricCard = ({ label, value, suffix, good, bad }) => (
    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: good != null ? getColor(typeof value === 'number' ? value : 0, good, bad) : '#1A2E1F' }}>
        {value}{suffix || ''}
      </div>
      <div style={{ fontSize: '.7rem', color: '#8a8a7a', marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ background: '#F5F2EC', borderRadius: 10, padding: '20px 24px', marginTop: 12, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <strong style={{ fontSize: '.9rem', color: '#1A2E1F' }}>Historique qualite IA (toutes generations)</strong>
        <span style={{ fontSize: '.7rem', color: '#8a8a7a' }}>{total} generation{total > 1 ? 's' : ''}</span>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <MetricCard label="Score initial moyen" value={avgScoreInitial} suffix="/10" good={7} bad={5} />
        <MetricCard label="Score final moyen" value={avgScoreFinal} suffix="/10" good={7} bad={5} />
        <MetricCard label="Taux auto-correction" value={autoCorrectionRate} suffix="%" good={80} bad={100} />
        <MetricCard label="Hard fail initial" value={initialHardFailRate} suffix="%" good={0} bad={10} />
      </div>

      {/* Hard fail resolution */}
      {initialHardFailRate > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '.78rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#4A4A42' }}>Hard fails resolus par auto-correction</span>
            <span style={{ fontWeight: 700, color: finalHardFailRate < initialHardFailRate ? '#2a9d5c' : '#d45c4c' }}>
              {initialHardFailRate}% → {finalHardFailRate}%
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(26,46,31,.08)', borderRadius: 4 }}>
            <div style={{ height: '100%', width: `${100 - finalHardFailRate}%`, background: '#2a9d5c', borderRadius: 4 }} />
          </div>
        </div>
      )}

      {/* Top penalties */}
      {topPenalties.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '.78rem', fontWeight: 600, color: '#1A2E1F', marginBottom: 6 }}>Top problemes detectes</div>
          {topPenalties.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(26,46,31,.06)', fontSize: '.76rem' }}>
              <span style={{ color: '#4A4A42', flex: 1 }}>{p.penalty}</span>
              <span style={{ color: '#8a8a7a', marginLeft: 8, flexShrink: 0 }}>{p.count}x ({p.pct}%)</span>
            </div>
          ))}
        </div>
      )}

      {/* Profile patterns */}
      {Object.keys(profilePatterns).length > 0 && (
        <div>
          <div style={{ fontSize: '.78rem', fontWeight: 600, color: '#1A2E1F', marginBottom: 6 }}>Profils les plus corriges</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(profilePatterns).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
              <span key={key} style={{ background: '#fff', border: '1px solid rgba(26,46,31,.1)', borderRadius: 100, padding: '4px 12px', fontSize: '.72rem', color: '#4A4A42' }}>
                {key} ({count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MGD ANALYSIS PDF ───

// Map form fields to MGD symptom keys
function detectSymptomsFromForm(form) {
  const symptoms = [];
  const f = form || {};

  // Energy (scale 1-5, low = symptom)
  if (f.energieJournee && Number(f.energieJournee) <= 2) symptoms.push('fatigue');

  // Digestion (scale 1-5 or text)
  if (f.frequenceBallonnements && Number(f.frequenceBallonnements) <= 2) symptoms.push('digestion', 'bloating');
  else if (f.frequenceBallonnements && Number(f.frequenceBallonnements) <= 3) symptoms.push('digestion');

  // Stress (scale 1-10, high = high stress)
  if (f.niveauStressActuel && Number(f.niveauStressActuel) >= 7) symptoms.push('stress');

  // Sleep (actual hours)
  if (f.heuresSommeil && Number(f.heuresSommeil) <= 5) symptoms.push('sleep');
  if (f.difficultesEndormissement && /oui|souvent|regulier/i.test(f.difficultesEndormissement)) symptoms.push('sleep');

  // Cravings
  if (f.fringalesSucre && /oui|souvent|regulier|fort/i.test(f.fringalesSucre)) symptoms.push('cravings');

  // Inflammation
  if (f.douleursInflammations && f.douleursInflammations.trim()) symptoms.push('inflammation');

  // Skin/hair
  if (f.troublesPeau && f.troublesPeau.trim()) symptoms.push('skin_hair');

  // Objectives → symptoms
  const obj = (f.objectifPrincipalNutrition || '').toLowerCase();
  if (/poids|perte/.test(obj)) symptoms.push('weight_gain', 'metabolic');
  if (/hormone/.test(obj)) symptoms.push('female_hormones');
  if (/performance/.test(obj)) symptoms.push('performance');
  if (/digestion/.test(obj) && !symptoms.includes('digestion')) symptoms.push('digestion');
  if (/energie|fatigue/.test(obj) && !symptoms.includes('fatigue')) symptoms.push('fatigue');

  // SPM / cycle
  if (f.spm && /oui|fort|regulier/i.test(f.spm)) symptoms.push('pms_cycle');
  if (f.douleursMenstruelles && /oui|fort|regulier/i.test(f.douleursMenstruelles)) symptoms.push('pms_cycle');

  // Thyroid hints
  if (f.pathologies && /thyro[iï]d|hashimoto|levothyrox/i.test(f.pathologies)) symptoms.push('thyroid');

  return [...new Set(symptoms)];
}

// ─── PRE-RDV CLINICAL SUMMARY (UI + AI prompt) ───

function buildPreRdvSummary(form) {
  const f = form || {};
  const symptoms = detectSymptomsFromForm(f);

  // Objective
  const objectif = f.objectifPrincipalNutrition || f.objectifPrincipal || '';

  // Scoring: detect problematic fields and rank them
  const signals = [];

  // Energy (scale fields: 1-2 = problematic, 3 = borderline)
  const energie = Number(f.energieJournee);
  if (energie && energie <= 2) signals.push({ label: 'Energie basse', priority: 1 });
  else if (energie && energie <= 3) signals.push({ label: 'Energie moyenne', priority: 3 });

  // Digestion
  const ballonnements = Number(f.frequenceBallonnements);
  if (ballonnements && ballonnements <= 2) signals.push({ label: 'Digestion perturbee (ballonnements frequents)', priority: 1 });
  else if (ballonnements && ballonnements <= 3) signals.push({ label: 'Digestion fragile', priority: 2 });

  // Stress (1-10 scale, high = stressed)
  const stress = Number(f.niveauStressActuel);
  if (stress && stress >= 7) signals.push({ label: `Stress eleve (${stress}/10)`, priority: 1 });
  else if (stress && stress >= 5) signals.push({ label: `Stress modere (${stress}/10)`, priority: 3 });

  // Sleep
  const heures = Number(f.heuresSommeil);
  if (heures && heures <= 5) signals.push({ label: `Sommeil insuffisant (${heures}h)`, priority: 1 });
  else if (heures && heures <= 6) signals.push({ label: `Sommeil limite (${heures}h)`, priority: 2 });
  if (f.difficultesEndormissement && /oui|souvent|regulier/i.test(f.difficultesEndormissement)) {
    signals.push({ label: 'Difficultes d\'endormissement', priority: 2 });
  }

  // Cravings
  if (f.fringalesSucre && /oui|souvent|regulier|fort/i.test(f.fringalesSucre)) {
    signals.push({ label: 'Fringales sucrees', priority: 2 });
  }

  // Hydration
  if (f.hydratation && /faible|insuffisant|peu|<\s*1/i.test(f.hydratation)) {
    signals.push({ label: 'Hydratation faible', priority: 2 });
  }

  // Inflammation
  if (f.douleursInflammations && f.douleursInflammations.trim()) {
    signals.push({ label: 'Inflammation / douleurs', priority: 2 });
  }

  // Pathologies (always priority 1)
  if (f.pathologies && f.pathologies.trim()) {
    signals.push({ label: `Pathologie : ${f.pathologies.trim().slice(0, 50)}`, priority: 1 });
  }

  // Allergies
  if (f.allergies && f.allergies.trim() && !/aucune|non|rien/i.test(f.allergies)) {
    signals.push({ label: `Allergies : ${f.allergies.trim().slice(0, 50)}`, priority: 1 });
  }

  // Sort by priority (1 = highest)
  signals.sort((a, b) => a.priority - b.priority);

  // Build priorities (top 3 problematic signals)
  const priorities = signals.filter(s => s.priority <= 2).slice(0, 3).map(s => s.label);

  // Build vigilance points (lower priority items not in priorities)
  const vigilance = signals.filter(s => !priorities.includes(s.label)).slice(0, 3).map(s => s.label);

  // Build axes de travail (derived from priorities + symptoms)
  const axes = [];
  if (symptoms.includes('digestion') || symptoms.includes('bloating')) axes.push('Ameliorer le confort digestif');
  if (symptoms.includes('fatigue')) axes.push('Restaurer l\'energie');
  if (symptoms.includes('cravings')) axes.push('Stabiliser la glycemie et reduire les fringales');
  if (symptoms.includes('stress') || symptoms.includes('sleep')) axes.push('Soutenir l\'axe stress-sommeil');
  if (symptoms.includes('weight_gain') || symptoms.includes('metabolic')) axes.push('Favoriser la perte de gras');
  if (symptoms.includes('inflammation')) axes.push('Reduire l\'inflammation');
  if (symptoms.includes('pms_cycle') || symptoms.includes('female_hormones')) axes.push('Equilibrer le cycle hormonal');
  if (symptoms.includes('performance')) axes.push('Optimiser la performance sportive');

  // Sport context
  const sport = [f.typeSport, f.frequenceSport ? `${f.frequenceSport}x/sem` : ''].filter(Boolean).join(' ');

  return {
    objectif,
    priorities,
    vigilance,
    axes: axes.slice(0, 3),
    sport: sport || null,
    nbRepas: f.nbRepas || null,
    hydratation: f.hydratation || null,
    hasData: !!(objectif || priorities.length || axes.length),
  };
}

function validateAnalysesPDF(symptoms, recommendations) {
  const errors = [];
  if (!symptoms || symptoms.length === 0) {
    errors.push('Aucun symptome detecte — impossible de recommander des analyses');
  }
  if (!recommendations || (recommendations.essential.length === 0 && recommendations.relevant.length === 0)) {
    errors.push('Aucune analyse recommandee');
  }
  return { valid: errors.length === 0, errors };
}

async function exportAnalysesPDF(recommendations, symptoms, clientName, dateStr) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 22;
  const cw = pw - margin * 2;
  let y = 20;

  // Background
  doc.setFillColor(245, 242, 236);
  doc.rect(0, 0, pw, 297, 'F');

  // Header
  doc.setFontSize(8);
  doc.setTextColor(138, 138, 122);
  doc.text(clientName, margin, y);
  doc.text('Analyses biologiques recommandees', pw / 2, y, { align: 'center' });
  doc.text(dateStr, pw - margin, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(26, 46, 31);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pw - margin, y);
  y += 10;

  // Intro
  doc.setFontSize(9);
  doc.setTextColor(74, 74, 66);
  const introLines = doc.splitTextToSize('Ces analyses permettent d\'objectiver certains desequilibres potentiels et de mieux personnaliser votre accompagnement nutritionnel. A discuter et valider avec votre medecin ou professionnel de sante.', cw);
  for (const line of introLines) { doc.text(line, margin, y); y += 4.5; }
  y += 6;

  // Context
  if (symptoms.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 46, 31);
    doc.text('Contexte : ', margin, y);
    const ctxX = margin + doc.getTextWidth('Contexte : ');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(74, 74, 66);
    doc.text(symptoms.map(s => s.replace(/_/g, ' ')).join(', '), ctxX, y);
    y += 8;
  }

  // Render section
  const renderSection = (title, items, dotColor) => {
    if (!items || items.length === 0) return;

    // Check page break
    if (y > 255) { doc.addPage(); doc.setFillColor(245, 242, 236); doc.rect(0, 0, pw, 297, 'F'); y = 20; }

    // Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 46, 31);
    doc.setFillColor(...dotColor);
    doc.circle(margin + 2, y - 1.5, 1.5, 'F');
    doc.text(title.toUpperCase(), margin + 7, y);
    y += 2;
    doc.setDrawColor(26, 46, 31);
    doc.setLineWidth(0.5);
    doc.line(margin + 7, y, margin + 7 + doc.getTextWidth(title.toUpperCase()), y);
    y += 6;

    // Items
    for (const item of items) {
      if (y > 270) { doc.addPage(); doc.setFillColor(245, 242, 236); doc.rect(0, 0, pw, 297, 'F'); y = 20; }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 46, 31);
      doc.text(item.label, margin + 4, y);

      // Category tag
      if (item.category && item.category !== 'Analyse fonctionnelle') {
        const labelW = doc.getTextWidth(item.label);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(138, 138, 122);
        doc.text(item.category, margin + 4 + labelW + 4, y);
      }
      y += 4;

      // Rationale
      if (item.rationale.length > 0) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(138, 138, 122);
        doc.text(item.rationale.slice(0, 3).join(', '), margin + 4, y);
        y += 4;
      }
      y += 1;
    }
    y += 4;
  };

  renderSection('Analyses essentielles', recommendations.essential, [26, 46, 31]);
  renderSection('Analyses pertinentes', recommendations.relevant, [232, 160, 64]);
  renderSection('Analyses optionnelles', recommendations.optional, [138, 138, 122]);

  // Practical tips
  if (y > 250) { doc.addPage(); doc.setFillColor(245, 242, 236); doc.rect(0, 0, pw, 297, 'F'); y = 20; }
  doc.setDrawColor(26, 46, 31);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin, y + 22);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 46, 31);
  doc.text('Conseils pratiques', margin + 4, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(74, 74, 66);
  const tips = [
    'A jeun pour les prises de sang (12h si bilan lipidique)',
    'Eviter le sport intense la veille',
    'Apporter cette liste au laboratoire ou a votre medecin',
    'Certains examens dependent du contexte — a individualiser',
  ];
  tips.forEach((tip, i) => { doc.text('- ' + tip, margin + 4, y + 9 + i * 4); });

  // Footer
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(138, 138, 122);
  const totalAnalyses = recommendations.essential.length + recommendations.relevant.length + recommendations.optional.length;
  doc.text('Anissa Deroubaix Nutrition', margin, ph - 10);
  doc.text(`${totalAnalyses} analyses recommandees`, pw - margin, ph - 10, { align: 'right' });

  doc.save(`analyses-${clientName.toLowerCase().replace(/\s+/g, '-')}-${dateStr.replace(/\//g, '-')}.pdf`);
}

function AnalysisPdfBody({ recommendations, symptoms, clientName, date }) {
  if (!recommendations) return null;

  const { essential, relevant, optional } = recommendations;
  const hasContent = essential.length > 0 || relevant.length > 0;
  if (!hasContent) return null;

  const pageHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(26,46,31,.12)', paddingBottom: 8, marginBottom: 16, fontSize: '.7rem', color: '#8a8a7a' };
  const sectionTitle = { color: '#1A2E1F', fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '2px solid #1A2E1F', paddingBottom: 5, marginBottom: 10 };

  const AnalysisItem = ({ item }) => (
    <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(26,46,31,.05)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ color: '#1A2E1F', fontWeight: 600 }}>{item.label}</span>
        {item.category && item.category !== 'Analyse fonctionnelle' && (
          <span style={{ fontSize: '.68rem', color: '#fff', background: 'rgba(26,46,31,.55)', borderRadius: 100, padding: '1px 8px', flexShrink: 0 }}>{item.category}</span>
        )}
      </div>
      {item.rationale.length > 0 && (
        <div style={{ fontSize: '.75rem', color: '#8a8a7a', marginTop: 2 }}>{item.rationale.slice(0, 3).join(', ')}</div>
      )}
    </div>
  );

  const SectionBlock = ({ title, items, color }) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <h4 style={sectionTitle}>{title}</h4>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '8px 14px' }}>
          {items.map((item, i) => <AnalysisItem key={i} item={item} />)}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: '#F5F2EC', color: '#1A2E1F', borderRadius: 10, padding: '24px 28px', marginTop: 12, fontSize: '.83rem', lineHeight: 1.65, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={pageHeader}>
        <span>{clientName}</span>
        <span>Analyses biologiques recommandees</span>
        <span>{date}</span>
      </div>

      {/* Intro */}
      <div style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', marginBottom: 18, fontSize: '.8rem', color: '#4A4A42', lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>Ces analyses permettent d'objectiver certains desequilibres potentiels et de mieux personnaliser votre accompagnement nutritionnel.</p>
        <p style={{ margin: '6px 0 0', fontStyle: 'italic', fontSize: '.76rem', color: '#8a8a7a' }}>A discuter et valider avec votre medecin ou professionnel de sante.</p>
      </div>

      {/* Context */}
      {symptoms.length > 0 && (
        <div style={{ marginBottom: 16, fontSize: '.78rem', color: '#4A4A42' }}>
          <strong style={{ color: '#1A2E1F' }}>Contexte : </strong>
          {symptoms.map(s => s.replace(/_/g, ' ')).join(', ')}
        </div>
      )}

      {/* Sections */}
      <SectionBlock title="Analyses essentielles" items={essential} color="#1A2E1F" />
      <SectionBlock title="Analyses pertinentes" items={relevant} color="#e8a040" />
      <SectionBlock title="Analyses optionnelles" items={optional} color="#8a8a7a" />

      {/* Practical tips */}
      <div style={{ background: '#fff', borderLeft: '3px solid #1A2E1F', borderRadius: '0 8px 8px 0', padding: '10px 16px', marginTop: 18, fontSize: '.78rem', color: '#4A4A42' }}>
        <strong style={{ display: 'block', marginBottom: 4, color: '#1A2E1F', fontSize: '.8rem' }}>Conseils pratiques</strong>
        <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}><span style={{ color: '#2a9d5c' }}>-</span> A jeun pour les prises de sang (12h si bilan lipidique)</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}><span style={{ color: '#2a9d5c' }}>-</span> Eviter le sport intense la veille</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}><span style={{ color: '#2a9d5c' }}>-</span> Apporter cette liste au laboratoire ou a votre medecin</div>
        <div style={{ display: 'flex', gap: 4 }}><span style={{ color: '#2a9d5c' }}>-</span> Certains examens dependent du contexte — a individualiser</div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(26,46,31,.1)', paddingTop: 8, marginTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: '#8a8a7a' }}>
        <span>Apercu analyses recommandees</span>
        <span>{essential.length + relevant.length + optional.length} analyse{essential.length + relevant.length + optional.length > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

const LAB_MARKERS_UI = [
  { key: 'ferritine', label: 'Ferritine', unit: 'ng/mL' },
  { key: 'fer_serique', label: 'Fer serique', unit: 'µmol/L' },
  { key: 'vitamine_d', label: 'Vitamine D', unit: 'ng/mL' },
  { key: 'vitamine_b12', label: 'Vitamine B12', unit: 'pg/mL' },
  { key: 'folates', label: 'Folates (B9)', unit: 'ng/mL' },
  { key: 'glucose_jeun', label: 'Glucose a jeun', unit: 'mg/dL' },
  { key: 'insuline_jeun', label: 'Insuline a jeun', unit: 'µU/mL' },
  { key: 'hba1c', label: 'HbA1c', unit: '%' },
  { key: 'tsh', label: 'TSH', unit: 'mUI/L' },
  { key: 't3_libre', label: 'T3 libre', unit: 'pg/mL' },
  { key: 't4_libre', label: 'T4 libre', unit: 'ng/dL' },
  { key: 'crp_us', label: 'CRP ultrasensible', unit: 'mg/L' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg/L' },
  { key: 'zinc', label: 'Zinc', unit: 'µg/dL' },
];

function buildLabSectionForPlan(labResults) {
  if (!labResults || Object.keys(labResults).length === 0) return null;

  const analysis = analyzeLabResults(labResults);
  if (analysis.signals.length === 0) return null;

  const lines = ['', '--- ADAPTATIONS BASEES SUR LES RESULTATS BIOLOGIQUES ---', ''];

  // Markers summary: concerns first (max 3), then borderline (max 2)
  const concerns = analysis.summary.concerns.slice(0, 3);
  const borderline = analysis.summary.borderline.slice(0, 2);
  if (concerns.length > 0) {
    lines.push('Marqueurs a optimiser :');
    for (const c of concerns) {
      lines.push(`- ${c.label} : ${c.value} ${c.unit} (${c.status})`);
    }
  }
  if (borderline.length > 0) {
    lines.push('Marqueurs en zone limite :');
    for (const b of borderline) {
      lines.push(`- ${b.label} : ${b.value} ${b.unit} (${b.status})`);
    }
  }
  lines.push('');

  // Adjustments (max 5) with max 3 cautions
  const adjustments = analysis.adjustments.slice(0, 5);
  let cautionCount = 0;
  lines.push('Ajustements nutritionnels proposes :');
  for (const adj of adjustments) {
    lines.push(`\n${adj.label} :`);
    for (const d of adj.dietary.slice(0, 2)) {
      lines.push(`- ${d}`);
    }
    if (adj.supplement) {
      lines.push(`- Option : ${adj.supplement}`);
    }
    if (adj.caution && cautionCount < 3) {
      lines.push(`- A noter : ${adj.caution}`);
      cautionCount++;
    }
  }

  lines.push('');
  lines.push('Ces adaptations sont basees sur une lecture fonctionnelle et restent a individualiser.');

  return lines.join('\n');
}

// ─── CLINICAL SUMMARY ───

function buildClinicalSummary(form, { mgdSymptoms, labAnalysis, isFollowup, followupWeek } = {}) {
  const lines = ['--- SYNTHESE CLINIQUE INTERNE (orientation IA) ---', ''];
  const f = form || {};

  // Context
  if (isFollowup) {
    lines.push(`Contexte : consultation de suivi, semaine ${followupWeek || '?'}/4.`);
  } else {
    lines.push('Contexte : premiere consultation, construction du plan nutritionnel complet.');
  }

  // Objective
  const objectif = f.objectifPrincipalNutrition || f.objectifPrincipal || '';
  if (objectif) {
    lines.push(`Objectif principal : ${objectif}.`);
  }

  // Clinical priority
  const priorities = [];
  if (f.pathologies && f.pathologies.trim()) priorities.push('pathologie (' + f.pathologies.trim().slice(0, 60) + ')');
  const symptoms = mgdSymptoms || [];
  if (symptoms.includes('digestion') || symptoms.includes('bloating')) priorities.push('digestion');
  if (symptoms.includes('fatigue')) priorities.push('energie');
  if (symptoms.includes('cravings')) priorities.push('comportement alimentaire');
  if (symptoms.includes('stress') || symptoms.includes('sleep')) priorities.push('axe stress/sommeil');
  if (priorities.length > 0) {
    lines.push(`Priorite clinique : ${priorities.slice(0, 3).join(' > ')}.`);
  }

  // Dominant symptoms (max 5)
  if (symptoms.length > 0) {
    lines.push(`Symptomes dominants : ${symptoms.slice(0, 5).map(s => s.replace(/_/g, ' ')).join(', ')}.`);
  }

  // Lab signals (max 3)
  if (labAnalysis && labAnalysis.signals && labAnalysis.signals.length > 0) {
    const labSignals = labAnalysis.adjustments.slice(0, 3).map(a => a.label);
    lines.push(`Signaux biologiques : ${labSignals.join(', ')}.`);
  }

  // Expected strategy (max 4)
  lines.push('');
  lines.push('Strategie nutritionnelle attendue :');
  if (isFollowup) {
    lines.push('- Ajustements progressifs bases sur le feedback client');
    if (symptoms.includes('digestion')) lines.push('- Simplifier si digestion instable');
    if (labAnalysis?.signals?.length > 0) lines.push('- Integrer les adaptations biologiques');
    lines.push('- Ne pas reecrire le plan complet, ajuster');
  } else {
    lines.push('- Plan structure et applicable');
    if (f.allergies && f.allergies.trim()) lines.push('- Exclure strictement : ' + f.allergies.trim().slice(0, 80));
    if (symptoms.includes('digestion')) lines.push('- Privilegier aliments neutres et digestibles');
    if (symptoms.includes('fatigue') || (labAnalysis?.signals || []).includes('low_iron_status')) lines.push('- Optimiser apports en fer, B12, vitamine D');
    if (symptoms.includes('cravings') || (labAnalysis?.signals || []).includes('glycemic_dysregulation')) lines.push('- Stabiliser la glycemie (IG bas, fibres, proteines)');
    if (f.frequenceSport && f.frequenceSport !== 'Jamais') lines.push('- Adapter selon activite physique');
  }

  return lines.join('\n');
}

// ─── CLIENT PIPELINE STATUSES ───

const PIPELINE_STATUSES = [
  { key: 'questionnaire_envoye', label: 'Questionnaire envoye', color: '#94a3b8' },
  { key: 'questionnaire_recu', label: 'Questionnaire recu', color: '#60a5fa' },
  { key: 'rdv_effectue', label: 'RDV effectue', color: '#a78bfa' },
  { key: 'attente_analyses', label: 'Attente analyses', color: '#fbbf24' },
  { key: 'dossier_complet', label: 'Dossier complet', color: '#4ade80' },
  { key: 'plan_en_cours', label: 'Plan en cours', color: '#f97316' },
  { key: 'a_valider', label: 'A valider', color: '#f87171' },
  { key: 'envoye', label: 'Envoye', color: '#22d3ee' },
];

function suggestStatus(consultation) {
  const c = consultation || {};
  if (c.nutrition_plan && c.nutrition_plan.trim()) return 'a_valider';
  if ((c.mgd_recommendation === 'blood' || c.mgd_recommendation === 'advanced') && (!c.lab_results || Object.values(c.lab_results || {}).every(v => !v))) return 'attente_analyses';
  if (c.lab_results && Object.values(c.lab_results || {}).some(v => v)) return 'dossier_complet';
  return null;
}

const INITIAL_CONSULTATION = {
  observations: '',
  blood_test_done: false,
  dna_test_done: false,
  mgd_recommendation: 'none',
  nutritional_observations: '',
  nutrition_plan: '',
  supplements: '',
  recipes: '',
  notes_for_coach: '',
  private_notes: '',
  fiche_frigo_json: null,
  lab_results: {},
  status: 'questionnaire_recu',
};

const INITIAL_FOLLOWUP = {
  etat_global: '',
  energie: '',
  sommeil: '',
  digestion: '',
  stress: '',
  douleurs: '',
  adherence_plan: '',
  changements_succes: '',
  difficultes: '',
  supplements_pris: '',
  supplements_raison: '',
  poids_actuel: '',
  tour_taille: '',
  tour_hanche: '',
  tour_bras: '',
  tour_cuisse: '',
  masse_grasse: '',
  nouveau_bilan: '',
  nouveau_adn: '',
  observations_progression: '',
  points_ameliorer: '',
  objectifs_prochains: '',
};

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function NutritionConsultation({ clientId, apiKey, onSave, onCancel, initialConsultation }) {
  const [client, setClient] = useState(() => getClient(clientId));
  const form = client?.form || {};
  const formule = FORMULES[client?.formule] || {};

  // Fetch latest client data from Supabase on mount (questionnaire may have been filled since local cache)
  useEffect(() => {
    if (!isCloudEnabled || !clientId) return;
    supabase
      .from('clients')
      .select('form, prenom, updated_at')
      .eq('id', clientId)
      .single()
      .then(({ data, error }) => {
        if (error || !data?.form) return;
        const local = getClient(clientId);
        const cloudDate = new Date(data.updated_at || 0);
        const localDate = new Date(local?.updatedAt || 0);
        // Only update if cloud is newer (questionnaire was submitted after local creation)
        if (cloudDate > localDate) {
          const merged = { ...local, form: { ...(local?.form || {}), ...data.form }, updatedAt: data.updated_at };
          saveClient(merged);
          setClient(merged);
        }
      });
  }, [clientId]);

  // Detect returning client
  const existingConsultations = getNutritionConsultations(clientId);
  const isFollowup = !initialConsultation && existingConsultations.length > 0;
  const previousConsultation = isFollowup ? existingConsultations[0] : null;
  // Week number: prefer persisted value, fallback to nutrition followup count
  const followupWeek = (() => {
    if (initialConsultation?.followupWeek) return initialConsultation.followupWeek;
    if (!isFollowup) return 0;
    // Count only followup consultations (exclude the initial plan)
    const followupCount = existingConsultations.filter(c => c.isFollowup).length;
    // Current consultation is the next followup (+1), capped at 4
    return Math.min(followupCount + 1, 4);
  })();

  // Steps differ based on followup status
  const stepLabels = isFollowup
    ? ['Resume client', 'Suivi & Progression', 'Plan nutrition', 'Notes pour Benoit']
    : ['Resume client', 'Plan nutrition', 'Notes pour Benoit'];

  const totalSteps = stepLabels.length;

  // Le cockpit (step "plan") est le point d'entree par defaut — les autres
  // steps (resume client, suivi, notes) restent accessibles via les pills en haut.
  const [step, setStep] = useState(() => (isFollowup ? 3 : 2));
  const [consultation, setConsultation] = useState(() => {
    if (initialConsultation) {
      return {
        observations: initialConsultation.observations || '',
        blood_test_done: initialConsultation.bloodTestDone || initialConsultation.blood_test_done || false,
        dna_test_done: initialConsultation.dnaTestDone || initialConsultation.dna_test_done || false,
        mgd_recommendation: initialConsultation.mgdRecommendation
          || initialConsultation.mgd_recommendation
          || (initialConsultation.bloodTestDone || initialConsultation.blood_test_done
              ? (initialConsultation.dnaTestDone || initialConsultation.dna_test_done
                  ? 'advanced' : 'blood')
              : 'none'),
        nutritional_observations: initialConsultation.nutritionalObservations || initialConsultation.nutritional_observations || '',
        nutrition_plan: initialConsultation.nutritionPlan || initialConsultation.nutrition_plan || '',
        supplements: initialConsultation.supplements || '',
        recipes: initialConsultation.recipes || '',
        notes_for_coach: initialConsultation.notesForCoach || initialConsultation.notes_for_coach || '',
        private_notes: initialConsultation.privateNotes || initialConsultation.private_notes || '',
        fiche_frigo_json: initialConsultation.ficheFrigoJson || initialConsultation.fiche_frigo_json || null,
        lab_results: initialConsultation.labResults || initialConsultation.lab_results || {},
      };
    }
    // Pre-fill observations from questionnaire data
    const c = { ...INITIAL_CONSULTATION };
    const f = client?.form || {};

    // Build observations from profile data
    const profileParts = [
      f.genre && `Genre : ${f.genre}`,
      f.age && `Age : ${f.age} ans`,
      f.poids && `Poids : ${f.poids} kg`,
      f.taille && `Taille : ${f.taille} cm`,
      f.profession && `Profession : ${f.profession}`,
      f.heuresSommeil && `Sommeil : ${f.heuresSommeil}/5`,
      f.niveauStressActuel && `Stress : ${f.niveauStressActuel}/5`,
      f.energieJournee && `Energie : ${f.energieJournee}/5`,
    ].filter(Boolean);
    if (profileParts.length > 0) c.observations = profileParts.join('\n');

    // Build nutritional observations from diet/health data
    const nutriParts = [
      f.nbRepas && `Repas/jour : ${f.nbRepas}`,
      f.hydratation && `Hydratation : ${f.hydratation}`,
      f.alimentsEvites && `Aliments evites : ${f.alimentsEvites}`,
      f.frequenceBallonnements && `Digestion : ${f.frequenceBallonnements}/5`,
      f.pathologies && `Pathologies : ${f.pathologies}`,
      f.traitements && `Traitements : ${f.traitements}`,
      f.allergies && `Allergies : ${f.allergies}`,
    ].filter(Boolean);
    if (nutriParts.length > 0) c.nutritional_observations = nutriParts.join('\n');

    return c;
  });
  const [followupData, setFollowupData] = useState(() => {
    if (initialConsultation?.followupData) return { ...INITIAL_FOLLOWUP, ...initialConsultation.followupData };
    return { ...INITIAL_FOLLOWUP };
  });
  const [weeklyFeedback, setWeeklyFeedback] = useState(() => {
    if (initialConsultation?.weeklyFeedback) return { ...INITIAL_WEEKLY_FEEDBACK, ...initialConsultation.weeklyFeedback };
    return { ...INITIAL_WEEKLY_FEEDBACK };
  });
  const [consultationId] = useState(initialConsultation?.id || null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [autoCorrected, setAutoCorrected] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showQualityDash, setShowQualityDash] = useState(false);
  const [showAnalysesPreview, setShowAnalysesPreview] = useState(false);
  const [analysesError, setAnalysesError] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState(null);
  const editorGetDataRef = useRef(null);
  const [planVersions, setPlanVersions] = useState(() => getPlanVersions(clientId));
  const [showVersions, setShowVersions] = useState(false);

  // ─── Cockpit (split view) ───
  const [editorTab, setEditorTab] = useState('plan'); // 'plan' | 'frigo' | 's1s4' | 'supp'
  const [previewTab, setPreviewTab] = useState('pdf'); // 'pdf' | 'frigo' | 'cover'
  const [showFrigoModal, setShowFrigoModal] = useState(false);
  const [showMedicalSummary, setShowMedicalSummary] = useState(false);
  const [showCoverForm, setShowCoverForm] = useState(false);
  const [coverFields, setCoverFields] = useState(() => ({
    prenom: form?.prenom || client?.prenom || '',
    objectif: form?.objectifPrincipalNutrition || form?.objectifPrincipal || '',
    date: new Date().toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    sousTitre: 'Plan nutrition personnalis\u00e9',
  }));
  // ─── Draft state (source de verite unique cote parent) ──────────────
  // L'editeur est controle via un reseed explicite (editorSeed) et pousse
  // ses modifications en continu via onDraftChange (debounced cote editeur).
  // L'apercu lit directement ces drafts → re-renders React natifs, pas de ref polling.
  const initialPlan = initialConsultation?.nutritionPlan || initialConsultation?.nutrition_plan || '';
  const initialSupp = initialConsultation?.supplements || '';
  const initialRec = initialConsultation?.recipes || '';
  const [planDraft, setPlanDraft] = useState(initialPlan);
  const [supplementsDraft, setSupplementsDraft] = useState(initialSupp);
  const [recipesDraft, setRecipesDraft] = useState(initialRec);
  // editorSeed : incremente UNIQUEMENT pour forcer un remount de NutritionEditor
  // (apres generation IA, template, ou restauration de version). Jamais en reponse
  // a une edition utilisateur — c'est ce qui evitait la perte de texte.
  const [editorSeed, setEditorSeed] = useState(0);

  const [saveToast, setSaveToast] = useState('');
  const [liveScore, setLiveScore] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const scoreDebounceRef = useRef(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzingPlan, setAnalyzingPlan] = useState(false);
  const [improvingAll, setImprovingAll] = useState(false);
  const [globalProposal, setGlobalProposal] = useState(null);
  const [expertMode, setExpertMode] = useState(false);
  const [sectionResults, setSectionResults] = useState([]);
  const [currentOptimizingIdx, setCurrentOptimizingIdx] = useState(0);
  const [acceptedSections, setAcceptedSections] = useState({});
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved');
  // 'saved' | 'unsaved' | 'saving'
  const autoSaveTimerRef = useRef(null);
  const isDirtyRef = useRef(false);
  const previewBodyRef = useRef(null);

  // Restore draft on mount if newer than saved consultation
  useEffect(() => {
    const draft = loadDraft(clientId, consultationId);
    if (!draft) return;
    const consultationDate = new Date(initialConsultation?.createdAt || 0).getTime();
    if (draft.savedAt > consultationDate) {
      reseedEditor(draft.plan, draft.supplements, draft.recipes);
      setAutoSaveStatus('unsaved');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reseed : remplace les drafts + remount l'editeur. A appeler APRES toute
  // ecriture "autoritaire" du plan (AI gen, template, restore version).
  const reseedEditor = (plan, supplements, recipes) => {
    console.log('[NC] reseedEditor CALLED', {
      planLen: (plan || '').length,
      suppLen: (supplements || '').length,
      recLen: (recipes || '').length,
      stack: new Error().stack?.split('\n').slice(1, 5).join(' → '),
    });
    setPlanDraft(plan || '');
    setSupplementsDraft(supplements || '');
    setRecipesDraft(recipes || '');
    setEditorSeed(s => s + 1);
  };

  // Callback push-based depuis NutritionEditor — maintient les drafts a jour.
  const handleDraftChange = (plan, supplements, recipes) => {
    setPlanDraft(plan);
    setSupplementsDraft(supplements);
    setRecipesDraft(recipes);
    isDirtyRef.current = true;
    setAutoSaveStatus('unsaved');
    // Debounce 1s
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveStatus('saving');
      saveDraft(clientId, consultationId, { plan, supplements, recipes });
      setAutoSaveStatus('unsaved');
    }, 1000);
  };

  // Flush draft to localStorage on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (isDirtyRef.current) {
        const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
        saveDraft(clientId, consultationId, {
          plan: edited?.plan ?? planDraft,
          supplements: edited?.supplements ?? supplementsDraft,
          recipes: edited?.recipes ?? recipesDraft,
        });
      }
    };
  }, [clientId, consultationId, planDraft, supplementsDraft, recipesDraft]);

  // Warning before page unload if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Close dropdown menus on outside click
  useEffect(() => {
    const close = () => { setShowPdfMenu(false); setShowMoreMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Flush des drafts -> etat persiste consultation.*
  // Ne provoque PAS de reseed de l'editeur (drafts === consultation apres ca).
  const flushEditorDraft = () => {
    setConsultation(prev => {
      if (prev.nutrition_plan === planDraft && prev.supplements === supplementsDraft && prev.recipes === recipesDraft) {
        return prev;
      }
      return {
        ...prev,
        nutrition_plan: planDraft,
        supplements: supplementsDraft,
        recipes: recipesDraft,
      };
    });
    return true;
  };

  const showSaveToast = (msg) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(''), 1800);
  };

  // Live score + suggestions (debounced)
  useEffect(() => {
    if (!planDraft && !supplementsDraft) return;
    if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
    scoreDebounceRef.current = setTimeout(() => {
      const score = scorePlanQuality(
        planDraft,
        supplementsDraft,
        { ...form, _weeklyFeedback: weeklyFeedback },
        { isFollowup, followupWeek }
      );
      setLiveScore(score);
      setSuggestions(buildSuggestions(score, null));
    }, 1500);
    return () => clearTimeout(scoreDebounceRef.current);
  }, [planDraft, supplementsDraft, form, isFollowup, followupWeek, weeklyFeedback]);

  const handleImproveFromAnalysis = async (instruction, targetHint) => {
    setAiAnalysis(null);
    await new Promise(r => setTimeout(r, 150));
    showSaveToast(`\u2728 IA en cours \u2014 ${instruction}`);
    try {
      const { improveSection } = await import('./services/aiClient');
      const result = await improveSection(
        form,
        targetHint || 'Plan complet',
        planDraft,
        'adapt'
      );
      if (result) {
        setGlobalProposal({ text: result, instruction });
      }
    } catch (err) {
      showSaveToast('Erreur IA \u2014 r\u00e9essayez');
    }
  };

  const handleImproveAll = async () => {
    setImprovingAll(true);
    setAiAnalysis(null);
    try {
      const { improveSection } = await import('./services/aiClient');
      const result = await improveSection(
        form,
        'Plan nutritionnel complet',
        planDraft,
        'improve'
      );
      if (result) setGlobalProposal({ text: result, instruction: 'Plan am\u00e9lior\u00e9' });
    } catch (err) {
      showSaveToast('Erreur IA \u2014 r\u00e9essayez');
    } finally {
      setImprovingAll(false);
    }
  };

  const handleExpertMode = async () => {
    const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
    const currentPlan = edited?.plan ?? planDraft;
    if (!currentPlan?.trim()) {
      showSaveToast('Aucun plan \u00e0 optimiser');
      return;
    }
    setExpertMode('loading');
    setAcceptedSections({});
    setSectionResults([]);

    const sections = structurePlanSections(currentPlan, supplementsDraft, { isFollowup });

    const results = [];
    for (let i = 0; i < sections.length; i++) {
      setCurrentOptimizingIdx(i);
      const section = sections[i];
      if (!section.content?.trim()) {
        results.push({ id: section.id || `s_${i}`, title: section.title,
          original: '', improved: '', changes: [], skip: true });
        continue;
      }
      try {
        const { improvedContent, changes } = await optimizeSection(
          form, section.title, section.content
        );
        results.push({
          id: section.id || `s_${i}`,
          title: section.title,
          original: section.content,
          improved: improvedContent,
          changes,
          skip: false,
        });
      } catch {
        results.push({ id: section.id || `s_${i}`, title: section.title,
          original: section.content, improved: section.content,
          changes: [], skip: true });
      }
      setSectionResults([...results]);
    }
    setExpertMode('review');
  };

  const handleApplyExpertMode = () => {
    const newPlanParts = sectionResults.map(r => {
      const accepted = acceptedSections[r.id] !== false;
      const content = accepted ? r.improved : r.original;
      if (!content?.trim()) return '';
      return `${r.title.toUpperCase()}\n${content}`;
    }).filter(Boolean);

    const newPlan = newPlanParts.join('\n\n');
    reseedEditor(newPlan, supplementsDraft, recipesDraft);
    setExpertMode(false);
    setSectionResults([]);
    setAcceptedSections({});
    showSaveToast('\u2705 Plan optimis\u00e9 appliqu\u00e9');
  };

  const updateField = (field, value) => {
    setConsultation(prev => ({ ...prev, [field]: value }));
  };

  // Map step index to content type based on followup
  const getStepType = (s) => {
    if (isFollowup) {
      const map = { 1: 'summary', 2: 'followup', 3: 'plan', 4: 'notes' };
      return map[s];
    }
    const map = { 1: 'summary', 2: 'plan', 3: 'notes' };
    return map[s];
  };

  const currentStepType = getStepType(step);

  const buildUserMessage = () => {
    const nr = 'Non renseigne';

    const parts = [
      `Voici les donnees completes du client (13 etapes d'anamnese) :`,
      ``,
      `--- ETAPE 1 : IDENTITE ---`,
      `- Nom : ${[form.prenom, form.nom].filter(Boolean).join(' ') || nr}`,
      `- Age : ${form.age ? `${form.age} ans` : nr}`,
      `- Genre : ${form.genre || nr}`,
      `- Poids : ${form.poids ? `${form.poids} kg` : nr}`,
      `- Taille : ${form.taille ? `${form.taille} cm` : nr}`,
      form.tourTaille ? `- Tour de taille : ${form.tourTaille} cm` : '',
      form.tourHanche ? `- Tour de hanche : ${form.tourHanche} cm` : '',
      form.tourPoitrine ? `- Tour de poitrine : ${form.tourPoitrine} cm` : '',
      form.tourBras ? `- Tour de bras : ${form.tourBras} cm` : '',
      form.tourCuisse ? `- Tour de cuisse : ${form.tourCuisse} cm` : '',
      form.masseGrasse ? `- Masse grasse : ${form.masseGrasse} %` : '',
      form.masseMusculaire ? `- Masse musculaire : ${form.masseMusculaire} %` : '',
      `- Profession : ${form.profession || nr}`,
      `- Email : ${form.email || nr}`,
      `- Telephone : ${form.telephone || nr}`,
      `- Formule : ${formule.nom || (client?.categorie === 'nutrition' ? 'Client nutrition' : nr)}`,
      ``,
      `--- ETAPE 2 : ANTECEDENTS MEDICAUX ---`,
      `- Pathologies : ${form.pathologies || nr}`,
      `- Operations : ${form.operations || nr}`,
      `- Traitements / medicaments : ${form.traitements || nr}`,
      `- Antecedents familiaux : ${form.antecedentsFamiliaux || nr}`,
      `- Allergies : ${form.allergies || 'Aucune'}`,
      ``,
      `--- ETAPE 3 : ALIMENTATION ---`,
      `- Nombre de repas/jour : ${form.nbRepas || nr}`,
      `- Hydratation : ${form.hydratation || nr}`,
      `- Aliments evites / intolerances : ${form.alimentsEvites || nr}`,
      `- Regimes suivis : ${form.regimesSuivis || nr}`,
      `- Mastication / grignotages : ${form.mastication || nr}`,
      ``,
      `--- ETAPE 4 : SANTE ---`,
      `- Blessures : ${form.blessures || 'Aucune'}`,
      `- Douleurs actuelles : ${form.douleursActuelles || nr}`,
      `- Contraception : ${form.contraception || nr}`,
      `- Cycle : ${form.cycleDuree || nr}`,
      `- SPM : ${form.spm || nr}`,
      `- Douleurs menstruelles : ${form.douleursMenstruelles || nr}`,
      `- Projet grossesse : ${form.projetGrossesse || nr}`,
      ``,
      `--- ETAPE 5 : SPORT & PERFORMANCE ---`,
      `- Type de sport : ${form.typeSport || nr}`,
      `- Frequence : ${form.frequenceSport || nr}`,
      `- Objectif sportif : ${form.objectifSport || nr}`,
      `- Recuperation : ${form.recuperation || nr}`,
      `- Supplements actuels : ${form.supplements || nr}`,
      `- Digestif a l'effort : ${form.digestifEffort || nr}`,
      ``,
      `--- ETAPE 6 : METABOLISME & ENERGIE ---`,
      `- Energie au cours de la journee : ${form.energieJournee || nr}`,
      `- Fringales / envies de sucre : ${form.fringalesSucre || nr}`,
      `- Variations de glycemie : ${form.variationsGlycemie || nr}`,
      `- Reaction apres repas riche en glucides : ${Array.isArray(form.reactionGlucides) ? (form.reactionGlucides.length ? form.reactionGlucides.join(', ') : nr) : (form.reactionGlucides || nr)}`,
      ``,
      `--- ETAPE 7 : DIGESTION & MICROBIOTE ---`,
      `- Frequence ballonnements : ${form.frequenceBallonnements || nr}`,
      `- Type de transit : ${form.transitType || nr}`,
      `- Aliments problematiques : ${form.alimentsProblematiques || nr}`,
      `- Consommation reguliere : ${(form.consommationReguliere || []).length > 0 ? form.consommationReguliere.join(', ') : nr}`,
      ``,
      `--- ETAPE 8 : INFLAMMATION & IMMUNITE ---`,
      `- Douleurs articulaires / inflammations : ${form.douleursInflammations || nr}`,
      `- Frequence maladies : ${form.frequenceMaladies || nr}`,
      `- Troubles de peau : ${form.troublesPeau || nr}`,
      ``,
      `--- ETAPE 9 : STRESS & SYSTEME NERVEUX ---`,
      `- Niveau de stress actuel : ${form.niveauStressActuel ? `${form.niveauStressActuel}/10` : nr}`,
      `- Difficultes d'endormissement : ${form.difficultesEndormissement || nr}`,
      `- Reveils nocturnes : ${form.reveilsNocturnes || nr}`,
      `- Etat au reveil : ${form.etatReveil || nr}`,
      ``,
      `--- ETAPE 10 : MODE DE VIE & BIOHACKING ---`,
      `- Temps a l'exterieur (lumiere naturelle) : ${form.tempsExterieur || nr}`,
      `- Heures de sommeil en moyenne : ${form.heuresSommeil ? `${form.heuresSommeil}h` : nr}`,
      `- Exposition ecrans le soir : ${form.expositionEcransSoir || nr}`,
      `- Type de profession : ${form.professionType || nr}`,
      `- Alcool : ${form.alcool || nr}`,
      `- Tabac : ${form.tabac || nr}`,
      ``,
      `--- ETAPE 11 : GENETIQUE & DONNEES ---`,
      `- Analyses biologiques recentes : ${form.analysesBiologiques || nr}`,
      `- Test ADN nutrigenetique : ${form.testADN || nr}`,
      `- Tests genetiques connus (MTHFR, APOE, etc.) : ${form.testsGenetiques || nr}`,
      `- Pret pour analyses avancees : ${form.pretAnalysesAvancees || nr}`,
      ``,
      `--- ETAPE 12 : OBJECTIFS & ENGAGEMENT ---`,
      `- Objectif principal : ${form.objectifPrincipalNutrition || nr}`,
      `- Duree du probleme : ${form.dureeProbleme || nr}`,
      `- Deja essaye : ${form.dejaEssaye || nr}`,
      `- Pret pour protocole personnalise : ${form.pretProtocole || nr}`,
      ``,
      `--- OBSERVATIONS DE LA NUTRITIONNISTE ---`,
      `- Observations generales : ${consultation.observations || nr}`,
      `- Bilan sanguin effectue : ${consultation.blood_test_done ? 'Oui' : 'Non'}`,
      `- Analyse ADN effectuee : ${consultation.dna_test_done ? 'Oui' : 'Non'}`,
      `- Observations nutritionnelles : ${consultation.nutritional_observations || nr}`,
    ];

    // Add followup data for returning clients
    if (isFollowup && previousConsultation) {
      parts.push('');
      parts.push(`--- SUIVI SEMAINE ${followupWeek}/4 ---`);
      parts.push(buildFollowupSummary(followupData, previousConsultation, form));

      // Weekly feedback (structured)
      const wf = weeklyFeedback;
      const feedbackLines = [
        wf.energy && `Energie : ${wf.energy}`,
        wf.digestion && `Digestion : ${wf.digestion}`,
        wf.hunger && `Faim/Satiete : ${wf.hunger}`,
        wf.adherence && `Adherence : ${wf.adherence}`,
        wf.performance && `Performance : ${wf.performance}`,
        wf.cravings && `Fringales/Envies : ${wf.cravings}`,
        wf.notes && `Notes : ${wf.notes}`,
      ].filter(Boolean);
      if (feedbackLines.length > 0) {
        parts.push('');
        parts.push('--- FEEDBACK HEBDOMADAIRE CLIENT ---');
        parts.push(feedbackLines.join('\n'));
      }

      // Add previous plan summary
      if (previousConsultation.nutritionPlan) {
        const planLines = previousConsultation.nutritionPlan.split('\n').slice(0, 30);
        parts.push('');
        parts.push('--- PLAN INITIAL A AJUSTER ---');
        parts.push(planLines.join('\n'));
        parts.push('...(plan complet non inclus pour brievete)');
      }
      if (previousConsultation.supplements) {
        parts.push('');
        parts.push('--- SUPPLEMENTS PRECEDEMMENT RECOMMANDES ---');
        parts.push(previousConsultation.supplements.split('\n').slice(0, 15).join('\n'));
      }
    }

    // Add lab results interpretation if available
    const labData = consultation.lab_results || {};
    const hasLabData = Object.values(labData).some(v => v !== '' && v != null);
    const labAnalysis = hasLabData ? analyzeLabResults(labData) : null;
    if (hasLabData) {
      const labSection = buildLabSectionForPlan(labData);
      if (labSection) parts.push(labSection);
    }

    // Pre-RDV summary (priorities + axes, also shown in UI)
    const preRdv = buildPreRdvSummary(form);
    if (preRdv.hasData) {
      parts.push('');
      parts.push('--- SYNTHESE PRE-RDV (priorites detectees) ---');
      if (preRdv.objectif) parts.push(`Objectif : ${preRdv.objectif}`);
      if (preRdv.priorities.length > 0) parts.push(`Priorites : ${preRdv.priorities.join(' > ')}`);
      if (preRdv.axes.length > 0) parts.push(`Axes de travail : ${preRdv.axes.join(', ')}`);
      if (preRdv.vigilance.length > 0) parts.push(`Vigilance : ${preRdv.vigilance.join(', ')}`);
    }

    // Clinical summary (orientation for AI)
    const mgdSymptoms = detectSymptomsFromForm(form);
    const mgdRec = consultation.mgd_recommendation || 'none';
    const mgdRecLabel = mgdRec === 'advanced'
      ? 'Bilan avancé recommandé (sanguin + ADN)'
      : mgdRec === 'blood'
      ? 'Bilan sanguin recommandé'
      : 'Aucun test biologique recommandé';
    parts.push('');
    parts.push(buildClinicalSummary(form, {
      mgdSymptoms,
      labAnalysis: labAnalysis?.signals?.length > 0 ? labAnalysis : null,
      isFollowup,
      followupWeek,
    }));
    parts.push(`Recommandation biologique Anissa : ${mgdRecLabel}`);

    if (hasLabData) {
      const labAnalysis2 = analyzeLabResults(labData);
      const mgdSymptoms2 = detectSymptomsFromForm(form);
      const correlation = buildMGDCorrelation(mgdSymptoms2, labAnalysis2.signals || []);
      const correlationText = formatCorrelationForPrompt(correlation);
      if (correlationText) parts.push(correlationText);
    }

    parts.push('');
    parts.push(`Genere un plan nutrition personnalise COURT et PREMIUM. Format compact : synthese, regles, 2 trames de journees types (semaine 1), rotations et substitutions (semaines 2-4), fiche frigo, ajustements entrainement, suivi. PAS de menus detailles jour par jour. Lisible en 3 minutes.`);
    if (hasLabData) {
      parts.push('Integre les adaptations basees sur les resultats biologiques dans le plan si pertinent.');
    }

    return parts.join('\n');
  };

  const handleGenerate = async () => {
    // Validation des champs critiques (securite client)
    const missing = [];
    if (!form.allergies || !form.allergies.toString().trim()) missing.push('allergies / intolerances');
    const hasMeds = (form.traitements && form.traitements.toString().trim()) || (form.medicaments && form.medicaments.toString().trim());
    const hasPath = form.pathologies && form.pathologies.toString().trim();
    if (!hasMeds && !hasPath) missing.push('medicaments / pathologies');
    if (missing.length > 0) {
      const msg = `Champs critiques non renseignes : ${missing.join(' et ')}.\n\nGenerer sans ces informations peut etre dangereux (interactions, contre-indications).\n\nContinuer quand meme ?`;
      if (!confirm(msg)) return;
    }

    if (consultation.nutrition_plan && !confirm('Cela remplacera le plan actuel. Continuer ?')) return;

    // Detection des contre-indications avant generation
    const alerts = detectContraIndications({
      ...form,
      observations: consultation.observations,
      nutritional_observations: consultation.nutritional_observations,
    });
    if (alerts.length > 0) {
      setPendingAlerts(alerts);
      return;
    }

    await doGenerate();
  };

  const doGenerate = async () => {
    setPendingAlerts(null);
    setGenerating(true);
    setGenError('');

    // Versioning : sauvegarder l'ancien plan avant de le remplacer
    if (consultation.nutrition_plan) {
      savePlanVersion(clientId, {
        nutritionPlan: consultation.nutrition_plan,
        supplements: consultation.supplements,
        recipes: consultation.recipes,
        ficheFrigoJson: consultation.fiche_frigo_json || null,
        label: 'Avant regeneration',
      });
      setPlanVersions(getPlanVersions(clientId));
    }

    try {
      const userMessage = buildUserMessage();

      const planResponse = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fallback-key': apiKey.trim(),
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          system: buildSystemPrompt(form, { isFollowup, clientFormule: client?.formule || '', followupWeek }),
          messages: [{ role: 'user', content: userMessage + '\n\nGenere le plan nutrition personnalise complet (sections 1 a 7) avec menus varies, listes de courses par semaine, et alternatives naturelles. Ne genere PAS la section supplements separement.' }],
        }),
      });

      if (!planResponse.ok) {
        const err = await planResponse.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erreur API: ${planResponse.status}`);
      }

      const planData = await planResponse.json();
      const planText = planData.content?.[0]?.text || '';

      // Appel 2 : Supplements (conditionnel — seulement si client ouvert aux complements)
      let suppText = '';
      const wantsSupplements = form.pretProtocole === 'Oui' || form.pretProtocole === 'Peut-etre';
      if (wantsSupplements) {
        const suppResponse = await fetch('/api/claude', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-fallback-key': apiKey.trim(),
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            system: buildSystemPrompt(form, { isFollowup, clientFormule: client?.formule || '', followupWeek }),
            messages: [{ role: 'user', content: userMessage + '\n\n' + SUPPLEMENTS_INSTRUCTION }],
          }),
        });

        if (suppResponse.ok) {
          const suppData = await suppResponse.json();
          suppText = suppData.content?.[0]?.text || '';
        }
      }
      updateField('supplements', suppText);
      setAutoCorrected(false);

      // Appel 3 : Audit de coherence (appel separe)
      let finalPlan = planText;
      let auditResult = '';
      const auditClientProfile = `PROFIL CLIENT :\n- Allergies : ${form.allergies || 'Aucune'}\n- Intolerances : ${form.alimentsEvites || 'Aucune'}\n- Pathologies : ${form.pathologies || 'Aucune'}\n- Traitements : ${form.traitements || 'Aucun'}`;
      const scoreFormData = { ...form, _weeklyFeedback: weeklyFeedback };

      // Helper: run audit on a plan
      const runAudit = async (planToAudit) => {
        try {
          const resp = await fetch('/api/claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-fallback-key': apiKey.trim() },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4000,
              system: AUDIT_PROMPT,
              messages: [{ role: 'user', content: `${auditClientProfile}\n\nPLAN GENERE :\n${planToAudit}\n\nSUPPLEMENTS :\n${suppText || 'Aucun'}` }],
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            return data.content?.[0]?.text || '';
          }
        } catch { /* silent */ }
        return '';
      };

      // Initial audit
      auditResult = await runAudit(planText);
      if (auditResult && !auditResult.includes('AUDIT OK')) {
        finalPlan = planText + '\n\n---\n\nAUDIT DE COHERENCE :\n' + auditResult;
      }

      // Score the plan
      const initialScore = scorePlanQuality(finalPlan, suppText, scoreFormData, { isFollowup, followupWeek });

      // Auto-correction: single attempt if score is too low or hard fail
      if (shouldAutoCorrect(initialScore)) {
        try {
          const correctionResponse = await fetch('/api/claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-fallback-key': apiKey.trim() },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 16000,
              system: buildCorrectionPrompt(finalPlan, initialScore, form, auditResult),
              messages: [{ role: 'user', content: 'Corrige le plan ci-dessus selon les problemes detectes. Renvoie uniquement le plan corrige.' }],
            }),
          });

          if (correctionResponse.ok) {
            const correctionData = await correctionResponse.json();
            const correctedPlan = correctionData.content?.[0]?.text || '';

            if (correctedPlan) {
              // Re-audit the corrected version
              let correctedAuditResult = await runAudit(correctedPlan);
              let correctedFinal = correctedPlan;
              if (correctedAuditResult && !correctedAuditResult.includes('AUDIT OK')) {
                correctedFinal = correctedPlan + '\n\n---\n\nAUDIT DE COHERENCE :\n' + correctedAuditResult;
              }

              // Re-score the corrected + re-audited version
              const correctedScore = scorePlanQuality(correctedFinal, suppText, scoreFormData, { isFollowup, followupWeek });

              // Strict selection: never accept if new hard fail introduced
              if (!correctedScore.hasHardFail) {
                const fixedHardFail = initialScore.hasHardFail;
                const improvedWithoutRegression =
                  correctedScore.normalized > initialScore.normalized &&
                  correctedScore.coherence >= initialScore.coherence &&
                  correctedScore.constraints >= initialScore.constraints;

                if (fixedHardFail || improvedWithoutRegression) {
                  finalPlan = correctedFinal;
                  setAutoCorrected(true);
                }
              }
            }
          }
        } catch { /* correction failed silently — keep initial */ }
      }

      updateField('nutrition_plan', finalPlan);
      // Reseed l'editeur avec le nouveau plan genere (remount propre).
      reseedEditor(finalPlan, suppText, consultation.recipes);

      // Learning signal: log quality data for prompt improvement
      const wasAutoCorrected = finalPlan !== planText && finalPlan !== (planText + '\n\n---\n\nAUDIT DE COHERENCE :\n' + auditResult);
      const finalScore = scorePlanQuality(finalPlan, suppText, scoreFormData, { isFollowup, followupWeek });
      saveLearningSignal(buildLearningSignal(
        { ...form, _clientFormule: client?.formule || '' },
        { isFollowup, followupWeek, initialScore, finalScore, autoCorrected: wasAutoCorrected }
      ));

      // 3eme appel : Fiche Frigo structuree (JSON)
      try {
        const ficheInstruction = `A partir du plan nutrition et des supplements ci-dessous, genere UNIQUEMENT un objet JSON valide (sans texte autour, sans bloc markdown) avec cette structure exacte :

{
  "repas": {
    "petit_dejeuner": ["option 1", "option 2", "option 3"],
    "dejeuner": ["option 1", "option 2", "option 3"],
    "diner": ["option 1", "option 2", "option 3"],
    "collation": "suggestion de collation"
  },
  "a_privilegier": ["aliment 1", "aliment 2", "aliment 3"],
  "a_limiter": ["aliment 1", "aliment 2"],
  "hydratation": "ex: 2L/jour + tisanes",
  "supplements": {
    "matin_a_jeun": ["Fer 30mg + Vit C 500mg"],
    "petit_dejeuner": ["Vitamine D3 2000UI + K2"],
    "midi": ["Omega-3 2g"],
    "soir": ["Zinc 30mg"],
    "coucher": ["Magnesium 300mg"]
  }
}

Respecte EXACTEMENT ces noms de cles (snake_case). Chaque liste peut etre vide mais doit exister. Les options de repas doivent etre courtes et concretes (1-2 lignes max). Reponds UNIQUEMENT avec le JSON, sans backticks, sans texte autour.

--- PLAN NUTRITION ---
${planData.content?.[0]?.text || ''}

--- SUPPLEMENTS ---
${suppText}`;

        const ficheResponse = await fetch('/api/claude', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-fallback-key': apiKey.trim(),
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3000,
            system: 'Tu es un assistant qui structure des donnees nutritionnelles au format JSON strict.',
            messages: [{ role: 'user', content: ficheInstruction }],
          }),
        });

        if (ficheResponse.ok) {
          const ficheData = await ficheResponse.json();
          let raw = (ficheData.content?.[0]?.text || '').trim();
          // Strip ```json ... ``` fences si presents
          raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          // Extraire le premier objet JSON si du texte parasite
          const firstBrace = raw.indexOf('{');
          const lastBrace = raw.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            raw = raw.slice(firstBrace, lastBrace + 1);
          }
          try {
            const parsed = JSON.parse(raw);
            updateField('fiche_frigo_json', parsed);
          } catch (e) {
            console.warn('Fiche frigo JSON invalide, fallback regex active', e);
          }
        }
      } catch (ficheErr) {
        console.warn('Fiche frigo generation echouee (non bloquant)', ficheErr);
      }

    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleTemplateSelect = (plan, supp) => {
    setConsultation(prev => ({ ...prev, nutrition_plan: plan, supplements: supp }));
    reseedEditor(plan, supp, consultation.recipes);
    setShowTemplates(false);
  };

  const handleSave = () => {
    if (!consultation.mgd_recommendation) {
      showSaveToast('Sélectionnez une recommandation biologique avant de sauvegarder');
      return;
    }

    // Safety : lire le DOM via ref au cas ou un keystroke est passe apres
    // le dernier debounce. Sinon, utiliser les drafts React (source habituelle).
    const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
    const planToSave = edited?.plan ?? planDraft;
    const suppToSave = edited?.supplements ?? supplementsDraft;
    const recipesToSave = edited?.recipes ?? recipesDraft;

    const mgdRec = consultation.mgd_recommendation || 'none';
    const bloodTestDone = mgdRec === 'blood' || mgdRec === 'advanced';
    const dnaTestDone = mgdRec === 'advanced';

    setConsultation(prev => ({
      ...prev,
      nutrition_plan: planToSave,
      supplements: suppToSave,
      recipes: recipesToSave,
    }));
    onSave({
      id: consultationId || undefined,
      clientId,
      consultantName: 'Anissa',
      date: initialConsultation?.date || new Date().toISOString(),
      observations: consultation.observations,
      bloodTestDone,
      dnaTestDone,
      mgdRecommendation: mgdRec,
      nutritionalObservations: consultation.nutritional_observations,
      nutritionPlan: planToSave,
      supplements: suppToSave,
      recipes: recipesToSave,
      notesForCoach: consultation.notes_for_coach,
      privateNotes: consultation.private_notes,
      ficheFrigoJson: consultation.fiche_frigo_json || null,
      labResults: consultation.lab_results || {},
      isFollowup,
      followupData: isFollowup ? {
        ...followupData,
        // Store previous values for PDF comparison
        _prevPoids: previousConsultation?.followupData?.poids_actuel || form.poids || null,
        _prevTourTaille: previousConsultation?.followupData?.tour_taille || form.tourTaille || null,
        _prevTourHanche: previousConsultation?.followupData?.tour_hanche || form.tourHanche || null,
        _prevTourBras: previousConsultation?.followupData?.tour_bras || form.tourBras || null,
        _prevTourCuisse: previousConsultation?.followupData?.tour_cuisse || form.tourCuisse || null,
        _prevMasseGrasse: previousConsultation?.followupData?.masse_grasse || form.masseGrasse || null,
      } : null,
      weeklyFeedback: isFollowup ? weeklyFeedback : null,
      followupWeek: isFollowup ? followupWeek : null,
      previousConsultationId: previousConsultation?.id || null,
    });
    clearDraft(clientId, consultationId);
    isDirtyRef.current = false;
    setAutoSaveStatus('saved');
  };

  return (
    <div className="nutrition-consultation">
      {showTemplates && (
        <NutritionTemplates
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {pendingAlerts && (
        <ContraIndicationAlert
          alerts={pendingAlerts}
          onCancel={() => setPendingAlerts(null)}
          onConfirm={() => { doGenerate(); }}
        />
      )}

      {showVersions && (
        <div className="ci-backdrop" role="dialog" aria-modal="true">
          <div className="ci-modal" style={{ borderTopColor: '#7c5cbf' }}>
            <div className="ci-header">
              <span className="ci-icon">🕐</span>
              <h3>Historique des versions du plan</h3>
            </div>
            <p className="ci-intro">
              {planVersions.length} version{planVersions.length > 1 ? 's' : ''} sauvegardee{planVersions.length > 1 ? 's' : ''} localement
              (max {3}). Tu peux restaurer une ancienne version en cas de besoin.
            </p>
            <ul className="ci-list">
              {planVersions.map((v) => (
                <li key={v.id}>
                  <strong>{v.label || 'Version sauvegardee'}</strong>
                  <div className="ci-desc">
                    {formatDate(v.savedAt)} · {(v.nutritionPlan || '').length} car.
                    {v.supplements ? ` · ${(v.supplements || '').length} car. supp.` : ''}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '.8rem' }}
                      onClick={() => {
                        if (consultation.nutrition_plan && !confirm('Remplacer le plan actuel par cette version ?')) return;
                        // Sauver l'actuel avant de restaurer
                        if (consultation.nutrition_plan) {
                          savePlanVersion(clientId, {
                            nutritionPlan: consultation.nutrition_plan,
                            supplements: consultation.supplements,
                            recipes: consultation.recipes,
                            ficheFrigoJson: consultation.fiche_frigo_json || null,
                            label: 'Avant restauration',
                          });
                        }
                        setConsultation(prev => ({
                          ...prev,
                          nutrition_plan: v.nutritionPlan || '',
                          supplements: v.supplements || '',
                          recipes: v.recipes || '',
                          fiche_frigo_json: v.ficheFrigoJson || null,
                        }));
                        reseedEditor(v.nutritionPlan || '', v.supplements || '', v.recipes || '');
                        setPlanVersions(getPlanVersions(clientId));
                        setShowVersions(false);
                      }}
                    >
                      Restaurer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="ci-actions">
              <button className="btn btn-secondary" onClick={() => setShowVersions(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      <div className="nutrition-header">
        <h2>Consultation nutrition</h2>
        <span className="nutrition-client-name">{form.prenom || 'Client'}</span>
      </div>

      {/* Pipeline status bar */}
      {(() => {
        const current = consultation.status || 'questionnaire_recu';
        const statusInfo = PIPELINE_STATUSES.find(s => s.key === current) || PIPELINE_STATUSES[0];
        const suggested = suggestStatus(consultation);
        const suggestedInfo = suggested && suggested !== current ? PIPELINE_STATUSES.find(s => s.key === suggested) : null;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'rgba(255,255,255,.03)', borderRadius: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '.72rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px', flexShrink: 0 }}>Statut</span>
            <select
              value={current}
              onChange={(e) => updateField('status', e.target.value)}
              style={{ background: statusInfo.color + '22', border: `1px solid ${statusInfo.color}55`, borderRadius: 6, padding: '4px 10px', color: statusInfo.color, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
            >
              {PIPELINE_STATUSES.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            {suggestedInfo && (
              <button
                type="button"
                onClick={() => updateField('status', suggested)}
                style={{ background: suggestedInfo.color + '18', border: `1px solid ${suggestedInfo.color}44`, borderRadius: 6, padding: '3px 10px', color: suggestedInfo.color, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}
              >
                &#8594; {suggestedInfo.label}
              </button>
            )}
          </div>
        );
      })()}

      {/* Followup banner */}
      {isFollowup && previousConsultation && (
        <div className="followup-banner">
          Consultation de suivi — Semaine {followupWeek}/4 — Derniere consultation : {formatDate(previousConsultation.date)}
        </div>
      )}

      {/* Step progress */}
      <div className="nutrition-steps">
        {stepLabels.map((label, i) => (
          <button
            key={i}
            className={`nutrition-step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'completed' : ''}`}
            onClick={() => setStep(i + 1)}
          >
            <span className="nutrition-step-num">{i + 1}</span>
            <span className="nutrition-step-label">{label}</span>
          </button>
        ))}
      </div>

      {/* Step: Client summary (read-only) */}
      {currentStepType === 'summary' && (
        <div className="nutrition-form-section">
          {/* Pre-RDV clinical summary */}
          {(() => {
            const summary = buildPreRdvSummary(form);
            if (!summary.hasData) return null;
            return (
              <div style={{ background: 'rgba(26,46,31,.15)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                <h4 style={{ fontSize: '.85rem', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Synthese pre-RDV</h4>
                {summary.objectif && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px' }}>Objectif</span>
                    <div style={{ fontSize: '.88rem', color: '#f0f0e8', fontWeight: 600, marginTop: 2 }}>{summary.objectif}</div>
                  </div>
                )}
                {summary.priorities.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px' }}>Priorites detectees</span>
                    <div style={{ marginTop: 4 }}>
                      {summary.priorities.map((p, i) => (
                        <div key={i} style={{ fontSize: '.83rem', color: '#f87171', display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span style={{ color: '#f87171', fontWeight: 700 }}>{i + 1}.</span> {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {summary.vigilance.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px' }}>Points de vigilance</span>
                    <div style={{ marginTop: 4 }}>
                      {summary.vigilance.map((v, i) => (
                        <div key={i} style={{ fontSize: '.83rem', color: '#fbbf24', display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span>&#9888;</span> {v}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {summary.axes.length > 0 && (
                  <div>
                    <span style={{ fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px' }}>Axes de travail</span>
                    <div style={{ marginTop: 4 }}>
                      {summary.axes.map((a, i) => (
                        <div key={i} style={{ fontSize: '.83rem', color: '#4ade80', display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span>&#8594;</span> {a}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <h3>Resume du client</h3>
          <p className="nutrition-readonly-notice">Donnees du profil (lecture seule)</p>
          <div className="nutrition-summary-grid">
            <div className="nutrition-summary-item">
              <label>Prenom</label>
              <div>{form.prenom || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Nom</label>
              <div>{form.nom || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Age</label>
              <div>{form.age ? `${form.age} ans` : 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Genre</label>
              <div>{form.genre || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Poids</label>
              <div>{form.poids ? `${form.poids} kg` : 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Taille</label>
              <div>{form.taille ? `${form.taille} cm` : 'Non renseigne'}</div>
            </div>
            {(form.tourTaille || form.tourHanche || form.masseGrasse) && (
              <div className="nutrition-summary-item full">
                <label>Mesures corporelles</label>
                <div>{
                  [
                    form.tourTaille ? `Taille: ${form.tourTaille}cm` : '',
                    form.tourHanche ? `Hanche: ${form.tourHanche}cm` : '',
                    form.tourPoitrine ? `Poitrine: ${form.tourPoitrine}cm` : '',
                    form.tourBras ? `Bras: ${form.tourBras}cm` : '',
                    form.tourCuisse ? `Cuisse: ${form.tourCuisse}cm` : '',
                    form.masseGrasse ? `MG: ${form.masseGrasse}%` : '',
                    form.masseMusculaire ? `MM: ${form.masseMusculaire}%` : '',
                  ].filter(Boolean).join(' | ')
                }</div>
              </div>
            )}
            <div className="nutrition-summary-item">
              <label>Formule</label>
              <div>{formule.nom || (client?.categorie === 'nutrition' ? 'Client nutrition' : 'Non renseigne')}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Email</label>
              <div>{form.email || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Telephone</label>
              <div>{form.telephone || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item full">
              <label>Objectifs</label>
              <textarea
                className="nutrition-summary-textarea"
                value={consultation.objectifs_display || [
                  form.objectifPrincipalNutrition,
                  form.objectifPrincipal,
                  form.objectifSecondaire,
                  form.objectif,
                  (form.symptomesObjectifs || []).join(', '),
                  form.motivationProfonde ? `Motivation : ${form.motivationProfonde}` : '',
                  form.pourquoiMaintenant ? `Pourquoi maintenant : ${form.pourquoiMaintenant}` : '',
                ].filter(Boolean).join(' | ') || ''}
                onChange={(e) => updateField('objectifs_display', e.target.value)}
                placeholder="Objectifs du client..."
                rows={2}
                style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 10px', color: '#d4c9a8', fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
            <div className="nutrition-summary-item full">
              <label>Habitudes alimentaires</label>
              <div>{
                [
                  form.objectifNutrition ? `Objectif : ${form.objectifNutrition}` : '',
                  form.preferencesAlimentaires ? `Preferences : ${form.preferencesAlimentaires}` : '',
                  form.nbRepas ? `${form.nbRepas} repas/jour` : '',
                  form.niveauCuisine ? `Cuisine : ${form.niveauCuisine}` : '',
                  form.frequenceRestaurant ? `Restaurant : ${form.frequenceRestaurant}` : '',
                  form.hydratation ? `Hydratation : ${form.hydratation}` : '',
                  form.digestion ? `Digestion : ${form.digestion}` : '',
                  form.alimentsEvites ? `Aliments evites : ${form.alimentsEvites}` : '',
                ].filter(Boolean).join(' | ') || 'Non renseigne'
              }</div>
            </div>
            <div className="nutrition-summary-item full">
              <label>Allergies / Intolerances</label>
              <div>{form.allergies || form.alimentsEvites || 'Aucune'}</div>
            </div>
            <div className="nutrition-summary-item full">
              <label>Activite sportive</label>
              <div>{
                [
                  form.niveau ? `Niveau : ${form.niveau}` : '',
                  form.frequence ? `${form.frequence}x/sem` : '',
                  form.duree || '',
                  form.lieu || '',
                  form.typeSport || '',
                  form.frequenceSport ? `${form.frequenceSport}x/sem` : '',
                  form.activitePhysique || '',
                ].filter(Boolean).join(' | ') || 'Non renseigne'
              }</div>
            </div>
          </div>

          {(() => {
            const symp = detectSymptomsFromForm(form);
            if (!symp.length) return null;
            const sympLabels = {
              fatigue: 'Fatigue', digestion: 'Digestion', bloating: 'Ballonnements',
              stress: 'Stress', sleep: 'Sommeil', cravings: 'Fringales sucre',
              inflammation: 'Inflammation', skin_hair: 'Peau / Cheveux',
              weight_gain: 'Surpoids', metabolic: 'Métabolisme',
              female_hormones: 'Hormones féminines', pms_cycle: 'SPM / Cycle',
              thyroid: 'Thyroïde', performance: 'Performance',
            };
            return (
              <div style={{
                marginTop: 20,
                padding: '12px 16px',
                background: 'rgba(106,191,138,.06)',
                border: '1px solid rgba(106,191,138,.2)',
                borderLeft: '3px solid rgba(106,191,138,.5)',
                borderRadius: 10,
              }}>
                <div style={{
                  fontSize: '.68rem', fontWeight: 700,
                  color: 'rgba(106,191,138,.6)',
                  textTransform: 'uppercase', letterSpacing: '.4px',
                  marginBottom: 8,
                }}>
                  Symptômes détectés — suggestions automatiques
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {symp.map(s => (
                    <span key={s} style={{
                      padding: '2px 8px', borderRadius: 20,
                      background: 'rgba(106,191,138,.1)',
                      border: '1px solid rgba(106,191,138,.2)',
                      fontSize: '.72rem', color: '#8abf9a',
                    }}>
                      {sympLabels[s] || s}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.25)', marginTop: 6 }}>
                  Ces suggestions sont basées sur le profil client. La décision finale reste la vôtre.
                </div>
              </div>
            );
          })()}

          <div style={{
            marginTop: 12,
            padding: '16px',
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: '.75rem', fontWeight: 700,
              color: '#c5b07a',
              textTransform: 'uppercase', letterSpacing: '.5px',
              marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              ⚕️ Recommandation bilan MGD
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  value: 'none',
                  label: 'Aucun test pour le moment',
                  desc: '',
                  color: 'rgba(255,255,255,.3)',
                },
                {
                  value: 'blood',
                  label: 'Bilan sanguin recommandé',
                  desc: 'Oméga-3 · Glycémie / Insuline · CRP · Vitamine D',
                  color: '#8abf9a',
                },
                {
                  value: 'advanced',
                  label: 'Bilan avancé recommandé',
                  desc: 'Bilan sanguin complet + Test ADN nutritionnel',
                  color: '#c5b07a',
                },
              ].map(opt => {
                const selected = consultation.mgd_recommendation === opt.value;
                return (
                  <label
                    key={opt.value}
                    onClick={() => updateField('mgd_recommendation', opt.value)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      background: selected ? 'rgba(255,255,255,.05)' : 'none',
                      border: selected
                        ? `1px solid ${opt.color}`
                        : '1px solid rgba(255,255,255,.05)',
                      transition: 'all .15s',
                    }}
                  >
                    {/* Radio visuel */}
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: `2px solid ${selected ? opt.color : 'rgba(255,255,255,.2)'}`,
                      background: selected ? opt.color : 'none',
                      flexShrink: 0, marginTop: 2,
                      transition: 'all .15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && (
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#1a2e1f',
                        }} />
                      )}
                    </div>
                    <div>
                      <div style={{
                        fontSize: '.83rem', fontWeight: 600,
                        color: selected ? opt.color : 'rgba(255,255,255,.5)',
                        transition: 'color .15s',
                      }}>
                        {opt.label}
                      </div>
                      {opt.desc && (
                        <div style={{
                          fontSize: '.72rem',
                          color: selected ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.2)',
                          marginTop: 2,
                        }}>
                          {opt.desc}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Lab results input (shown when blood test is done) */}
          {(consultation.mgd_recommendation === 'blood' || consultation.mgd_recommendation === 'advanced') && (
            <div style={{
              marginTop: 16,
              padding: '16px',
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
            }}>
              <div style={{
                fontSize: '.75rem', fontWeight: 700,
                color: '#c5b07a',
                textTransform: 'uppercase', letterSpacing: '.5px',
                marginBottom: 12,
              }}>
                🔬 Résultats biologiques
              </div>
              <p style={{ fontSize: '.75rem', color: '#6b5f48', marginBottom: 10 }}>Saisissez les valeurs disponibles. Les champs vides sont ignorés.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {LAB_MARKERS_UI.map(({ key, label, unit }) => (
                  <div key={key} className="field" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '.72rem' }}>{label} ({unit})</label>
                    <input
                      type="number"
                      step="any"
                      value={consultation.lab_results?.[key] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setConsultation(prev => ({
                          ...prev,
                          lab_results: { ...prev.lab_results, [key]: val === '' ? '' : Number(val) },
                        }));
                      }}
                      placeholder="-"
                      style={{ fontSize: '.8rem', padding: '6px 8px' }}
                    />
                  </div>
                ))}
              </div>

              {/* Live interpretation preview */}
              {(() => {
                const labData = consultation.lab_results || {};
                const hasData = Object.values(labData).some(v => v !== '' && v != null);
                if (!hasData) return null;
                const analysis = analyzeLabResults(labData);
                if (analysis.signals.length === 0) return (
                  <div style={{ marginTop: 10, fontSize: '.78rem', color: '#2a9d5c' }}>Tous les marqueurs saisis sont dans les normes fonctionnelles.</div>
                );
                return (
                  <div style={{ marginTop: 10, background: 'rgba(124,92,191,.06)', borderRadius: 8, padding: '10px 14px', fontSize: '.78rem' }}>
                    <strong style={{ display: 'block', marginBottom: 6, color: '#d4c9a8' }}>Signaux detectes ({analysis.signals.length})</strong>
                    {analysis.adjustments.slice(0, 6).map((adj, i) => (
                      <div key={i} style={{ marginBottom: 6 }}>
                        <span style={{ color: '#d4c9a8', fontWeight: 600 }}>{adj.label}</span>
                        <span style={{ color: '#6b5f48', marginLeft: 6 }}>— {adj.dietary[0]}</span>
                        {adj.caution && <div style={{ color: '#d45c4c', fontSize: '.72rem', marginTop: 2 }}>{adj.caution}</div>}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Corrélations symptômes ↔ biologie */}
              {(() => {
                const labData = consultation.lab_results || {};
                const hasData = Object.values(labData).some(v => v !== '' && v != null);
                if (!hasData) return null;
                const labAnalysis = analyzeLabResults(labData);
                if (!labAnalysis.signals?.length) return null;
                const symptoms = detectSymptomsFromForm(form);
                const correlation = buildMGDCorrelation(symptoms, labAnalysis.signals);
                if (!correlation.hasCorrelations && !correlation.uncorrelatedSignals.length) return null;

                return (
                  <div style={{
                    marginTop: 12,
                    padding: '12px 14px',
                    background: correlation.hasCritical
                      ? 'rgba(248,113,113,.06)' : 'rgba(197,176,122,.05)',
                    border: `1px solid ${correlation.hasCritical
                      ? 'rgba(248,113,113,.2)' : 'rgba(197,176,122,.15)'}`,
                    borderRadius: 10,
                  }}>
                    <div style={{
                      fontSize: '.72rem', fontWeight: 700,
                      color: correlation.hasCritical ? '#f87171' : '#c5b07a',
                      textTransform: 'uppercase', letterSpacing: '.4px',
                      marginBottom: 10,
                    }}>
                      🔗 Corrélations symptômes ↔ biologie
                    </div>

                    {/* Résumé clinique — en haut, lecture rapide */}
                    {correlation.clinicalSummary && (
                      <div style={{
                        marginBottom: 12, padding: '10px 12px',
                        background: correlation.hasCritical
                          ? 'rgba(248,113,113,.1)' : 'rgba(197,176,122,.08)',
                        borderRadius: 8,
                        borderLeft: `3px solid ${correlation.hasCritical ? '#f87171' : '#c5b07a'}`,
                      }}>
                        <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#f0f0e8', marginBottom: 3 }}>
                          {correlation.hasCritical ? '⚠️' : '📋'} {correlation.clinicalSummary.mainIssue}
                        </div>
                        <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.5)' }}>
                          Confirmé par : {correlation.clinicalSummary.confirmedBy}
                        </div>
                        {correlation.clinicalSummary.topAction && (
                          <div style={{ fontSize: '.75rem', color: '#8abf9a', marginTop: 4, fontStyle: 'italic' }}>
                            → {correlation.clinicalSummary.topAction.slice(0, 80)}
                            {correlation.clinicalSummary.topAction.length > 80 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Corrélations priorisées */}
                    {correlation.correlations.map((c, i) => {
                      const priorityColors = {
                        high:   { bg: 'rgba(248,113,113,.06)', border: 'rgba(248,113,113,.3)', badge: '#f87171', label: 'Priorité haute' },
                        medium: { bg: 'rgba(251,191,36,.05)',  border: 'rgba(251,191,36,.25)', badge: '#fbbf24', label: 'Priorité moyenne' },
                        watch:  { bg: 'rgba(255,255,255,.03)', border: 'rgba(255,255,255,.08)', badge: '#94a3b8', label: 'Surveillance' },
                      };
                      const pc = priorityColors[c.priority] || priorityColors.watch;
                      return (
                        <div key={i} style={{
                          marginBottom: 6, padding: '7px 10px',
                          background: pc.bg, borderRadius: 7,
                          border: `1px solid ${pc.border}`,
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                        }}>
                          <span style={{
                            fontSize: '.6rem', fontWeight: 700, padding: '2px 6px',
                            borderRadius: 10, background: pc.border, color: pc.badge,
                            whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1,
                          }}>
                            {pc.label}
                          </span>
                          <div>
                            <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#e0d8c0' }}>
                              {c.symptomLabel}
                            </div>
                            <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.35)', marginTop: 1 }}>
                              {c.confirmedBy.map(b => b.label).join(' · ')}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Actions prioritaires */}
                    {correlation.alerts.length > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 10,
                        borderTop: '1px solid rgba(255,255,255,.06)' }}>
                        <div style={{ fontSize: '.68rem', fontWeight: 700,
                          color: '#f87171', textTransform: 'uppercase',
                          letterSpacing: '.3px', marginBottom: 8 }}>
                          ⚡ Actions prioritaires
                        </div>
                        {correlation.alerts.slice(0, 3).map((a, i) => (
                          <div key={i} style={{
                            fontSize: '.75rem', color: '#b0c4a8',
                            paddingLeft: 10,
                            borderLeft: '2px solid rgba(248,113,113,.3)',
                            marginBottom: 6, lineHeight: 1.5,
                          }}>
                            <strong style={{ color: '#f87171' }}>{a.label}</strong>
                            <span style={{ color: 'rgba(255,255,255,.35)', marginLeft: 6 }}>
                              — {a.action}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CTA — Régénérer avec MGD */}
                    {correlation.hasCorrelations && (
                      <button
                        type="button"
                        onClick={() => {
                          const btn = document.querySelector('.btn-generate, [class*="btn-generate"]');
                          if (btn) { btn.scrollIntoView({ behavior: 'smooth' }); btn.focus(); }
                          showSaveToast('Cliquez sur Régénérer pour intégrer les priorités MGD au plan');
                        }}
                        style={{
                          width: '100%', marginTop: 12, padding: '9px',
                          borderRadius: 8, border: '1px solid rgba(106,191,138,.25)',
                          background: 'rgba(106,191,138,.08)', color: '#8abf9a',
                          cursor: 'pointer', fontSize: '.8rem', fontWeight: 600,
                          transition: 'all .15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background='rgba(106,191,138,.18)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='rgba(106,191,138,.08)'; }}
                      >
                        ✨ Régénérer le plan avec les priorités MGD
                      </button>
                    )}

                    {/* Signaux sans symptôme déclaré */}
                    {correlation.uncorrelatedSignals.length > 0 && (
                      <div style={{
                        marginTop: 8, fontSize: '.7rem',
                        color: 'rgba(255,255,255,.25)', fontStyle: 'italic',
                      }}>
                        Signaux détectés sans symptôme déclaré — à explorer au prochain RDV.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Step: Follow-up (only for returning clients) */}
      {currentStepType === 'followup' && (
        <>
          <div className="nutrition-form-section" style={{ marginBottom: 16 }}>
            <h3>Suivi semaine {followupWeek}/4</h3>
            <p style={{ fontSize: '.85rem', color: '#8a8a7a', marginBottom: 12 }}>
              {followupWeek === 1 && 'Evaluation de la tolerance et de l\'adherence au plan initial.'}
              {followupWeek === 2 && 'Premiers ajustements energie, faim et digestion.'}
              {followupWeek === 3 && 'Optimisation des portions, timing et recuperation.'}
              {followupWeek === 4 && 'Consolidation des acquis et preparation a l\'autonomie.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { key: 'energy', label: 'Energie' },
                { key: 'digestion', label: 'Digestion' },
                { key: 'hunger', label: 'Faim / Satiete' },
                { key: 'adherence', label: 'Adherence au plan' },
                { key: 'performance', label: 'Performance' },
                { key: 'cravings', label: 'Fringales / Envies' },
              ].map(({ key, label }) => (
                <div key={key} className="field">
                  <label>{label}</label>
                  <select
                    value={weeklyFeedback[key]}
                    onChange={e => setWeeklyFeedback(prev => ({ ...prev, [key]: e.target.value }))}
                  >
                    <option value="">--</option>
                    <option value="Nettement ameliore">Nettement ameliore</option>
                    <option value="Legerement ameliore">Legerement ameliore</option>
                    <option value="Identique">Identique</option>
                    <option value="Degrade">Degrade</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="field full-width" style={{ marginTop: 10 }}>
              <label>Notes client cette semaine</label>
              <textarea
                value={weeklyFeedback.notes}
                onChange={e => setWeeklyFeedback(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                placeholder="Observations, difficultes, questions..."
              />
            </div>
          </div>
          <FollowUpStep
            followupData={followupData}
            onChange={setFollowupData}
            previousConsultation={previousConsultation}
            clientForm={form}
          />
        </>
      )}

      {/* Observations step removed — data auto-populated from client questionnaire and used in AI prompt */}

      {/* Step: Nutrition Plan — cockpit clinique SaaS */}
      {currentStepType === 'plan' && (() => {
        const hasPlan = !!(planDraft || consultation.nutrition_plan);
        const clientName = form.prenom || client?.prenom || 'Client';
        const today = new Date().toISOString();

        // Source de verite unique : les drafts React (push-based depuis l'editeur).
        // Pour les exports, on fait une lecture ref finale en cas de keystroke non debounced.
        const readEdited = () => {
          const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
          return {
            plan: edited?.plan ?? planDraft,
            supplements: edited?.supplements ?? supplementsDraft,
            recipes: edited?.recipes ?? recipesDraft,
          };
        };

        const doExportPdf = async () => {
          console.log('[PDF] doExportPdf CALLED');
          setPdfError('');
          const { plan, supplements, recipes } = readEdited();
          console.log('[PDF] plan length:', plan?.length, 'supplements length:', supplements?.length);
          const currentScore = scorePlanQuality(plan, supplements, { ...form, _weeklyFeedback: weeklyFeedback }, { isFollowup, followupWeek });
          const fullText = (plan || '') + '\n' + (supplements || '');
          const validation = validatePlanForPDF(fullText, currentScore, { isFollowup });
          console.log('[PDF] validation:', validation);
          if (!validation.valid) {
            console.log('[PDF] BLOCKED by validation:', validation.errors);
            setPdfError('Export bloque : ' + validation.errors.join(' | '));
            return;
          }
          const sections = structurePlanSections(plan, supplements, { isFollowup });
          console.log('[PDF DEBUG] sections:', sections.length, sections.map(s => ({ title: s.title, type: s.type, contentLen: s.content?.length })));
          try {
            await exportConsultationPDF({
              observations: consultation.observations,
              nutritionalObservations: consultation.nutritional_observations,
              bloodTestDone: consultation.blood_test_done,
              dnaTestDone: consultation.dna_test_done,
              nutritionPlan: cleanPlanForPDF(plan),
              supplements: cleanPlanForPDF(supplements),
              recipes,
              notesForCoach: consultation.notes_for_coach,
              date: new Date().toISOString(),
              isFollowup,
              followupData: isFollowup ? followupData : null,
              sections,
            }, client);
            showSaveToast('PDF exporte');
          } catch (err) {
            console.error('PDF export failed', err);
            setPdfError('Export PDF echoue : ' + (err?.message || 'erreur inconnue'));
          }
        };

        const doExportPack = async () => {
          setPdfError('');
          const { plan, supplements, recipes } = readEdited();
          const currentScore = scorePlanQuality(plan, supplements, { ...form, _weeklyFeedback: weeklyFeedback }, { isFollowup, followupWeek });
          const fullText = (plan || '') + '\n' + (supplements || '');
          const validation = validatePlanForPDF(fullText, currentScore, { isFollowup });
          if (!validation.valid) {
            setPdfError('Export dossier bloque : ' + validation.errors.join(' | '));
            return;
          }
          const sections = structurePlanSections(plan, supplements, { isFollowup });
          const labDataForPdf = consultation.lab_results || {};
          const hasLabForPdf = Object.values(labDataForPdf).some(v => v !== '' && v != null);
          const correlationForPdf = hasLabForPdf
            ? buildMGDCorrelation(
                detectSymptomsFromForm(form),
                analyzeLabResults(labDataForPdf).signals || []
              )
            : null;
          try {
            await exportClientPackPDF({
              nutritionPlan: cleanPlanForPDF(plan),
              supplements: cleanPlanForPDF(supplements),
              recipes,
              date: new Date().toISOString(),
              isFollowup,
              sections,
              mgdRecommendation: consultation.mgd_recommendation || 'none',
              bloodTestDone: consultation.mgd_recommendation === 'blood' || consultation.mgd_recommendation === 'advanced',
              dnaTestDone: consultation.mgd_recommendation === 'advanced',
            }, client, {
              sections,
              coverFields: {
                prenom: form.prenom || client?.prenom || '',
                objectif: form.objectifPrincipalNutrition || form.objectifPrincipal || '',
              },
              mgdCorrelation: correlationForPdf,
            });
            showSaveToast('Dossier client exporte');
          } catch (err) {
            console.error('Pack export failed', err);
            setPdfError('Export dossier echoue : ' + (err?.message || 'erreur inconnue'));
          }
        };

        const doExportCover = async () => {
          try {
            await exportCoverPDF({
              blood_test_done: consultation.blood_test_done,
              dna_test_done: consultation.dna_test_done,
              date: new Date().toISOString(),
              coverFields,
            }, client);
          } catch (err) {
            console.error('Cover export failed', err);
            setPdfError('Export cover echoue : ' + (err?.message || 'erreur inconnue'));
          }
        };

        const renderEditorTab = () => {
          if (editorTab === 'plan') {
            if (hasPlan) {
              return (
                <NutritionEditor
                  key={`editor-${editorSeed}`}
                  planText={planDraft}
                  supplementsText={supplementsDraft}
                  recipesText={recipesDraft}
                  form={form}
                  client={client}
                  getEditedDataRef={editorGetDataRef}
                  onDraftChange={handleDraftChange}
                  hideActions
                  onSave={(plan, supplements, recipes) => {
                    setConsultation(prev => ({ ...prev, nutrition_plan: plan, supplements, recipes }));
                    setPlanDraft(plan);
                    setSupplementsDraft(supplements);
                    setRecipesDraft(recipes);
                  }}
                  onExportPDF={() => doExportPdf()}
                  onExportCover={() => setShowCoverForm(true)}
                  onExportPack={() => doExportPack()}
                />
              );
            }
            return (
              <div style={{ padding: 24, textAlign: 'center', color: '#8a8a7a', background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.1)', borderRadius: 12 }}>
                <p style={{ marginBottom: 12, fontSize: '.9rem' }}>Aucun plan genere pour l'instant.</p>
                <p style={{ fontSize: '.8rem' }}>Utilise le bouton <strong>Regenerer</strong> en haut, ou un template, pour creer le plan initial.</p>
              </div>
            );
          }
          if (editorTab === 'frigo') {
            const fj = consultation.fiche_frigo_json;
            return (
              <div style={{ padding: 16 }}>
                <p style={{ fontSize: '.82rem', color: '#8a8a7a', marginBottom: 12 }}>
                  Edite et reorganise la fiche frigo (3 vues : apercu, edition, vue client).
                </p>
                <button
                  type="button"
                  className="btn btn-anissa-primary"
                  onClick={() => setShowFrigoModal(true)}
                  disabled={!hasPlan}
                  style={{ padding: '10px 18px', borderRadius: 10 }}
                >
                  Ouvrir l'editeur fiche frigo
                </button>
                {fj ? (
                  <div style={{ marginTop: 16, background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 12px', fontSize: '.78rem', color: '#c0b890', lineHeight: 1.55 }}>
                    <strong style={{ display: 'block', marginBottom: 6, color: '#d4c9a8' }}>Fiche structuree disponible</strong>
                    <div>Petit-dej : {(fj.repas?.petit_dejeuner || []).length} option(s)</div>
                    <div>Dejeuner : {(fj.repas?.dejeuner || []).length} option(s)</div>
                    <div>Diner : {(fj.repas?.diner || []).length} option(s)</div>
                    <div>A privilegier : {(fj.a_privilegier || []).length} / A limiter : {(fj.a_limiter || []).length}</div>
                  </div>
                ) : hasPlan ? (
                  <div style={{ marginTop: 12, fontSize: '.78rem', color: '#8a7a5a' }}>
                    Pas de JSON structure — la fiche frigo sera construite depuis le plan texte.
                  </div>
                ) : null}
              </div>
            );
          }
          if (editorTab === 's1s4') {
            const sections = hasPlan ? structurePlanSections(consultation.nutrition_plan, consultation.supplements, { isFollowup }) : [];
            const weekly = sections.filter(s => /semaine\s*[1-4]|rotation|plan\s*d[ae]?\s*action/i.test(s.title));
            if (!hasPlan) {
              return <div style={{ padding: 24, textAlign: 'center', color: '#8a8a7a' }}>Genere d'abord un plan pour visualiser la progression S1-S4.</div>;
            }
            if (weekly.length === 0) {
              return <div style={{ padding: 16, color: '#8a8a7a', fontSize: '.85rem' }}>Aucune section hebdomadaire detectee dans le plan.</div>;
            }
            return (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {weekly.map((s, i) => (
                  <div key={i} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '10px 14px', background: 'rgba(255,255,255,.02)' }}>
                    <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#8abf9a', letterSpacing: '.04em', marginBottom: 6, textTransform: 'uppercase' }}>{s.title}</div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '.82rem', color: '#d4c9a8', margin: 0, lineHeight: 1.55 }}>{s.content}</pre>
                  </div>
                ))}
              </div>
            );
          }
          if (editorTab === 'supp') {
            return (
              <div style={{ padding: 12 }}>
                <label style={{ display: 'block', fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>
                  Supplements recommandes
                </label>
                <textarea
                  value={consultation.supplements || ''}
                  onChange={(e) => updateField('supplements', e.target.value)}
                  placeholder="Protocole supplements + tableau horaire..."
                  rows={18}
                  style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '10px 12px', color: '#d4c9a8', fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.55 }}
                />
                <label style={{ display: 'block', fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.4px', marginTop: 14, marginBottom: 6 }}>
                  Recettes recommandees
                </label>
                <textarea
                  value={consultation.recipes || ''}
                  onChange={(e) => updateField('recipes', e.target.value)}
                  placeholder="Recettes specifiques..."
                  rows={8}
                  style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '10px 12px', color: '#d4c9a8', fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.55 }}
                />
              </div>
            );
          }
          return null;
        };

        const renderPreviewTab = () => {
          if (!hasPlan) {
            return (
              <div style={{ padding: 24, textAlign: 'center', color: '#8a8a7a', background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.1)', borderRadius: 12 }}>
                <p style={{ fontSize: '.88rem', marginBottom: 8 }}>Aucun apercu disponible.</p>
                <p style={{ fontSize: '.78rem' }}>Regenere le plan pour voir le rendu PDF, la fiche frigo et la cover.</p>
              </div>
            );
          }
          if (previewTab === 'pdf') {
            const { plan, supplements } = readEdited();
            return (
              <NutritionPdfBody
                sections={structurePlanSections(plan, supplements, { isFollowup })}
                isFollowup={isFollowup}
                clientName={clientName}
                date={formatDate(today)}
                followupWeek={followupWeek}
              />
            );
          }
          if (previewTab === 'frigo') {
            const { plan: fPlan, supplements: fSupp } = readEdited();
            const fSections = structurePlanSections(fPlan, fSupp, { isFollowup });
            const fromSections = extractFridgeDataFromSections(fSections) || {};
            const regexMeals = extractMeals(fPlan);
            const regexSupp = extractSupplements(fSupp || '');
            const ficheJson = consultation.fiche_frigo_json;
            const pickArr = (...sources) => sources.find(s => Array.isArray(s) && s.length > 0) || [];
            const pickStr = (...sources) => sources.find(s => typeof s === 'string' && s.trim()) || '';
            const data = {
              breakfast: pickArr(fromSections.breakfast, ficheJson?.repas?.petit_dejeuner, regexMeals.breakfast),
              lunch: pickArr(fromSections.lunch, ficheJson?.repas?.dejeuner, regexMeals.lunch),
              dinner: pickArr(fromSections.dinner, ficheJson?.repas?.diner, regexMeals.dinner),
              snack: pickStr(fromSections.snack, ficheJson?.repas?.collation, regexMeals.snack),
              toFavor: pickArr(fromSections.toFavor, ficheJson?.a_privilegier, regexMeals.toFavor),
              toLimit: pickArr(fromSections.toLimit, ficheJson?.a_limiter, regexMeals.toLimit),
              hydration: pickStr(fromSections.hydration, ficheJson?.hydratation, regexMeals.hydration, form.hydratation),
              supplements: {
                morningFasting: pickArr(ficheJson?.supplements?.matin_a_jeun, regexSupp.morningFasting),
                breakfast: pickArr(ficheJson?.supplements?.petit_dejeuner, regexSupp.breakfast),
                lunch: pickArr(ficheJson?.supplements?.midi, regexSupp.lunch),
                dinner: pickArr(ficheJson?.supplements?.soir, regexSupp.dinner),
                bedtime: pickArr(ficheJson?.supplements?.coucher, regexSupp.bedtime),
              },
            };
            const Section = ({ title, items, color = '#8abf9a' }) => {
              if (!items || items.length === 0) return null;
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '.66rem', fontWeight: 700, color, letterSpacing: '.12em', marginBottom: 6, textTransform: 'uppercase' }}>{title}</div>
                  {items.slice(0, 3).map((item, i) => (
                    <div key={i} style={{ fontSize: '.82rem', color: '#d4c9a8', paddingLeft: 10, marginBottom: 3, borderLeft: `2px solid ${color}33`, lineHeight: 1.5 }}>{String(item).replace(/\([^)]*\)/g, '').replace(/^[-–•*]\s*/, '').trim()}</div>
                  ))}
                </div>
              );
            };
            const TagRow = ({ title, items, color }) => {
              if (!items || items.length === 0) return null;
              return (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '.66rem', fontWeight: 700, color, letterSpacing: '.1em', marginBottom: 5, textTransform: 'uppercase' }}>{title}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {items.slice(0, 10).map((it, i) => (
                      <span key={i} style={{ background: `${color}18`, color, fontSize: '.72rem', padding: '2px 8px', borderRadius: 100 }}>{String(it).replace(/\([^)]*\)/g, '').trim()}</span>
                    ))}
                  </div>
                </div>
              );
            };
            return (
              <div style={{ padding: 4 }}>
                <div style={{ background: 'rgba(26,46,31,.22)', border: '1px solid rgba(106,191,138,.18)', borderRadius: 12, padding: 18, marginBottom: 12 }}>
                  <div style={{ fontSize: '.72rem', color: '#8abf9a', letterSpacing: '.18em', fontWeight: 700, marginBottom: 14 }}>FICHE FRIGO — {(form.prenom || clientName).toUpperCase()}</div>
                  <Section title="Petit-dejeuner" items={data.breakfast} />
                  <Section title="Dejeuner" items={data.lunch} />
                  <Section title="Diner" items={data.dinner} />
                  {data.snack && <Section title="Collation" items={[data.snack]} color="#c5b07a" />}
                  {data.hydration && <div style={{ fontSize: '.78rem', color: '#8abf9a', marginBottom: 12 }}>Hydratation : <span style={{ color: '#d4c9a8' }}>{data.hydration}</span></div>}
                  <TagRow title="A privilegier" items={data.toFavor} color="#8abf9a" />
                  <TagRow title="A limiter" items={data.toLimit} color="#c5b07a" />
                </div>
                <button
                  type="button"
                  className="btn btn-anissa-secondary"
                  onClick={() => setShowFrigoModal(true)}
                  style={{ width: '100%', padding: '10px 16px', borderRadius: 10, fontSize: '.8rem' }}
                >
                  Ouvrir l'editeur complet (3 vues)
                </button>
              </div>
            );
          }
          if (previewTab === 'cover') {
            return (
              <div style={{ padding: 32, minHeight: 420, background: 'linear-gradient(135deg, #0f1a14 0%, #1a2e1f 100%)', borderRadius: 12, border: '1px solid rgba(106,191,138,.18)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '.72rem', color: 'rgba(106,191,138,.7)', letterSpacing: '.2em', marginBottom: 16 }}>BENFITCOACH</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 300, color: '#f0f0e8', letterSpacing: '-.02em', marginBottom: 8 }}>{coverFields.prenom || clientName}</div>
                <div style={{ fontSize: '.95rem', color: '#8abf9a', marginBottom: 28 }}>{coverFields.sousTitre}</div>
                {coverFields.objectif && (
                  <div style={{ borderLeft: '2px solid rgba(106,191,138,.4)', paddingLeft: 14, marginBottom: 20 }}>
                    <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.15em', marginBottom: 4 }}>Objectif</div>
                    <div style={{ fontSize: '.95rem', color: '#d4c9a8' }}>{coverFields.objectif}</div>
                  </div>
                )}
                <div style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.5)', marginTop: 'auto' }}>{coverFields.date}</div>
                <button
                  type="button"
                  className="btn btn-anissa-secondary"
                  onClick={() => setShowCoverForm(true)}
                  style={{ marginTop: 20, alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 10, fontSize: '.78rem' }}
                >
                  Personnaliser la cover
                </button>
              </div>
            );
          }
          return null;
        };

        const Tab = ({ active, onClick, children }) => (
          <button
            type="button"
            onClick={onClick}
            className="nc-tab"
            style={{
              background: active ? 'rgba(106,191,138,.18)' : 'transparent',
              border: `1px solid ${active ? 'rgba(106,191,138,.4)' : 'rgba(255,255,255,.08)'}`,
              color: active ? '#9dd4b0' : '#8a8a7a',
              fontSize: '.78rem',
              fontWeight: 600,
              letterSpacing: '.02em',
              padding: '7px 14px',
              borderRadius: 999,
              cursor: 'pointer',
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            }}
          >{children}</button>
        );

        return (
          <div className="nc-cockpit" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ─── HEADER ACTIONS ─── */}
            <div className="nc-cockpit-header" style={{ position: 'sticky', top: 0, zIndex: 5, background: 'rgba(12,18,15,.92)', backdropFilter: 'blur(10px)', border: '1px solid rgba(106,191,138,.15)', borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Meta line */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '.72rem', color: '#8abf9a', textTransform: 'uppercase', letterSpacing: '.2em', fontWeight: 600 }}>Plan nutrition</span>
                  <span style={{ fontSize: '.82rem', color: '#d4c9a8', fontWeight: 500 }}>{clientName}</span>
                  {isFollowup && <span style={{ fontSize: '.7rem', background: 'rgba(124,92,191,.18)', color: '#b49ce0', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>Suivi S{followupWeek}/4</span>}
                  {autoCorrected && <span style={{ fontSize: '.7rem', background: 'rgba(255,200,60,.15)', color: '#e8c560', padding: '2px 8px', borderRadius: 999 }}>Auto-corrige</span>}
                </div>
                {hasPlan && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <PlanQualityScore
                      score={liveScore || scorePlanQuality(
                        planDraft,
                        supplementsDraft,
                        { ...form, _weeklyFeedback: weeklyFeedback },
                        { isFollowup, followupWeek }
                      )}
                      autoCorrected={autoCorrected}
                    />
                  </div>
                )}
              </div>

              {/* Suggestions panel */}
              {suggestions.length > 0 && (
                <div style={{
                  marginTop: 10,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,.02)',
                  border: '1px solid rgba(255,255,255,.06)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <div style={{
                    fontSize: '.68rem', fontWeight: 700, color: 'rgba(255,255,255,.3)',
                    textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2,
                  }}>
                    Suggestions
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {suggestions.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          showSaveToast(`Ouvre la section concern\u00e9e et clique \u2728 IA \u2192 ${
                            s.action === 'actionnable' ? 'Rendre actionnable' :
                            s.action === 'rewrite' ? 'Reformuler pro' :
                            s.action === 'simplify' ? 'Simplifier' :
                            s.action === 'adapt' ? 'Adapter au client' : 'Am\u00e9liorer'
                          }`);
                        }}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: '.75rem',
                          background: 'rgba(255,255,255,.04)',
                          border: '1px solid rgba(255,255,255,.1)',
                          color: '#b0c4a8', cursor: 'pointer', transition: 'all .15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(106,191,138,.1)';
                          e.currentTarget.style.borderColor = 'rgba(106,191,138,.3)';
                          e.currentTarget.style.color = '#8abf9a';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(255,255,255,.04)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)';
                          e.currentTarget.style.color = '#b0c4a8';
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 1 : Actions principales */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className={`btn btn-anissa-primary ${generating ? 'loading-pulse' : ''}`}
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ padding: '10px 18px', borderRadius: 10, fontSize: '.85rem', fontWeight: 600 }}
                >
                  {generating ? 'Generation...' : (hasPlan ? 'Regenerer' : 'Generer avec l\'IA')}
                </button>

                <button
                  type="button"
                  className="btn btn-anissa-secondary"
                  onClick={() => setShowTemplates(true)}
                  style={{ padding: '10px 14px', borderRadius: 10, fontSize: '.78rem' }}
                >
                  Templates
                </button>
                {planVersions.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-anissa-secondary"
                    onClick={() => setShowVersions(true)}
                    style={{ padding: '10px 12px', borderRadius: 10, fontSize: '.78rem' }}
                    title="Historique des versions"
                  >
                    Versions ({planVersions.length})
                  </button>
                )}

                {/* Plus dropdown */}
                <div style={{ position: 'relative', display: 'inline-block' }} onMouseDown={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-anissa-secondary"
                    onClick={() => setShowMoreMenu(m => !m)}
                    style={{ padding: '10px 14px', borderRadius: 10, fontSize: '.78rem' }}
                  >
                    Plus &#9662;
                  </button>
                  {showMoreMenu && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, zIndex: 50,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 8, overflow: 'hidden', minWidth: 200, marginTop: 4,
                      boxShadow: '0 8px 24px rgba(0,0,0,.3)'
                    }}>
                      <button
                        onClick={() => { setShowMoreMenu(false); handleExpertMode(); }}
                        disabled={!planDraft?.trim() || expertMode === 'loading'}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '10px 16px', background: 'none', border: 'none',
                          borderBottom: '1px solid rgba(255,255,255,.06)',
                          color: !planDraft?.trim() ? 'rgba(255,255,255,.2)' : '#8abf9a',
                          cursor: !planDraft?.trim() ? 'not-allowed' : 'pointer',
                          fontSize: '.85rem', fontWeight: 600,
                        }}
                        onMouseEnter={e => { if (planDraft?.trim()) e.currentTarget.style.background = 'rgba(106,191,138,.08)'; }}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        {'\u2728'} Mode Expert {'\u2014'} Optimiser le plan
                      </button>
                      <button className="btn btn-anissa-secondary" style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}
                        onClick={() => { setShowMedicalSummary(true); setShowMoreMenu(false); }}
                        disabled={!hasPlan}>
                        Resume medecin
                      </button>
                      <button className="btn btn-anissa-secondary" style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}
                        onClick={() => { setShowQualityDash(p => !p); setShowMoreMenu(false); }}>
                        Historique qualite IA
                      </button>
                      {consultation.mgd_recommendation && consultation.mgd_recommendation !== 'none' && (
                      <button className="btn btn-anissa-secondary" style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}
                        onClick={() => {
                          setAnalysesError('');
                          const symp = detectSymptomsFromForm(form);
                          const recs = getEnrichedMGDRecommendations(symp);
                          const val = validateAnalysesPDF(symp, recs);
                          if (!val.valid) {
                            setAnalysesError('Export bloque : ' + val.errors.join(' | '));
                            setShowMoreMenu(false);
                            return;
                          }
                          exportAnalysesPDF(recs, symp, clientName, formatDate(today));
                          setShowMoreMenu(false);
                        }}>
                        PDF analyses
                      </button>
                      )}
                      <button className="btn btn-anissa-secondary" style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 0, border: 'none' }}
                        disabled={analyzingPlan || !hasPlan}
                        onClick={async () => {
                          setShowMoreMenu(false);
                          setAnalyzingPlan(true);
                          try {
                            const result = await analyzeFullPlan(form, planDraft, supplementsDraft);
                            if (result) setAiAnalysis(result);
                          } catch (err) {
                            console.error('[AI analysis]', err.message);
                          } finally {
                            setAnalyzingPlan(false);
                          }
                        }}>
                        {analyzingPlan ? '\u2728 Analyse en cours...' : '\ud83d\udd0d Analyse IA compl\u00e8te'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2 : Save actions */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 2 }}>
                <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ padding: '7px 14px', borderRadius: 10, fontSize: '.78rem' }}>Fermer</button>
                <button type="button" className="btn btn-primary" onClick={handleSave} style={{ padding: '7px 14px', borderRadius: 10, fontSize: '.78rem' }}>Sauvegarder</button>
                <span style={{
                  fontSize: '0.75rem',
                  color: autoSaveStatus === 'saved' ? '#22c55e'
                       : autoSaveStatus === 'saving' ? '#f59e0b'
                       : '#94a3b8',
                  marginLeft: '0.5rem',
                  transition: 'color 0.3s',
                }}>
                  {autoSaveStatus === 'saved' && '\u2713 Sauvegard\u00e9'}
                  {autoSaveStatus === 'saving' && '\u27f3 Auto-save...'}
                  {autoSaveStatus === 'unsaved' && '\u25cf Non sauvegard\u00e9'}
                </span>
              </div>

              {genError && <div className="error-msg" style={{ marginTop: 4 }}>{genError}</div>}
              {pdfError && <div className="error-msg" style={{ marginTop: 4, background: 'rgba(212,92,76,.08)', padding: '8px 12px', borderRadius: 8, fontSize: '.78rem' }}>{pdfError}</div>}
              {analysesError && <div className="error-msg" style={{ marginTop: 4, background: 'rgba(212,92,76,.08)', padding: '8px 12px', borderRadius: 8, fontSize: '.78rem' }}>{analysesError}</div>}
            </div>

            {/* Expert Mode — Loading */}
            {expertMode === 'loading' && (
              <div style={{
                margin:'8px 0', padding:'16px 18px',
                background:'rgba(26,46,31,.5)',
                border:'1px solid rgba(106,191,138,.2)',
                borderRadius:12,
                display:'flex', alignItems:'center', gap:12,
              }}>
                <span style={{ fontSize:'1.2rem', animation:'neSpin .8s linear infinite',
                  display:'inline-block' }}>{'\u2728'}</span>
                <div>
                  <div style={{ fontSize:'.85rem', fontWeight:600, color:'#8abf9a' }}>
                    Mode Expert {'\u2014'} Optimisation en cours...
                  </div>
                  <div style={{ fontSize:'.75rem', color:'rgba(255,255,255,.4)', marginTop:3 }}>
                    Section {currentOptimizingIdx + 1} / {sectionResults.length > 0
                      ? sectionResults.length : '...'}
                    {sectionResults[currentOptimizingIdx]?.title
                      ? ` \u2014 ${sectionResults[currentOptimizingIdx].title}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setExpertMode(false)}
                  style={{ marginLeft:'auto', background:'none', border:'none',
                    color:'rgba(255,255,255,.3)', cursor:'pointer', fontSize:'.8rem' }}>
                  Annuler
                </button>
              </div>
            )}

            {/* Expert Mode — Review */}
            {expertMode === 'review' && sectionResults.length > 0 && (
              <div style={{
                margin:'8px 0',
                background:'rgba(12,20,15,.8)',
                border:'1px solid rgba(106,191,138,.25)',
                borderRadius:12,
                overflow:'hidden',
                animation:'neSlideIn .2s ease',
                display:'flex',
                flexDirection:'column',
                maxHeight:'calc(100vh - 320px)',
              }}>
                <div style={{
                  padding:'14px 18px',
                  background:'rgba(26,46,31,.5)',
                  borderBottom:'1px solid rgba(106,191,138,.15)',
                  display:'flex', alignItems:'center', gap:10,
                }}>
                  <span style={{ fontSize:'.88rem', fontWeight:700, color:'#8abf9a', flex:1 }}>
                    {'\u2728'} Mode Expert {'\u2014'} {sectionResults.filter(r => !r.skip).length} sections optimis{'\u00e9'}es
                  </span>
                  <button onClick={() => setExpertMode(false)}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)',
                      cursor:'pointer', fontSize:'.85rem' }}>
                    {'\u2715'} Fermer
                  </button>
                </div>

                <div style={{ flex:1, overflowY:'auto', minHeight:0, padding:'10px 0' }}>
                  {sectionResults.map((r) => {
                    if (r.skip) return null;
                    const accepted = acceptedSections[r.id] !== false;
                    return (
                      <div key={r.id} style={{
                        padding:'10px 18px',
                        borderBottom:'1px solid rgba(255,255,255,.04)',
                        background: accepted ? 'rgba(106,191,138,.04)' : 'rgba(255,255,255,.02)',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <button
                            onClick={() => setAcceptedSections(prev => ({
                              ...prev, [r.id]: !accepted
                            }))}
                            style={{
                              width:20, height:20, borderRadius:4, border:'none',
                              background: accepted ? 'rgba(106,191,138,.3)' : 'rgba(255,255,255,.08)',
                              color: accepted ? '#4ade80' : 'rgba(255,255,255,.3)',
                              cursor:'pointer', fontSize:'.75rem', display:'flex',
                              alignItems:'center', justifyContent:'center', flexShrink:0,
                              transition:'all .15s',
                            }}>
                            {accepted ? '\u2713' : '\u25cb'}
                          </button>
                          <span style={{ fontSize:'.78rem', fontWeight:700,
                            color: accepted ? '#8abf9a' : 'rgba(255,255,255,.35)',
                            textTransform:'uppercase', letterSpacing:'.3px', flex:1 }}>
                            {r.title}
                          </span>
                          {r.changes?.length > 0 && (
                            <span style={{ fontSize:'.68rem', color:'rgba(106,191,138,.5)',
                              background:'rgba(106,191,138,.08)', padding:'2px 7px',
                              borderRadius:10, whiteSpace:'nowrap' }}>
                              {r.changes.length} am{'\u00e9'}lioration{r.changes.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {r.changes?.length > 0 && accepted && (
                          <div style={{ marginLeft:28, marginBottom:6 }}>
                            {r.changes.map((c, ci) => (
                              <div key={ci} style={{ fontSize:'.74rem',
                                color:'rgba(106,191,138,.6)', marginBottom:2 }}>
                                + {c}
                              </div>
                            ))}
                          </div>
                        )}
                        {accepted && r.improved !== r.original && (
                          <div style={{
                            marginLeft:28, fontSize:'.75rem', color:'rgba(255,255,255,.3)',
                            whiteSpace:'pre-wrap', maxHeight:60, overflow:'hidden',
                            lineHeight:1.4,
                          }}>
                            {r.improved.slice(0, 120)}{r.improved.length > 120 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{
                  padding:'12px 18px',
                  borderTop:'1px solid rgba(106,191,138,.1)',
                  display:'flex', gap:10, alignItems:'center',
                  flexShrink:0,
                }}>
                  <button onClick={handleApplyExpertMode} style={{
                    padding:'8px 20px', borderRadius:8, border:'none',
                    background:'rgba(106,191,138,.2)', color:'#8abf9a',
                    cursor:'pointer', fontSize:'.83rem', fontWeight:700,
                    transition:'all .2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(106,191,138,.35)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(106,191,138,.2)'}
                  >
                    {'\u2705'} Appliquer les sections coch{'\u00e9'}es
                  </button>
                  <span style={{ fontSize:'.75rem', color:'rgba(255,255,255,.25)' }}>
                    {Object.values(acceptedSections).filter(v => v === false).length} section(s) ignor{'\u00e9'}e(s)
                  </span>
                  <button onClick={() => setExpertMode(false)}
                    style={{ marginLeft:'auto', padding:'8px 16px', borderRadius:8,
                      border:'1px solid rgba(255,255,255,.08)', background:'none',
                      color:'rgba(255,255,255,.35)', cursor:'pointer', fontSize:'.8rem' }}>
                    {'\u274c'} Annuler tout
                  </button>
                </div>
              </div>
            )}

            {/* Global AI proposal panel */}
            {globalProposal && (
              <div style={{
                margin: '8px 0',
                padding: '14px 18px',
                background: 'rgba(26,58,42,.4)',
                border: '1px solid rgba(106,191,138,.25)',
                borderRadius: 12,
                animation: 'neSlideIn .2s ease',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:'.72rem', fontWeight:700, color:'rgba(106,191,138,.7)',
                    textTransform:'uppercase', letterSpacing:'.4px' }}>
                    {'\u2728'} Proposition IA {'\u2014'} {globalProposal.instruction}
                  </span>
                  <span style={{ fontSize:'.7rem', color:'rgba(255,255,255,.3)', marginLeft:'auto' }}>
                    Pr{'\u00e9'}visualisation {'\u2014'} non appliqu{'\u00e9'}
                  </span>
                </div>
                <div style={{
                  background:'rgba(0,0,0,.25)', borderRadius:8, padding:'12px 14px',
                  fontSize:'.8rem', lineHeight:1.65, color:'#d4c9a8',
                  whiteSpace:'pre-wrap', maxHeight:200, overflowY:'auto',
                  border:'1px solid rgba(255,255,255,.06)',
                }}>
                  {globalProposal.text.slice(0, 600)}{globalProposal.text.length > 600 ? '...' : ''}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <button
                    onClick={() => {
                      reseedEditor(globalProposal.text, supplementsDraft, recipesDraft);
                      setGlobalProposal(null);
                      showSaveToast('Plan mis \u00e0 jour');
                    }}
                    style={{
                      padding:'6px 16px', borderRadius:8, border:'none',
                      background:'rgba(106,191,138,.2)', color:'#8abf9a',
                      cursor:'pointer', fontSize:'.8rem', fontWeight:600,
                    }}>
                    {'\u2705'} Appliquer au plan
                  </button>
                  <button
                    onClick={() => setGlobalProposal(null)}
                    style={{
                      padding:'6px 16px', borderRadius:8,
                      border:'1px solid rgba(255,255,255,.08)',
                      background:'none', color:'rgba(255,255,255,.35)',
                      cursor:'pointer', fontSize:'.8rem',
                    }}>
                    {'\u274c'} Ignorer
                  </button>
                </div>
              </div>
            )}

            {showQualityDash && <NutritionQualityDashboard />}

            {/* AI Analysis modal */}
            {aiAnalysis && (
              <div className="modal-overlay" onClick={() => setAiAnalysis(null)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}
                  style={{ maxWidth: 520, padding: 0 }}>

                  {/* Header */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'18px 20px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                    <strong style={{ fontSize:'.95rem', color:'#f0f0e8' }}>{'\ud83d\udd0d'} Analyse IA du plan</strong>
                    <button onClick={() => setAiAnalysis(null)}
                      style={{ background:'none', border:'none', color:'#b0c4a8',
                        cursor:'pointer', fontSize:'1.2rem' }}>{'\u2715'}</button>
                  </div>

                  <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:16 }}>

                    {/* Score + verdict */}
                    <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                      <div style={{ fontSize:'2rem', fontWeight:800, minWidth:70,
                        color: aiAnalysis.score >= 80 ? '#4ade80'
                             : aiAnalysis.score >= 60 ? '#fbbf24' : '#f87171' }}>
                        {aiAnalysis.score}/100
                      </div>
                      <div style={{ fontSize:'.82rem', color:'#b0c4a8', lineHeight:1.5,
                        fontStyle:'italic', flex:1 }}>
                        {aiAnalysis.verdict}
                      </div>
                    </div>

                    {/* Points forts */}
                    {aiAnalysis.strengths?.length > 0 && (
                      <div>
                        <div style={{ fontSize:'.68rem', fontWeight:700, color:'#4ade80',
                          textTransform:'uppercase', letterSpacing:'.4px', marginBottom:6 }}>
                          {'\u2705'} Points forts
                        </div>
                        {aiAnalysis.strengths.slice(0, 3).map((s, i) => (
                          <div key={i} style={{ fontSize:'.8rem', color:'#b0c4a8',
                            paddingLeft:10, borderLeft:'2px solid rgba(74,222,128,.25)',
                            marginBottom:5, lineHeight:1.4 }}>{s}</div>
                        ))}
                      </div>
                    )}

                    {/* Points d'attention avec bouton Appliquer */}
                    {aiAnalysis.issues?.length > 0 && (
                      <div>
                        <div style={{ fontSize:'.68rem', fontWeight:700, color:'#fbbf24',
                          textTransform:'uppercase', letterSpacing:'.4px', marginBottom:6 }}>
                          {'\u26a0\ufe0f'} {'\u00c0'} corriger
                        </div>
                        {aiAnalysis.issues.slice(0, 4).map((issue, i) => (
                          <div key={i} style={{
                            display:'flex', alignItems:'flex-start', gap:10,
                            padding:'7px 10px', marginBottom:5, borderRadius:8,
                            background:'rgba(251,191,36,.05)',
                            border:'1px solid rgba(251,191,36,.1)',
                          }}>
                            <span style={{ fontSize:'.79rem', color:'#b0c4a8',
                              flex:1, lineHeight:1.4 }}>{issue}</span>
                            <button
                              onClick={() => handleImproveFromAnalysis(issue, null)}
                              style={{
                                padding:'3px 10px', borderRadius:6, border:'none',
                                background:'rgba(251,191,36,.15)', color:'#fbbf24',
                                cursor:'pointer', fontSize:'.72rem', fontWeight:600,
                                whiteSpace:'nowrap', flexShrink:0, transition:'all .15s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background='rgba(251,191,36,.28)'}
                              onMouseLeave={e => e.currentTarget.style.background='rgba(251,191,36,.15)'}
                            >
                              Appliquer
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quick wins avec bouton Appliquer */}
                    {aiAnalysis.quickWins?.length > 0 && (
                      <div>
                        <div style={{ fontSize:'.68rem', fontWeight:700, color:'#60a5fa',
                          textTransform:'uppercase', letterSpacing:'.4px', marginBottom:6 }}>
                          {'\u26a1'} Am{'\u00e9'}liorations rapides
                        </div>
                        {aiAnalysis.quickWins.map((win, i) => (
                          <div key={i} style={{
                            display:'flex', alignItems:'flex-start', gap:10,
                            padding:'7px 10px', marginBottom:5, borderRadius:8,
                            background:'rgba(96,165,250,.05)',
                            border:'1px solid rgba(96,165,250,.1)',
                          }}>
                            <span style={{ fontSize:'.79rem', color:'#b0c4a8',
                              flex:1, lineHeight:1.4 }}>{win}</span>
                            <button
                              onClick={() => handleImproveFromAnalysis(win, null)}
                              style={{
                                padding:'3px 10px', borderRadius:6, border:'none',
                                background:'rgba(96,165,250,.15)', color:'#60a5fa',
                                cursor:'pointer', fontSize:'.72rem', fontWeight:600,
                                whiteSpace:'nowrap', flexShrink:0, transition:'all .15s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background='rgba(96,165,250,.28)'}
                              onMouseLeave={e => e.currentTarget.style.background='rgba(96,165,250,.15)'}
                            >
                              Appliquer
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bouton Améliorer tout */}
                    <button
                      onClick={handleImproveAll}
                      disabled={improvingAll}
                      style={{
                        width:'100%', padding:'10px', borderRadius:10,
                        border:'1px solid rgba(106,191,138,.3)',
                        background: improvingAll ? 'rgba(106,191,138,.08)' : 'rgba(106,191,138,.12)',
                        color: improvingAll ? 'rgba(106,191,138,.5)' : '#8abf9a',
                        cursor: improvingAll ? 'not-allowed' : 'pointer',
                        fontSize:'.85rem', fontWeight:600, transition:'all .2s',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                      }}
                      onMouseEnter={e => { if (!improvingAll) e.currentTarget.style.background='rgba(106,191,138,.2)'; }}
                      onMouseLeave={e => { if (!improvingAll) e.currentTarget.style.background='rgba(106,191,138,.12)'; }}
                    >
                      {improvingAll
                        ? <><span style={{animation:'neSpin .8s linear infinite',display:'inline-block'}}>{'\u2728'}</span> Analyse en cours...</>
                        : '\u2728 Am\u00e9liorer tout le plan'
                      }
                    </button>

                  </div>
                </div>
              </div>
            )}

            {/* ─── SPLIT VIEW ─── */}
            <div className="nc-cockpit-split" style={{ display: 'grid', alignItems: 'start' }}>
              {/* LEFT : Editor — push-based : NutritionEditor notifie le parent
                  via onDraftChange (debounced cote editeur). Plus de onInput parasite ici. */}
              <section className="nc-panel nc-panel--editor">
                <header className="nc-panel__header">
                  <span className="nc-panel__label">Editeur</span>
                  <Tab active={editorTab === 'plan'} onClick={() => setEditorTab('plan')}>Plan complet</Tab>
                  <Tab active={editorTab === 'frigo'} onClick={() => setEditorTab('frigo')}>Fiche frigo</Tab>
                  <Tab active={editorTab === 's1s4'} onClick={() => setEditorTab('s1s4')}>Plan S1-S4</Tab>
                  <Tab active={editorTab === 'supp'} onClick={() => setEditorTab('supp')}>Supplements</Tab>
                </header>
                <div className="nc-panel__body">
                  {generating && (
                    <div className="loading" style={{ padding: '30px 20px' }}>
                      <div className="loading-spinner" />
                      <p>Claude analyse le profil et genere le plan nutrition...</p>
                    </div>
                  )}
                  {!generating && renderEditorTab()}
                </div>
              </section>

              {/* RIGHT : Preview — re-render natif React quand les drafts changent */}
              <section className="nc-panel nc-panel--preview">
                <header className="nc-panel__header" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <span className="nc-panel__label">Apercu</span>
                  <Tab active={previewTab === 'pdf'} onClick={() => setPreviewTab('pdf')}>PDF complet</Tab>
                  <Tab active={previewTab === 'frigo'} onClick={() => setPreviewTab('frigo')}>Fiche frigo</Tab>
                  <Tab active={previewTab === 'cover'} onClick={() => setPreviewTab('cover')}>Cover</Tab>
                  <span style={{ flex: 1 }} />
                  <button
                    className="btn btn-anissa-secondary"
                    disabled={!hasPlan}
                    onClick={() => doExportPdf()}
                    style={{ padding: '5px 10px', borderRadius: 8, fontSize: '.72rem', opacity: hasPlan ? 1 : 0.4 }}
                  >
                    Telecharger le plan nutrition
                  </button>
                </header>
                <div className="nc-panel__body" style={{ padding: 16 }} ref={previewBodyRef}>
                  {renderPreviewTab()}
                </div>
              </section>
            </div>

            {/* Analyses preview (below split, full width) */}
            {showAnalysesPreview && (() => {
              const symp = detectSymptomsFromForm(form);
              const recs = getEnrichedMGDRecommendations(symp);
              return (
                <AnalysisPdfBody
                  recommendations={recs}
                  symptoms={symp}
                  clientName={clientName}
                  date={formatDate(today)}
                />
              );
            })()}

            {/* ─── Modales (remontees depuis l'editeur) ─── */}
            {showFrigoModal && (() => {
              const { plan, supplements, recipes } = readEdited();
              return (
                <FicheFrigoPreview
                  consultation={{
                    nutritionPlan: plan,
                    supplements,
                    ficheFrigoJson: consultation.fiche_frigo_json || null,
                    date: today,
                  }}
                  sections={structurePlanSections(plan, supplements, { isFollowup })}
                  client={client}
                  onClose={() => setShowFrigoModal(false)}
                />
              );
            })()}

            {showMedicalSummary && (() => {
              const { plan, supplements, recipes } = readEdited();
              return (
                <MedicalSummary
                  form={form}
                  consultation={{ plan, supplements, recipes, bloodTestDone: consultation.blood_test_done, dnaTestDone: consultation.dna_test_done }}
                  onClose={() => setShowMedicalSummary(false)}
                />
              );
            })()}

            {showCoverForm && (
              <div className="modal-overlay" onClick={() => setShowCoverForm(false)} role="dialog" aria-modal="true">
                <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 0 }}>
                  <header style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: 0, color: '#d4c9a8', fontSize: '1rem', fontWeight: 700 }}>Cover PDF</h3>
                      <div style={{ fontSize: '.75rem', color: '#8a8a7a', marginTop: 2 }}>Personnaliser la page de garde du plan</div>
                    </div>
                    <button type="button" onClick={() => setShowCoverForm(false)} style={{ background: 'none', border: 'none', color: '#8a8a7a', fontSize: '1.3rem', cursor: 'pointer', padding: '0 4px' }} title="Fermer">&times;</button>
                  </header>
                  <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: '.72rem', color: '#8a8a7a', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Prenom client</label>
                      <input type="text" value={coverFields.prenom} onChange={e => setCoverFields(p => ({ ...p, prenom: e.target.value }))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '.72rem', color: '#8a8a7a', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Objectif principal</label>
                      <input type="text" value={coverFields.objectif} onChange={e => setCoverFields(p => ({ ...p, objectif: e.target.value }))} style={{ width: '100%' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: '.72rem', color: '#8a8a7a', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Date</label>
                        <input type="text" value={coverFields.date} onChange={e => setCoverFields(p => ({ ...p, date: e.target.value }))} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '.72rem', color: '#8a8a7a', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Sous-titre</label>
                        <input type="text" value={coverFields.sousTitre} onChange={e => setCoverFields(p => ({ ...p, sousTitre: e.target.value }))} style={{ width: '100%' }} />
                      </div>
                    </div>
                  </div>
                  <footer style={{ padding: '14px 22px 18px', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => setShowCoverForm(false)} style={{ padding: '8px 16px', borderRadius: 10, fontSize: '.82rem' }}>Fermer</button>
                    <button
                      className="btn btn-anissa-secondary"
                      onClick={() => { setPreviewTab('cover'); setShowCoverForm(false); showSaveToast('Cover mise a jour — voir l\'apercu'); }}
                      style={{ padding: '8px 16px', borderRadius: 10, fontSize: '.82rem' }}
                    >
                      Valider
                    </button>
                    <button
                      className="btn btn-anissa-primary"
                      onClick={() => { doExportCover(); setShowCoverForm(false); showSaveToast('Cover exportee'); }}
                      style={{ padding: '8px 16px', borderRadius: 10, fontSize: '.82rem' }}
                    >
                      Exporter Cover
                    </button>
                  </footer>
                </div>
              </div>
            )}

            {saveToast && <div className="nc-save-toast">{saveToast}</div>}
          </div>
        );
      })()}


      {/* Step: Notes for Benoit + Private notes */}
      {currentStepType === 'notes' && (
        <div className="nutrition-form-section">
          <h3>Notes pour Benoit</h3>
          <div className="field full-width">
            <label>Recommandations a transmettre au coach</label>
            <SmartTextarea
              value={consultation.notes_for_coach}
              onChange={(e) => updateField('notes_for_coach', e.target.value)}
              placeholder="Points d'attention pour le programme sportif, aliments a eviter avant/apres l'entrainement, signes a surveiller..."
              rows={8}
            />
          </div>

          <div className="field full-width private-field" style={{ marginTop: 24 }}>
            <label>
              <span className="private-lock">🔒</span> Notes privees
              <span className="private-badge">Visible uniquement par vous</span>
            </label>
            <SmartTextarea
              value={consultation.private_notes}
              onChange={(e) => updateField('private_notes', e.target.value)}
              placeholder="Notes confidentielles — visibles uniquement par Anissa..."
              rows={5}
            />
          </div>
        </div>
      )}

      {/* Bottom nav retiree — actions remontees dans le cockpit header (step plan)
          et dans la barre d'etapes en haut (autres steps) */}
      {currentStepType !== 'plan' && (
        <div className="nav-buttons" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onCancel}>Fermer</button>
          <button className="btn btn-primary" onClick={handleSave}>Sauvegarder la consultation</button>
          <span style={{
            fontSize: '0.75rem',
            color: autoSaveStatus === 'saved' ? '#22c55e'
                 : autoSaveStatus === 'saving' ? '#f59e0b'
                 : '#94a3b8',
            marginLeft: '0.5rem',
            transition: 'color 0.3s',
          }}>
            {autoSaveStatus === 'saved' && '\u2713 Sauvegard\u00e9'}
            {autoSaveStatus === 'saving' && '\u27f3 Auto-save...'}
            {autoSaveStatus === 'unsaved' && '\u25cf Non sauvegard\u00e9'}
          </span>
        </div>
      )}
    </div>
  );
}
