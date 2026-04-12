import { useState, useRef } from 'react';
import { getClient, getNutritionConsultations, savePlanVersion, getPlanVersions } from './store';
import { FORMULES } from './formSteps';
import NutritionTemplates from './NutritionTemplates';
import NutritionEditor from './NutritionEditor';
import FollowUpStep, { buildFollowupSummary } from './FollowUpStep';
import { exportConsultationPDF, exportFicheFrigoPDF, exportCoverPDF } from './nutritionPdf';
import { SmartTextarea } from './KeywordHints';
import ContraIndicationAlert, { detectContraIndications } from './ContraIndicationAlert';
import { getEnrichedMGDRecommendations } from './mgdAnalysisMatrix';
import { analyzeLabResults } from './labInterpretationEngine';

// ─── PROMPT MODULES (composition conditionnelle) ───

const SYSTEM_PROMPT = `Tu es un nutritionniste clinique expert. Tu assistes Anissa Deroubaix, nutritionniste a Nyon, Suisse. Tu generes directement le plan — tu ne poses pas de questions.

PRIORITE CLINIQUE : pathologie > digestion > energie > objectif
FILTRAGE : retirer allergies, intolerances, aliments problematiques avant tout
ADAPTATION : ajuster selon digestion, energie, contraintes de vie du profil
CALORIES/MACROS : calculer avec Mifflin-St Jeor — la journee entiere doit etre coherente avec les calories et macros calcules
COHERENCE : aucun aliment interdit ne doit apparaitre dans les menus
SIMPLICITE : recommandations applicables, pas de regles absolues
CONTRADICTIONS : interdites — verifier avant sortie
Si donnee manquante → le signaler
Si incertitude → ecrire exactement : "a individualiser"

REGLES :
- Systeme metrique (grammes, ml, kg). Prix adaptes Suisse.
- Aliments de saison, locaux, biologiques.
- Respecte TOUJOURS allergies et intolerances.
- JAMAIS de medicaments — uniquement supplements nutritionnels.
- Francais, ton professionnel mais accessible.
- Aucune valeur medicale brute (conformite nLPD Suisse).
- Ne JAMAIS citer de references par nom. Le plan doit sembler venir de l'expertise d'Anissa.`;

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
PLAN ALIMENTAIRE SUR 4 SEMAINES avec variete :

SEMAINE 1 — Phase d'adaptation :
- Repas simples, introduction progressive. Menus lundi-dimanche (petit-dej, dejeuner, diner + collations). Liste de courses.

SEMAINE 2 — Rotation des recettes :
- Nouvelles recettes, variete proteines/legumes. Menus lundi-dimanche. Liste de courses.

SEMAINE 3 — Progression :
- Ajustement portions, aliments specifiques. Menus lundi-dimanche. Liste de courses.

SEMAINE 4 — Consolidation :
- Repas optimises, routine installee. Menus lundi-dimanche. Liste de courses.

