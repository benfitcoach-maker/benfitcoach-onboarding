import { ANISSA_IDENTITY_CORE } from './prompts/nutrition/identity.fr';
// V97.0 : centralisation des appels Claude via services/anthropic.js
import { callClaude } from './anthropic';

const aiRequest = (systemPrompt, userMessage, maxTokens = 1500) =>
  callClaude({ system: systemPrompt, user: userMessage, maxTokens });

// V55 : strip le contenu de plan redondant qui se glisse parfois avant la section Suppléments
// (ex : "PLAN NUTRITIONNEL PERSONNALISÉ", "SYNTHÈSE CLINIQUE", "JOURNÉES TYPES"...)
export function stripPlanLeakage(suppText) {
  if (!suppText) return suppText;
  let out = suppText;
  const marker = /SUPPL[EÉ]MENTS?\s+(RECOMMAND[EÉ]S?|A\s+PRENDRE)/i;
  const match = out.match(marker);
  if (match && match.index > 50) {
    // Il y a un prefixe suspect avant "SUPPLEMENTS..." : on le coupe
    out = out.slice(match.index).trim();
  }
  // V55b : strip le titre redondant "SUPPLEMENTS RECOMMANDES" en debut si present
  // (sera rendu par addSectionTitle, inutile de l'avoir aussi dans le contenu)
  out = out.replace(/^SUPPL[EÉ]MENTS?\s+(RECOMMAND[EÉ]S?|A\s+PRENDRE)\s*:?\s*\n+/i, '').trim();

  // V64 Fix 3 : strip "TABLEAU HORAIRE PERSONNALISE" trailing block si vide/quasi-vide
  // Evite d'afficher un header de section sans contenu utile (effet doc non fini)
  const tableauRe = /\n+\s*#{0,4}\s*TABLEAU\s+HORAIRE(?:\s+PERSONNALIS[EÉ])?\s*:?\s*\n([\s\S]*)$/i;
  const tableauMatch = out.match(tableauRe);
  if (tableauMatch) {
    const after = tableauMatch[1] || '';
    // Compte les lignes "utiles" : "Moment : contenu" avec contenu non-vide/non-trivial
    const usefulLines = after.split('\n')
      .map(l => l.trim().replace(/^[-–•*·]\s*/, ''))
      .filter(l => {
        const colon = l.indexOf(':');
        if (colon <= 0) return false;
        const content = l.slice(colon + 1).trim();
        return content.length > 2 && !/^(aucun|rien|n\/a|-+|n[eé]ant)$/i.test(content);
      });
    // Si moins de 2 lignes utiles → strip le header ET tout ce qui suit
    if (usefulLines.length < 2) {
      out = out.slice(0, tableauMatch.index).trimEnd();
    }
  }

  return out;
}

