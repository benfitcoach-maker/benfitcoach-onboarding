import { ANISSA_IDENTITY_CORE } from './anissaIdentity';

async function aiRequest(systemPrompt, userMessage, maxTokens = 1500) {
  const apiKey = localStorage.getItem('bfc_api_key') || '';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-fallback-key'] = apiKey;

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur API: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text?.trim() || '';
}

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
  // V55b : elargi aux minuscules et accents (pas juste majuscules)
  // Pattern : 4+ caracteres mono-lettre separes par espaces simples
  out = out.replace(/((?:[A-Za-zÀ-ÿ]\s){4,}[A-Za-zÀ-ÿ])/g, (match) => {
    // Verifier que ce n'est pas du texte normal : chaque "token" doit etre 1 seul caractere
    const tokens = match.split(/\s+/);
    const allSingle = tokens.every(t => t.length === 1);
    if (!allSingle) return match;
    return tokens.join('');
  });

  // 4) Remplacer fleches cassees par fleches propres
  // V55b : inclure smart quotes Unicode (U+201C, U+201D, U+2018, U+2019)
  out = out
    .replace(/!["'»«\u2018\u2019\u201C\u201D\u00AB\u00BB]/g, '→')
    .replace(/→\s*["'»«\u2018\u2019\u201C\u201D\u00AB\u00BB]/g, '→ ')
    // Remplacer aussi les sequences ->" ou ->'  residuelles
    .replace(/!["']/g, '→');

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

export async function analyzeFullPlan(form, planText, supplementsText) {
  const context = buildClientContext(form);
  const wordCount = (planText || '').split(/\s+/).filter(Boolean).length;
  const prenom = form?.prenom || 'le client';

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
   Les 9 sections sont-elles presentes et concises ?
   (Analyse profil, Strategie, Semaine 1, Rotations, Fiche frigo, Protocoles ciblés,
   Ajustements environnementaux, Recommandations coach, Plan d'action S1-S4)
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
- Ne surnote jamais. Sois stricte. Un plan generique doit avoir un score faible meme s'il semble correct.`;

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