Chaque repas inclut : aliments, quantites approximatives, macros estimes.
Ajustements jours entrainement vs repos (glucides pre/post workout).`;

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

  const allergies = extractList('allergies');
  const alimentsEvites = extractList('alimentsEvites');
  const forbidden = [...new Set([...allergies, ...alimentsEvites])];

  // --- AXIS 1: COHERENCE (constraints respected, no contradictions) ---
  let coherence = 10;

  // Hard fail: forbidden foods (allergies/intolerances) present in plan
  const foundForbidden = forbidden.filter(f => full.includes(f));
  if (foundForbidden.length > 0) {
    hardFails.push(`Aliments interdits presents : ${foundForbidden.join(', ')}`);
    coherence = 0;
  }

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

  coherence = Math.max(coherence, 0);

  // --- AXIS 2: SIMPLICITY ---
  let simplicity = 10;

  const lineCount = (planText || '').split('\n').filter(l => l.trim()).length;
  const lineThresholdHigh = isFollowup ? 200 : 500;
  const lineThresholdMed = isFollowup ? 120 : 350;
  if (lineCount > lineThresholdHigh) { simplicity -= 3; penalties.push(`Plan tres long (>${lineThresholdHigh} lignes)`); }
  else if (lineCount > lineThresholdMed) { simplicity -= 1; }

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
  const hasShoppingList = /liste.*course|courses/i.test(planText || '');
  const hasHydration = /hydratation|eau.*litre|litre.*eau|\d+\s*l.*eau/i.test(planText || '');

  if (isFollowup) {
    // Followup: meal structure and quantities less critical
    if (!hasQuantities && !hasMealStructure) { applicability -= 1; penalties.push('Pas de detail concret dans les ajustements'); }
  } else {
    // Plan initial: full expectations
    if (!hasQuantities) { applicability -= 2; penalties.push('Quantites absentes'); }
    if (!hasMealStructure) { applicability -= 3; penalties.push('Structure repas absente'); }
    if (!hasShoppingList) { applicability -= 1; penalties.push('Liste de courses absente'); }
    if (!hasHydration) { applicability -= 1; }
  }

  applicability = Math.max(applicability, 0);

  // --- AXIS 4: CONSTRAINTS (respects client profile) ---
  let constraints = 10;

  // Allergies hard fail already in coherence — double penalty on constraints
  if (foundForbidden.length > 0) { constraints = 0; }

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
    { key: 'coherence', label: 'Coherence', desc: 'Allergies, macros, contradictions' },
    { key: 'simplicity', label: 'Simplicite', desc: 'Longueur, nb supplements, ajustements' },
    { key: 'applicability', label: 'Applicabilite', desc: 'Quantites, structure, praticite' },
    { key: 'constraints', label: 'Contraintes', desc: 'Pathologies, sport, profil client' },
  ];

  return (
    <div style={{ background: 'rgba(124,92,191,.06)', border: '1px solid rgba(124,92,191,.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <strong style={{ fontSize: '.9rem' }}>Score qualite du plan</strong>
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
  const sections = [];
  const text = cleanPlanForPDF(planText);
  const lines = text.split('\n');

  let currentTitle = '';
  let currentContent = [];

  const flushSection = () => {
    if (currentTitle || currentContent.length > 0) {
      const content = currentContent.join('\n').trim();
      if (content) {
        sections.push({ title: currentTitle || 'Introduction', content, type: classifySection(currentTitle) });
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
  if (/principe|nutritionnel|approche/i.test(t)) return 'principes';
  if (/semaine|plan.*alimentaire|menu|repas|lundi|mardi/i.test(t)) return 'plan';
  if (/suppl[eé]ment|compl[eé]ment|tableau horaire/i.test(t)) return 'supplements';
  if (/conseil|pratique|hydratation|astuce|meal.?prep/i.test(t)) return 'conseils';
  if (/suivi|progression|ajustement|bilan.*semaine/i.test(t)) return 'suivi';
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
        <strong style={{ fontSize: '.9rem', color: '#1A2E1F' }}>Dashboard qualite IA</strong>
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

  // Stress (scale 1-5, low = high stress)
  if (f.niveauStressActuel && Number(f.niveauStressActuel) <= 2) symptoms.push('stress');

  // Sleep
  if (f.heuresSommeil && Number(f.heuresSommeil) <= 2) symptoms.push('sleep');
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

const INITIAL_CONSULTATION = {
  observations: '',
  blood_test_done: false,
  dna_test_done: false,
  nutritional_observations: '',
  nutrition_plan: '',
  supplements: '',
  recipes: '',
  notes_for_coach: '',
  private_notes: '',
  fiche_frigo_json: null,
  lab_results: {},
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
  const client = getClient(clientId);
  const form = client?.form || {};
  const formule = FORMULES[client?.formule] || {};

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

  const [step, setStep] = useState(() => {
    if (initialConsultation?.nutrition_plan) return isFollowup ? 3 : 2;
    return 1;
  });
  const [consultation, setConsultation] = useState(() => {
    if (initialConsultation) {
      return {
        observations: initialConsultation.observations || '',
        blood_test_done: initialConsultation.bloodTestDone || initialConsultation.blood_test_done || false,
        dna_test_done: initialConsultation.dnaTestDone || initialConsultation.dna_test_done || false,
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
  const [pendingAlerts, setPendingAlerts] = useState(null);
  const editorGetDataRef = useRef(null);
  const [planVersions, setPlanVersions] = useState(() => getPlanVersions(clientId));
  const [showVersions, setShowVersions] = useState(false);

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
      `- Reaction apres repas riche en glucides : ${form.reactionGlucides || nr}`,
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

    // Clinical summary (orientation for AI)
    const mgdSymptoms = detectSymptomsFromForm(form);
    parts.push('');
    parts.push(buildClinicalSummary(form, {
      mgdSymptoms,
      labAnalysis: labAnalysis?.signals?.length > 0 ? labAnalysis : null,
      isFollowup,
      followupWeek,
    }));

    parts.push('');
    parts.push(`Genere un plan nutrition personnalise complet sur 4 semaines avec variete, listes de courses, et alternatives naturelles avant les complements.`);
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
    setShowTemplates(false);
  };

  const handleSave = () => {
    onSave({
      id: consultationId || undefined,
      clientId,
      consultantName: 'Anissa',
      date: initialConsultation?.date || new Date().toISOString(),
      observations: consultation.observations,
      bloodTestDone: consultation.blood_test_done,
      dnaTestDone: consultation.dna_test_done,
      nutritionalObservations: consultation.nutritional_observations,
      nutritionPlan: consultation.nutrition_plan,
      supplements: consultation.supplements,
      recipes: consultation.recipes,
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

          <div className="nutrition-checkboxes" style={{ marginTop: 16 }}>
            <label className="nutrition-checkbox">
              <input type="checkbox" checked={consultation.blood_test_done} onChange={(e) => updateField('blood_test_done', e.target.checked)} />
              <span>Bilan sanguin effectue</span>
            </label>
            <label className="nutrition-checkbox">
              <input type="checkbox" checked={consultation.dna_test_done} onChange={(e) => updateField('dna_test_done', e.target.checked)} />
              <span>Analyse ADN effectuee</span>
            </label>
          </div>

          {/* Lab results input (shown when blood test is done) */}
          {consultation.blood_test_done && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: '.85rem', color: '#d4c9a8', marginBottom: 10 }}>Resultats biologiques</h4>
              <p style={{ fontSize: '.75rem', color: '#6b5f48', marginBottom: 10 }}>Saisissez les valeurs disponibles. Les champs vides sont ignores.</p>
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

      {/* Step: Nutrition Plan */}
      {currentStepType === 'plan' && (
        <div className="nutrition-form-section">
          <h3>Plan nutrition</h3>

          {/* Recap observations */}
          <div className="nutrition-observations-recap" style={{ background: 'rgba(124,92,191,.08)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: '.85rem', lineHeight: 1.5 }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>Recap observations :</strong>
            <div>Observations : {consultation.observations || 'Non renseigne'}</div>
            <div>Bilan sanguin : {consultation.blood_test_done ? 'Oui' : 'Non'} | ADN : {consultation.dna_test_done ? 'Oui' : 'Non'}</div>
            {consultation.nutritional_observations && <div>Observations nutritionnelles : {consultation.nutritional_observations}</div>}
            {isFollowup && followupData.etat_global && (
              <div style={{ marginTop: 8, borderTop: '1px solid rgba(124,92,191,.15)', paddingTop: 8 }}>
                <strong>Suivi :</strong> {followupData.etat_global} | Adherence : {followupData.adherence_plan || '-'} | Poids : {followupData.poids_actuel ? `${followupData.poids_actuel} kg` : '-'}
              </div>
            )}
          </div>

          <div className="nutrition-plan-actions">
            <button
              className={`btn btn-generate-nutrition ${generating ? 'loading-pulse' : ''}`}
              onClick={handleGenerate}
              disabled={generating}
              style={{ flex: 1 }}
            >
              {generating ? 'Generation en cours...' : 'Generer avec l\'IA'}
            </button>
            <button
              className="btn btn-anissa-secondary"
              onClick={() => setShowTemplates(true)}
              style={{ padding: '14px 24px', fontSize: '.85rem' }}
            >
              Templates
            </button>
            {planVersions.length > 0 && (
              <button
                className="btn btn-anissa-secondary"
                onClick={() => setShowVersions(true)}
                style={{ padding: '14px 20px', fontSize: '.85rem' }}
                title="Historique des versions"
              >
                🕐 {planVersions.length}
              </button>
            )}
          </div>

          {genError && <div className="error-msg" style={{ marginTop: 12 }}>{genError}</div>}
          {pdfError && <div className="error-msg" style={{ marginTop: 12, background: 'rgba(212,92,76,.08)', padding: '10px 14px', borderRadius: 8, fontSize: '.82rem' }}>{pdfError}</div>}

          {consultation.nutrition_plan && !generating && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                className="btn btn-anissa-secondary"
                style={{ fontSize: '.78rem', padding: '8px 16px' }}
                onClick={() => setShowPdfPreview(p => !p)}
              >
                {showPdfPreview ? 'Masquer apercu PDF' : 'Apercu body PDF'}
              </button>
              <button
                className="btn btn-anissa-secondary"
                style={{ fontSize: '.78rem', padding: '8px 16px' }}
                onClick={() => setShowQualityDash(p => !p)}
              >
                {showQualityDash ? 'Masquer dashboard' : 'Dashboard qualite'}
              </button>
              <button
                className="btn btn-anissa-secondary"
                style={{ fontSize: '.78rem', padding: '8px 16px' }}
                onClick={() => {
                  setAnalysesError('');
                  const symp = detectSymptomsFromForm(form);
                  const recs = getEnrichedMGDRecommendations(symp);
                  const val = validateAnalysesPDF(symp, recs);
                  if (!val.valid) {
                    setAnalysesError(val.errors.join(' | '));
                    setShowAnalysesPreview(false);
                    return;
                  }
                  setShowAnalysesPreview(p => !p);
                }}
              >
                {showAnalysesPreview ? 'Masquer analyses' : 'Apercu PDF analyses'}
              </button>
              <button
                className="btn btn-anissa-primary"
                style={{ fontSize: '.78rem', padding: '8px 16px' }}
                onClick={() => {
                  setAnalysesError('');
                  const symp = detectSymptomsFromForm(form);
                  const recs = getEnrichedMGDRecommendations(symp);
                  const val = validateAnalysesPDF(symp, recs);
                  if (!val.valid) {
                    setAnalysesError('Export bloque : ' + val.errors.join(' | '));
                    return;
                  }
                  const name = form.prenom || client?.prenom || 'Client';
                  exportAnalysesPDF(recs, symp, name, formatDate(new Date().toISOString()));
                }}
              >
                Exporter PDF analyses
              </button>
            </div>
          )}

          {analysesError && <div className="error-msg" style={{ marginTop: 8, background: 'rgba(212,92,76,.08)', padding: '10px 14px', borderRadius: 8, fontSize: '.82rem' }}>{analysesError}</div>}

          {showQualityDash && <NutritionQualityDashboard />}

          {showAnalysesPreview && (() => {
            const symp = detectSymptomsFromForm(form);
            const recs = getEnrichedMGDRecommendations(symp);
            return (
              <AnalysisPdfBody
                recommendations={recs}
                symptoms={symp}
                clientName={form.prenom || client?.prenom || 'Client'}
                date={formatDate(new Date().toISOString())}
              />
            );
          })()}

          {showPdfPreview && consultation.nutrition_plan && (() => {
            // Use edited content from NutritionEditor if available, otherwise raw state
            const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
            const finalPlan = edited ? cleanPlanForPDF(edited.plan) : cleanPlanForPDF(consultation.nutrition_plan);
            const finalSupp = edited ? cleanPlanForPDF(edited.supplements) : cleanPlanForPDF(consultation.supplements);
            return (
              <NutritionPdfBody
                sections={structurePlanSections(finalPlan, finalSupp, { isFollowup })}
                isFollowup={isFollowup}
                clientName={form.prenom || client?.prenom || 'Client'}
                date={formatDate(new Date().toISOString())}
                followupWeek={followupWeek}
              />
            );
          })()}

          {generating && (
            <div className="loading" style={{ padding: '30px 20px' }}>
              <div className="loading-spinner" />
              <p>Claude analyse le profil et genere le plan nutrition...</p>
            </div>
          )}

          {consultation.nutrition_plan && (() => {
            const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
            const scorePlan = edited ? edited.plan : consultation.nutrition_plan;
            const scoreSupp = edited ? edited.supplements : consultation.supplements;
            return (
              <PlanQualityScore
                score={scorePlanQuality(
                  scorePlan,
                  scoreSupp,
                  { ...form, _weeklyFeedback: weeklyFeedback },
                  { isFollowup, followupWeek }
                )}
                autoCorrected={autoCorrected}
              />
            );
          })()}

          {consultation.nutrition_plan ? (
            <NutritionEditor
              planText={consultation.nutrition_plan}
              supplementsText={consultation.supplements}
              recipesText={consultation.recipes}
              form={form}
              client={client}
              getEditedDataRef={editorGetDataRef}
              onSave={(plan, supplements, recipes) => {
                setConsultation(prev => ({
                  ...prev,
                  nutrition_plan: plan,
                  supplements,
                  recipes,
                }));
              }}
              onExportPDF={(plan, supplements, recipes) => {
                setPdfError('');

                // Score + validate content (body uniquement)
                const currentScore = scorePlanQuality(plan, supplements, { ...form, _weeklyFeedback: weeklyFeedback }, { isFollowup, followupWeek });
                const fullText = (plan || '') + '\n' + (supplements || '');
                const validation = validatePlanForPDF(fullText, currentScore, { isFollowup });
                if (!validation.valid) {
                  setPdfError('Export bloque : ' + validation.errors.join(' | '));
                  return;
                }

                // Clean and export (body nutrition, cover generee separement)
                const cleanedPlan = cleanPlanForPDF(plan);
                const cleanedSupplements = cleanPlanForPDF(supplements);
                exportConsultationPDF({
                  observations: consultation.observations,
                  nutritionalObservations: consultation.nutritional_observations,
                  bloodTestDone: consultation.blood_test_done,
                  dnaTestDone: consultation.dna_test_done,
                  nutritionPlan: cleanedPlan,
                  supplements: cleanedSupplements,
                  recipes,
                  notesForCoach: consultation.notes_for_coach,
                  date: new Date().toISOString(),
                  isFollowup,
                  followupData: isFollowup ? followupData : null,
                }, client);
              }}
              onExportCover={(coverFields) => {
                exportCoverPDF({
                  blood_test_done: consultation.blood_test_done,
                  dna_test_done: consultation.dna_test_done,
                  date: new Date().toISOString(),
                  coverFields,
                }, client);
              }}
            />
          ) : (
            <>
              <div className="field full-width" style={{ marginTop: 16 }}>
                <label>Plan nutrition personnalise</label>
                <textarea
                  value={consultation.nutrition_plan}
                  onChange={(e) => updateField('nutrition_plan', e.target.value)}
                  placeholder="Le plan sera genere par l'IA, pre-rempli via un template, ou saisi manuellement..."
                  rows={16}
                />
              </div>
              <div className="field full-width" style={{ marginTop: 16 }}>
                <label>Supplements recommandes</label>
                <textarea
                  value={consultation.supplements}
                  onChange={(e) => updateField('supplements', e.target.value)}
                  placeholder="Les supplements seront generes par l'IA ou saisissez-les manuellement..."
                  rows={8}
                />
              </div>
              <div className="field full-width" style={{ marginTop: 16 }}>
                <label>Recettes recommandees</label>
                <textarea
                  value={consultation.recipes}
                  onChange={(e) => updateField('recipes', e.target.value)}
                  placeholder="Recettes specifiques a recommander au client..."
                  rows={6}
                />
              </div>
            </>
          )}
        </div>
      )}

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

      {/* Navigation */}
      <div className="nav-buttons">
        {step > 1 ? (
          <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>Precedent</button>
        ) : (
          <button className="btn btn-secondary" onClick={onCancel}>Annuler</button>
        )}
        {step < totalSteps ? (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Suivant</button>
        ) : (
          <button className="btn btn-primary" onClick={handleSave}>Sauvegarder la consultation</button>
        )}
      </div>
    </div>
  );
}
