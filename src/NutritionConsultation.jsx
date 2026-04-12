import { useState } from 'react';
import { getClient, getNutritionConsultations, savePlanVersion, getPlanVersions } from './store';
import { FORMULES } from './formSteps';
import NutritionTemplates from './NutritionTemplates';
import NutritionEditor from './NutritionEditor';
import FollowUpStep, { buildFollowupSummary } from './FollowUpStep';
import { exportConsultationPDF, exportFicheFrigoPDF, exportCoverPDF } from './nutritionPdf';
import { SmartTextarea } from './KeywordHints';
import ContraIndicationAlert, { detectContraIndications } from './ContraIndicationAlert';

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
function PlanQualityScore({ score }) {
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
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState(null);
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

    parts.push('');
    parts.push(`Genere un plan nutrition personnalise complet sur 4 semaines avec variete, listes de courses, et alternatives naturelles avant les complements.`);

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

      // Appel 3 : Audit de coherence (appel separe)
      try {
        const auditResponse = await fetch('/api/claude', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-fallback-key': apiKey.trim(),
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            system: AUDIT_PROMPT,
            messages: [{ role: 'user', content: `PROFIL CLIENT :\n- Allergies : ${form.allergies || 'Aucune'}\n- Intolerances : ${form.alimentsEvites || 'Aucune'}\n- Pathologies : ${form.pathologies || 'Aucune'}\n- Traitements : ${form.traitements || 'Aucun'}\n\nPLAN GENERE :\n${planText}\n\nSUPPLEMENTS :\n${suppText || 'Aucun'}` }],
          }),
        });

        if (auditResponse.ok) {
          const auditData = await auditResponse.json();
          const auditResult = auditData.content?.[0]?.text || '';
          // If audit found issues, append corrections to the plan
          if (auditResult && !auditResult.includes('AUDIT OK')) {
            updateField('nutrition_plan', planText + '\n\n---\n\nAUDIT DE COHERENCE :\n' + auditResult);
          } else {
            updateField('nutrition_plan', planText);
          }
        } else {
          updateField('nutrition_plan', planText);
        }
      } catch {
        // Audit failed silently — keep original plan
        updateField('nutrition_plan', planText);
      }

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

          {generating && (
            <div className="loading" style={{ padding: '30px 20px' }}>
              <div className="loading-spinner" />
              <p>Claude analyse le profil et genere le plan nutrition...</p>
            </div>
          )}

          {consultation.nutrition_plan && (
            <PlanQualityScore
              score={scorePlanQuality(
                consultation.nutrition_plan,
                consultation.supplements,
                { ...form, _weeklyFeedback: weeklyFeedback },
                { isFollowup, followupWeek }
              )}
            />
          )}

          {consultation.nutrition_plan ? (
            <NutritionEditor
              planText={consultation.nutrition_plan}
              supplementsText={consultation.supplements}
              recipesText={consultation.recipes}
              form={form}
              client={client}
              onSave={(plan, supplements, recipes) => {
                setConsultation(prev => ({
                  ...prev,
                  nutrition_plan: plan,
                  supplements,
                  recipes,
                }));
              }}
              onExportPDF={(plan, supplements, recipes) => {
                exportConsultationPDF({
                  observations: consultation.observations,
                  nutritionalObservations: consultation.nutritional_observations,
                  bloodTestDone: consultation.blood_test_done,
                  dnaTestDone: consultation.dna_test_done,
                  nutritionPlan: plan,
                  supplements,
                  recipes,
                  notesForCoach: consultation.notes_for_coach,
                  date: new Date().toISOString(),
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