export function postProcess(text) {
  if (!text) return text;

  let out = text;

  // V55 : nettoyage visuel critique (emojis, letter-spacing, arrows cassees, markdown tables)

  // 1) Retirer caracteres invisibles (zero-width spaces, joiners) qui causent "F A I R E"
  out = out.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 2) Retirer TOUS les emojis (unicode ranges emoji/symbol/pictographic)
  // Conserve les caracteres accentues francais, garde les fleches simples
  out = out.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F000}-\u{1F2FF}]|[\u{1FA00}-\u{1FAFF}]|[\u2700-\u27BF]/gu, '');

  // 3) Detecter et fusionner les mots lettre-espacees ("F A I R E" -> "FAIRE")
  // V62 : regex plus robuste, supporte 3+ tokens mono-char successifs
  // Pattern : 3+ caracteres mono-lettre separes par espaces simples
  out = out.replace(/((?:[A-Za-zÀ-ÿ]\s){3,}[A-Za-zÀ-ÿ])/g, (match) => {
    const tokens = match.split(/\s+/);
    const allSingle = tokens.every(t => t.length === 1);
    if (!allSingle) return match;
    return tokens.join('');
  });

  // 4) Remplacer fleches cassees et → unicode par ">" (safe WinAnsi/Helvetica)
  // V67 : → rend mal en jsPDF Helvetica (encodage WinAnsi sans U+2192)
  // Solution : tout convertir en ">" qui rend parfaitement
  out = out
    // Pattern exhaustif : ! + (0..3 espaces) + char non-alphanum/non-ouvert-paren → ">"
    .replace(/!\s{0,3}([^\sA-Za-zÀ-ÿ0-9(])/g, (m, c) => {
      if (/[\.\,\)\;\:\?\]\}\!]/.test(c)) return m;
      return '> ';
    })
    // Remplacer TOUTES les vraies fleches unicode par ">"
    .replace(/[→⇒➜➔➤▶►]/g, '>')
    // Nettoyer les quotes residuelles apres ">"
    .replace(/>\s*[\u0022\u0027\u00AB\u00B4\u00BB\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2032\u2033]/g, '> ')
    // Normaliser espaces multiples apres ">"
    .replace(/>\s{2,}/g, '> ');

  // 5) Convertir tableaux markdown | a | b | c | en format texte lisible
  // Si on detecte un pattern de tableau markdown, on le convertit
  out = out.replace(/^\|([^\n]+)\|\s*$/gm, (match, content) => {
    // Skip separateurs | ---- | ---- |
    if (/^[\s|:\-]+$/.test(match)) return '';
    const cells = content.split('|').map(c => c.trim()).filter(Boolean);
    return cells.join(' : ').replace(/\s+:\s+:\s+/g, ' : ');
  }).replace(/\n\n+/g, '\n\n');

  // 6) Nettoyer markdown standard
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#{1,4}\s+/gm, '');

  // 7) Formulations molles
  out = out
    .replace(/n'h\u00e9sitez pas \u00e0/gi, '')
    .replace(/il est (important|essentiel|crucial|recommand\u00e9) de/gi, '')
    .replace(/id\u00e9alement[,]?\s*/gi, '')
    .replace(/vous pourriez/gi, 'vous pouvez')
    .replace(/il est conseill\u00e9 de/gi, '')
    .replace(/en tant qu[e']\s*/gi, '')
    .replace(/en conclusion[,.]?\s*/gi, '')
    .replace(/pour r\u00e9sumer[,.]?\s*/gi, '')
    .replace(/il convient de noter que/gi, '')
    .replace(/dans le cadre de/gi, 'pour')
    .replace(/au niveau de/gi, 'sur')
    .replace(/cette approche/gi, 'elle')
    .replace(/ce protocole/gi, '')
    .replace(/il est \u00e0 noter que/gi, '')
    .replace(/force est de constater que/gi, '')
    .replace(/en effet[,.]?\s*/gi, '');

  // 8) Normaliser les retours a la ligne
  out = out.replace(/\n{3,}/g, '\n\n').trim();

  return out;
}

function buildClientContext(form) {
  return [
    form?.prenom       ? `Client : ${form.prenom}` : '',
    form?.age          ? `\u00c2ge : ${form.age} ans` : '',
    form?.genre        ? `Genre : ${form.genre}` : '',
    form?.poids        ? `Poids : ${form.poids} kg` : '',
    form?.taille       ? `Taille : ${form.taille} cm` : '',
    form?.objectifPrincipalNutrition
      ? `Objectif : ${form.objectifPrincipalNutrition}` : '',
    form?.symptomesObjectifs?.length
      ? `Sympt\u00f4mes/objectifs : ${form.symptomesObjectifs.join(', ')}` : '',
    form?.allergies    ? `Allergies : ${form.allergies}` : '',
    form?.alimentsEvites ? `Aliments \u00e9vit\u00e9s : ${form.alimentsEvites}` : '',
    form?.pathologies  ? `Pathologies : ${form.pathologies}` : '',
    form?.digestion    ? `Digestion : ${form.digestion}` : '',
    form?.heuresSommeil ? `Sommeil : ${form.heuresSommeil}h/nuit` : '',
  ].filter(Boolean).join('\n');
}

const ACTION_PROMPTS = {
  improve:     'Am\u00e9liore ce contenu : rends-le plus pr\u00e9cis, personnalis\u00e9 et actionnable pour ce client.',
  simplify:    'Simplifie ce contenu : phrases courtes, vocabulaire accessible, garde l\'essentiel.',
  actionnable: 'Rends ce contenu ultra-actionnable : \u00e9tapes concr\u00e8tes, quantit\u00e9s pr\u00e9cises, timing clair.',
  adapt:       'Adapte ce contenu au profil exact de ce client : tiens compte de ses contraintes, objectifs et pathologies.',
  rewrite:     'Reformule de fa\u00e7on professionnelle et bienveillante, ton nutritionniste expert.',
};

export async function improveSection(form, sectionTitle, currentContent, action = 'improve') {
  const context = buildClientContext(form);
  const instruction = ACTION_PROMPTS[action] || ACTION_PROMPTS.improve;

  // V54 : harmonise avec ANISSA_IDENTITY_CORE (Nyon, longevite, tutoiement)
  const system = `${ANISSA_IDENTITY_CORE}

CONTEXTE : Tu ameliores une seule section du plan nutritionnel.

PROFIL CLIENT :
${context}

REGLES ABSOLUES :
- Reponds UNIQUEMENT avec le contenu ameliore
- Meme format que l'original (listes si listes, paragraphes si paragraphes)
- Ne rajoute pas de titre ni d'introduction
- Reste concis \u2014 ameliore, ne rallonge pas de plus de 30%

REGLES D'ECRITURE :
- Tutoiement obligatoire (pas de "vous", que "tu")
- JAMAIS de formulations molles : 'idealement', 'n'hesitez pas', 'il est conseille', 'vous pourriez', 'il est important de', 'en effet'
- JAMAIS de markdown : pas de **gras**, pas de # titres
- JAMAIS de meta-commentaires : pas de 'cette approche', 'ce protocole', 'en conclusion', 'pour resumer'
- Verbes d'action directs : fais, ajoute, remplace, garde, teste, retire
- Phrases courtes, actionnables, chaleureuses mais expertes
- Jargon clinique traduit (pas "dysbiose" -> "intestin fragilise")

EXEMPLES DE STYLE :
\u274c "Idealement, il est conseille de consommer des legumes verts"
\u2705 "200g de legumes verts a chaque repas"
\u274c "N'hesitez pas a integrer des sources de proteines"
\u2705 "Ajoute 25g de proteines a chaque repas : poulet, poisson, oeufs ou legumineuses"`;

  const raw = await aiRequest(
    system,
    `Section "${sectionTitle}" :\n\n${currentContent}\n\nInstruction : ${instruction}`,
    1200
  );
  return postProcess(raw);
}

export async function generateSection(form, sectionTitle, sectionType = 'libre') {
  const context = buildClientContext(form);

  const typeInstructions = {
    'Plan alimentaire':  'G\u00e9n\u00e8re un plan alimentaire type avec petit-d\u00e9jeuner, d\u00e9jeuner, collation, d\u00eener. Quantit\u00e9s pr\u00e9cises, adapt\u00e9 aux contraintes du client.',
    'Analyse du profil': 'G\u00e9n\u00e8re une analyse du profil nutritionnel : points forts, points d\'attention, recommandations prioritaires.',
    'Suppl\u00e9ments':       'G\u00e9n\u00e8re des recommandations de suppl\u00e9ments adapt\u00e9es au profil : nom, dosage, moment de prise, justification.',
    'Recettes':          'G\u00e9n\u00e8re 2-3 recettes simples et rapides adapt\u00e9es aux contraintes du client.',
    'Conseils pratiques':'G\u00e9n\u00e8re 5-7 conseils pratiques et actionnables pour ce client sp\u00e9cifique.',
    'libre':             `G\u00e9n\u00e8re un contenu pertinent et personnalis\u00e9 pour la section "${sectionTitle}".`,
  };

  // V54 : harmonise avec ANISSA_IDENTITY_CORE
  const system = `${ANISSA_IDENTITY_CORE}

CONTEXTE : Tu crees du contenu pour une nouvelle section du plan nutritionnel.

PROFIL CLIENT :
${context}

REGLES :
- Contenu directement utilisable, sans introduction
- Format lisible : listes a puces pour les conseils, paragraphes pour les analyses
- Personnalise pour CE client specifiquement

REGLES D'ECRITURE :
- Tutoiement obligatoire
- JAMAIS de formulations molles : 'idealement', 'n'hesitez pas', 'il est conseille', 'vous pourriez', 'il est important de'
- JAMAIS de markdown : pas de **gras**, pas de # titres
- JAMAIS de meta-commentaires : pas de 'en conclusion', 'pour resumer', 'cette approche'
- Verbes d'action directs : fais, ajoute, remplace, garde, teste, retire
- Phrases courtes, actionnables, chaleureuses mais expertes`;

  const raw = await aiRequest(
    system,
    typeInstructions[sectionTitle] || typeInstructions['libre'],
    1500
  );
  return postProcess(raw);
}

export async function suggestActions(form, sectionTitle, currentContent) {
  const context = buildClientContext(form);

  // V54 : harmonise avec ANISSA_IDENTITY_CORE
  const system = `${ANISSA_IDENTITY_CORE}

CONTEXTE : Tu analyses une section du plan et proposes 3 suggestions courtes d'amelioration.
PROFIL CLIENT : ${context}
Reponds UNIQUEMENT avec un JSON : {"suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]}
Chaque suggestion : max 5 mots, actionnable, specifique a ce client, tutoiement.
JAMAIS de formulations molles ou de markdown.`;

  const text = await aiRequest(
    system,
    `Section "${sectionTitle}" : ${currentContent.slice(0, 500)}`,
    200
  );

  try {
    const parsed = JSON.parse(text);
    return parsed.suggestions || [];
  } catch {
    return [];
  }
}

// V96.23 — checklist des MUST INCLUDE par module profil. L'audit IA verifie
// que ces elements specifiques sont presents dans le plan quand un module a
// ete injecte par le composer. Plus precis qu'un audit generique.
const MUST_INCLUDE_BY_PROFILE = {
  complicationsDiabete: [
    'mention LITTERALE de "lutiine" (ou "lutéine") associee a la retinopathie',
    'mention LITTERALE de "vitamine K2" (ou "vit K2") pour les calcifications arterielles',
    'mention de "alpha-lipoique" ET "magnesium" SI neuropathie/mal perforant declare',
    'phrase qui RELIE explicitement la stabilite glycemique a la protection des complications',
  ],
  saos: [
    'horaire diner avant "19h" ou "19h30" + mention "leger" / "allege"',
    'mention LITTERALE de "lumiere naturelle" + "matin" ou "reveil"',
    'mention LITTERALE de "cafeine" (stop apres 14h) ET "alcool" en lien avec apnees',
  ],
  diabete: [
    'sequence repas explicite : fibres → proteines → glucides',
    'pas de mention de dose insuline (perimetre medecin, INTERDIT)',
  ],
  digestifChronique: [
    'mention de la mastication (20-30 fois/bouchee)',
    'reduction temporaire des cruditees (legumes cuits 2 a 3 semaines)',
    'eau hors repas (30 min avant / 1h apres)',
  ],
  nephropathie: [
    'plafond proteique chiffre LITTERAL : "0,8 g/kg/jour" + calcul en grammes pour le poids du client',
    'limitation sodium chiffree LITTERALE : "< 5 g de sel par jour" (ou 4 g si HTA)',
    'mention "faiblement mineralisee" pour l\'eau de boisson',
  ],
  clostridiumDifficile: [
    'cadrage : nutrition en SUPPORT du traitement medical (vancomycine/fidaxomicine)',
    'phase aigue : hydratation prioritaire, aliments tres digestes',
    'phase reconstruction : reintroduction progressive prebiotiques + fermentes',
    'garde-fou : pas de probiotique sans avis du gastroenterologue',
  ],
  grossesse: [
    'liste claire d\'aliments INTERDITS (listeria, toxoplasmose, mercure, foie animal)',
    'mention folates (B9), iode, omega-3 DHA, calcium/D, fer',
    'INTERDIT : alcool zero, jamais de regime hypocalorique, jamais jeune intermittent',
  ],
  allaitement: [
    'apport calorique +500 kcal/jour explicite',
    'hydratation 2,5 a 3 L/jour',
    'omega-3 DHA, iode, calcium/D mentionnes',
    'interdit : pas de regime restrictif, pas d\'eviction preventive sans symptomes bebe',
  ],
  postPartum: [
    'pas de regime restrictif les 6 premiers mois',
    'restauration fer + B12 + B9 + D explicite',
    'omega-3 DHA pour prevention baby blues',
  ],
  perimenopause: [
    'stabilite glycemique (sequence repas, IG bas)',
    'soutien masse maigre : proteines elevees (~1.2 g/kg)',
    'densite osseuse : Ca + vit D + K2',
  ],
  menopause: [
    'proteines hautes anti-sarcopenie (1.2-1.5 g/kg)',
    'densite osseuse : calcium + D + K2',
    'mention sport resistance / renforcement musculaire',
  ],
  femmeCycle: [
    'adaptation phase luteale (J15-J28) si cycle renseigne',
    'sources de fer + vit C parallele si regles abondantes',
  ],
  // V96.26 — 8 nouveaux modules
  performanceSportif: [
    'apport proteique chiffre selon type sport (1.6-2.2 g/kg force ou 1.4-1.7 g/kg endurance)',
    'timing peri-effort chiffre : 30-60 min avant + 30 min apres avec ratios proteines/glucides',
    'hydratation effort + electrolytes mentionnes (500-800 ml/h)',
  ],
  thyroide: [
    'mention selenium ET zinc (cofacteurs T4 → T3)',
    'iode prudent (pas de supplement haute dose si Hashimoto)',
    'timing Levothyrox a jeun + 30-60 min avant repas si traitement',
    'eviction temporaire gluten 8 semaines si Hashimoto',
  ],
  burnoutCortisol: [
    'stabilite glycemique stricte (sequence repas, pas de saut)',
    'magnesium par alimentation cite (oleagineux, cacao cru, legumes verts)',
    'omega-3 EPA/DHA cite',
    'cafeine stop apres 12h-13h ET alcool zero soir explicites',
  ],
  preConceptionFertilite: [
    'folates B9 (legumes verts, supplement medical)',
    'iode 150-200 mcg/jour cite',
    'ferritine cible 50-80 ng/mL',
    'omega-3 DHA pour qualite cellulaire',
    'mention perturbateurs endocriniens a limiter',
  ],
  spm: [
    'magnesium ET vitamine B6 cites (couple anti-SPM)',
    'omega-3 EPA pour douleurs (anti-prostaglandines)',
    'phase luteale (J15-J28) adaptee : proteines + feculents complets diner',
    'fer + vit C si regles abondantes',
  ],
  endometriose: [
    'omega-3 EPA en grande quantite (3-4x/semaine poisson gras)',
    'brassicacees cuites quotidiennes (detox oestrogenes)',
    'mention perturbateurs endocriniens a limiter',
    'test eviction gluten + lait 8 semaines',
  ],
  tdah: [
    'stabilite glycemique stricte (pas de sucres rapides isoles a jeun)',
    'omega-3 EPA + DHA quotidiens',
    'proteines au petit-dejeuner cite (precurseur dopamine, tyrosine)',
    'eviter additifs : E102, E110, E122, E124, E129, benzoate de sodium',
  ],
  sopk: [
    'IG bas systematique (sequence repas fibres → proteines → glucides)',
    'inositol mentionne (myo + d-chiro)',
    'cannelle quotidienne (sensibilisateur insulinique)',
    'omega-3 EPA + the vert (anti-androgene)',
    'test eviction lait industriel 8 semaines',
  ],
};

function buildMustIncludeChecklist(composerProfile) {
  if (!composerProfile?.all || composerProfile.all.length === 0) return '';
  const lines = [];
  for (const tag of composerProfile.all) {
    const items = MUST_INCLUDE_BY_PROFILE[tag];
    if (!items) continue;
    lines.push(`\n[${tag}]`);
    for (const item of items) lines.push(`  - ${item}`);
  }
  if (lines.length === 0) return '';
  return `\n\nMUST INCLUDE — elements OBLIGATOIRES dans le plan vu les modules profil injectes par le composer (verifie chacun dans le plan, signale les manques en issues) :${lines.join('\n')}`;
}

export async function analyzeFullPlan(form, planText, supplementsText, { locale = 'FR', composerProfile = null, aiDirectives = '' } = {}) {
  const context = buildClientContext(form);
  const wordCount = (planText || '').split(/\s+/).filter(Boolean).length;
  const prenom = form?.prenom || (locale === 'EN' ? 'the client' : 'le client');

  // V88.14 : si locale EN, utiliser le system prompt anglais (meme contenu clinique,
  // meme format JSON, juste la langue de sortie change \u2014 quickWins/strengths/issues/
  // verdict seront en anglais). Sinon, fallback sur le FR historique (inchange).
  if (locale === 'EN') {
    const systemEn = `You are Anissa Deroubaix, nutritionist in Nyon, specialized in longevity and genetics.
You are auditing this nutrition plan you generated for ${prenom}, before sending it to the client.

CLIENT PROFILE:
${context}

You verify the plan meets YOUR quality standards. You are strict but fair.

AUDIT CRITERIA (score 0-100, indicative weights):

1. CLINICAL PRIORITY RESPECTED (20 pts)
   Mandatory order: pathology > digestion > energy > goal.
   Does the main problem drive 70% of the plan decisions?

2. ADHERENCE (20 pts)
   Plan realistic for the client's real life? Not a stack of rules?
   Each recommendation concrete, doable, measurable?
   If profile shows low discipline: is the plan simplified accordingly?

3. IMPLICIT PHYSIOLOGICAL LOGIC (15 pts)
   Does every food choice answer an identified problem from the profile?
   Is the problem -> solution link coherent without being explained?

4. ANISSA TONE (15 pts)
   Consistent second-person "you" (no mix)?
   Client first name used 0-2 times max (not more)?
   Action verbs: do, add, replace, keep, test, remove?
   Short and direct sentences?

5. FORBIDDEN LANGUAGE RESPECTED (10 pts)
   No soft formulations: "ideally", "if you wish", "it is advisable",
   "eat balanced", "vary your diet", "drink enough"?
   No explanatory parentheses inside lists?
   No untranslated clinical jargon (dysbiosis, insulinic)?

6. INDIVIDUAL ADAPTATION (10 pts)
   Allergies/intolerances from profile strictly respected?
   Coherent hormonal adaptation (female cycle / male andropause / age)?
   Biological cofactors integrated if labs provided?

7. STRUCTURE & COMPLETENESS (10 pts)
   Are the 9 sections present and concise?
   (Profile analysis, Strategy, Week 1, Rotations, Fridge rules, Targeted protocols,
   Environmental adjustments, Coach recommendations, Action plan W1-W4)
   Target length 1200-1600 words respected?

OUTPUT FORMAT:
Respond ONLY with valid JSON, NO markdown fences, NO surrounding text:
{
  "score": <number 0-100>,
  "strengths": ["concrete strong point (max 15 words)", "..."],
  "issues": ["precise issue referring to criteria (max 15 words)", "..."],
  "quickWins": ["concrete action immediately applicable (max 15 words)", "..."],
  "verdict": "<1 sentence max 20 words - overall synthesis>"
}

CONSTRAINTS:
- 2 to 4 items per array, very concise
- Issues MUST refer to a criterion: "tone", "adherence", "priority", "forbidden", etc.
- quickWins MUST be precise actions executable in 2 minutes of editing
- Score reflects reality: 90+ = premium, 75-89 = good, 60-74 = needs rework, <60 = problem
- Never over-score. Be strict. A generic plan must have a low score even if it looks correct.
- IMPORTANT: the plan being audited is in English. Your quickWins and all text must be in English
  so that when they are inserted into the plan, the result stays in English.`;

    const text = await aiRequest(
      systemEn,
      `Analyze this plan (${wordCount} words):\n\n${(planText || '').slice(0, 3000)}`,
      2000
    );
    if (!text) return null;
    try {
      let clean = (text || '').replace(/```json|```/g, '').trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) clean = jsonMatch[0];
      const parsed = JSON.parse(clean);
      if (typeof parsed.score !== 'number' && !parsed.verdict) return null;
      return parsed;
    } catch (err) {
      console.warn('[analyzeFullPlan EN] JSON parse failed:', err.message);
      return null;
    }
  }

  // V52 : audit align\u00e9 sur les standards du SYSTEM_PROMPT V2 (identite Anissa + criteres concrets)
  const system = `Tu es Anissa Deroubaix, nutritionniste a Nyon, specialisee en longevite et genetique.
Tu audites ce plan nutritionnel que tu as genere pour ${prenom}, avant de l'envoyer au client.

PROFIL CLIENT :
${context}

Tu verifies que le plan respecte TES standards de qualite. Tu es stricte mais juste.

CRITERES D'AUDIT (score 0-100, ponderation indicative) :

1. PRIORITE CLINIQUE RESPECTEE (20 pts)
   Ordre obligatoire : pathologie > digestion > energie > objectif.
   Le probleme principal guide-t-il 70% des decisions du plan ?

2. ADHERENCE (20 pts)
   Plan realiste pour la vraie vie du client ? Pas empile de regles ?
   Action concrete, faisable, mesurable chaque recommandation ?
   Si discipline faible dans le profil : le plan est-il simplifie en consequence ?

3. LOGIQUE PHYSIOLOGIQUE IMPLICITE (15 pts)
   Chaque choix alimentaire repond-il a un probleme identifie du profil ?
   Le lien probleme -> solution est-il coherent sans etre explique ?

4. TON ANISSA (15 pts)
   Tutoiement uniforme (pas de melange tu/vous) ?
   Prenom client utilise 0-2 fois max (pas plus) ?
   Verbes d'action : faire, ajouter, remplacer, garder, tester, retirer ?
   Phrases courtes et directes ?

5. INTERDITS RESPECTES (10 pts)
   Aucune formulation molle : "idealement", "si vous souhaitez", "il est conseille",
   "manger equilibre", "varier l'alimentation", "boire suffisamment" ?
   Pas de parentheses explicatives dans les listes ?
   Pas de jargon clinique non traduit (dysbiose, insulinique) ?

6. ADAPTATION INDIVIDUELLE (10 pts)
   Allergies/intolerances du profil respectees strictement ?
   Adaptation hormonale cohrente (cycle femme / andropause homme / age) ?
   Cofacteurs biologiques integres si labs renseignes ?

7. STRUCTURE & COMPLETUDE (10 pts)
   Sections cibles (0 a 10) : 0.Introduction, 1.Analyse profil, 2.Strategie,
   3.Semaine 1, 4.Alternatives par repas, 5.Fiche frigo, 6.Protocoles cibles,
   7.Ajustements environnementaux, 8.Recommandations coach, 9.Plan d'action S1-S4,
   10.Cloture du plan.
   - Sections 0 + 10 = bonus si presentes, sinon non bloquant.
   - Sections 1, 2, 3, 6, 7, 8 = critiques.
   - Sections 4, 5, 9 = importantes mais Claude saute parfois la 5 (Fiche frigo)
     qui est reconstruite en aval depuis "Alternatives par repas" + "A privilegier"
     + "A limiter" via extractFridgeDataFromSections. Donc ne PAS critiquer comme
     "manquante" si les autres sections nourrissent la fiche frigo (mots-cles
     "A privilegier", "A limiter" presents OU section 4 bien remplie).
   Longueur cible 1200-1600 mots respectee ?

FORMAT DE SORTIE :
Reponds UNIQUEMENT en JSON valide, SANS balises markdown, SANS texte autour :
{
  "score": <number 0-100>,
  "strengths": ["point fort concret (max 15 mots)", "..."],
  "issues": ["probleme precis referant aux criteres (max 15 mots)", "..."],
  "quickWins": ["action concrete immediatement applicable (max 15 mots)", "..."],
  "verdict": "<1 phrase max 20 mots - synthese globale>"
}

CONTRAINTES :
- 2 a 4 items par tableau, tres concis
- Les issues DOIVENT referer a un critere : "ton", "adherence", "priorite", "interdits", etc.
- Les quickWins DOIVENT etre des actions precises executables en 2 minutes d'edit
- Score reflete la realite : 90+ = premium, 75-89 = bon, 60-74 = a retravailler, <60 = probleme
- Ne surnote jamais. Sois stricte. Un plan generique doit avoir un score faible meme s'il semble correct.

GARDE-FOUS ABSOLUS — NE JAMAIS SUGGERER ces actions dans les quickWins ou issues :
- Aucune suggestion d'ajustement de dose insuline (T1) — perimetre endocrinologue uniquement.
- Aucune suggestion de regime restrictif sur grossesse ou allaitement — perimetre gyneco/sage-femme.
- Aucune suggestion de phytoestrogenes en supplement ou de THM — perimetre medical.
- Aucune suggestion de probiotique haute dose chez immunodeprime / patient C. difficile actif
  — perimetre gastroenterologue.
- Aucune suggestion de medicament, posologie, ou modification d'un traitement en cours.
- Si DIRECTIVES SPECIFIQUES ANISSA fournies ci-dessous : les RESPECTER scrupuleusement et
  NE JAMAIS suggerer du contenu qui les contredit (ex: si directive "refuse poisson",
  ne pas suggerer d'ajouter du saumon).${buildMustIncludeChecklist(composerProfile)}${(aiDirectives || '').trim() ? `\n\nDIRECTIVES SPECIFIQUES ANISSA POUR CETTE CLIENTE (verifier qu'elles sont respectees dans le plan, JAMAIS les contredire dans tes quickWins) :\n${aiDirectives.trim()}` : ''}`;

  const text = await aiRequest(
    system,
    `Analyse ce plan (${wordCount} mots) :\n\n${(planText || '').slice(0, 3000)}`,
    2000
  );

  if (!text) return null;

  // V50b : parsing JSON robuste (extrait le premier bloc JSON trouvé même si texte autour)
  try {
    let clean = (text || '').replace(/```json|```/g, '').trim();
    // Si Claude ajoute du texte avant/après, on extrait le JSON
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) clean = jsonMatch[0];
    const parsed = JSON.parse(clean);
    // Validation basique : doit avoir au moins score OU verdict
    if (typeof parsed.score !== 'number' && !parsed.verdict) return null;
    return parsed;
  } catch (err) {
    console.warn('[analyzeFullPlan] JSON parse failed:', err.message, '\nRaw text:', text?.slice(0, 200));
    return null;
  }
}

export async function analyzeCycleReview(form, review) {
  const context = [
    form?.prenom         ? `Client : ${form.prenom}` : '',
    form?.age            ? `\u00c2ge : ${form.age} ans` : '',
    form?.objectifPrincipalNutrition
                         ? `Objectif : ${form.objectifPrincipalNutrition}` : '',
    form?.allergies      ? `Allergies : ${form.allergies}` : '',
    form?.pathologies    ? `Pathologies : ${form.pathologies}` : '',
  ].filter(Boolean).join('\n');

  const adherenceLabel = {
    '100': 'Tous les jours',
    '75': '75% du temps',
    '50': '50% du temps',
    '<50': 'Moins de 50%',
  }[review.adherence] || review.adherence;

  const reviewSummary = [
    `Adh\u00e9rence : ${adherenceLabel}`,
    `\u00c9carts : ${review.cheats === 'none' ? 'Aucun' : review.cheats === 'occasional' ? 'Occasionnels' : 'Fr\u00e9quents'}`,
    `Progression : ${review.progress === 'yes' ? 'Oui' : review.progress === 'little' ? 'Un peu' : 'Pas encore'}`,
    `\u00c9nergie : ${review.energy === 'high' ? 'Meilleure' : review.energy === 'normal' ? 'Stable' : 'Moins bonne'}`,
    `Digestion : ${review.digestion === 'good' ? 'Bonne' : review.digestion === 'average' ? 'Moyenne' : 'Difficile'}`,
    `Difficult\u00e9 plan : ${review.difficulty === 'easy' ? 'Facile' : review.difficulty === 'ok' ? 'Correct' : 'Trop difficile'}`,
    `Organisation : ${review.organisation === 'simple' ? 'Simple' : review.organisation === 'medium' ? 'G\u00e9rable' : 'Compliqu\u00e9e'}`,
    `Probl\u00e8me principal : ${review.main_issue || 'Non pr\u00e9cis\u00e9'}`,
    review.main_issue_text ? `Commentaire : ${review.main_issue_text}` : '',
  ].filter(Boolean).join('\n');

  const system = `Tu es Anissa, nutritionniste experte.
Tu analyses le bilan 4 semaines d'une cliente et tu pr\u00e9pares les recommandations pour le prochain cycle.

PROFIL CLIENT :
${context}

R\u00c8GLES D'\u00c9CRITURE :
- Phrases courtes et directes
- Pas de gras, pas de titres markdown
- Pas de "Il est important de", "N'h\u00e9sitez pas", "Id\u00e9alement"
- Ton de nutritionniste expert qui parle \u00e0 une coll\u00e8gue coach
- R\u00e9ponds UNIQUEMENT en JSON valide sans markdown

Format de r\u00e9ponse :
{
  "diagnostic": "1-2 phrases max \u2014 ce qui ressort principalement",
  "cause_dominante": "la cause principale du r\u00e9sultat (positif ou n\u00e9gatif)",
  "scores": {
    "adherence": <0-10>,
    "resultats": <0-10>,
    "bien_etre": <0-10>
  },
  "recommandations": ["recommandation 1", "recommandation 2", "recommandation 3"],
  "prochain_cycle": "1 phrase \u2014 priorit\u00e9 pour le prochain cycle"
}`;

  const text = await aiRequest(
    system,
    `Bilan 4 semaines :\n${reviewSummary}`,
    800
  );

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}
