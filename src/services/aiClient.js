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

function postProcess(text) {
  if (!text) return text;
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#{1,4}\s+/gm, '')
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
    .replace(/en effet[,.]?\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

  const system = `Tu es Anissa, nutritionniste experte en nutrition fonctionnelle.
Tu travailles sur un plan nutritionnel personnalis\u00e9.

PROFIL CLIENT :
${context}

R\u00c8GLES ABSOLUES :
- R\u00e9ponds UNIQUEMENT avec le contenu am\u00e9lior\u00e9
- M\u00eame format que l'original (listes si listes, paragraphes si paragraphes)
- Ne rajoute pas de titre ni d'introduction
- Reste concis \u2014 am\u00e9liore, ne rallonge pas de plus de 30%
- En fran\u00e7ais, ton professionnel et chaleureux

R\u00c8GLES D'\u00c9CRITURE ABSOLUES :
- JAMAIS de formulations molles : 'id\u00e9alement', 'n'h\u00e9sitez pas', 'il est conseill\u00e9', 'vous pourriez', 'il est important de', 'en effet', 'force est de constater'
- JAMAIS de markdown : pas de **gras**, pas de # titres
- JAMAIS de m\u00e9ta-commentaires : pas de 'cette approche', 'ce protocole', 'en conclusion', 'pour r\u00e9sumer'
- Phrases directes, courtes, actionnables
- Ton : comme une nutritionniste qui parle \u00e0 son client en face-\u00e0-face

EXEMPLES DE STYLE :
\u274c "Id\u00e9alement, il est conseill\u00e9 de consommer des l\u00e9gumes verts"
\u2705 "Consommez 200g de l\u00e9gumes verts \u00e0 chaque repas"
\u274c "N'h\u00e9sitez pas \u00e0 int\u00e9grer des sources de prot\u00e9ines"
\u2705 "Ajoutez 25g de prot\u00e9ines \u00e0 chaque repas : poulet, poisson, \u0153ufs ou l\u00e9gumineuses"`;

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

  const system = `Tu es Anissa, nutritionniste experte.
Tu cr\u00e9es du contenu pour un plan nutritionnel personnalis\u00e9.

PROFIL CLIENT :
${context}

R\u00c8GLES :
- Contenu directement utilisable, sans introduction
- Format lisible : listes \u00e0 puces pour les conseils, paragraphes pour les analyses
- Personnalis\u00e9 pour CE client sp\u00e9cifiquement
- En fran\u00e7ais, professionnel

R\u00c8GLES D'\u00c9CRITURE ABSOLUES :
- JAMAIS de formulations molles : 'id\u00e9alement', 'n'h\u00e9sitez pas', 'il est conseill\u00e9', 'vous pourriez', 'il est important de'
- JAMAIS de markdown : pas de **gras**, pas de # titres
- JAMAIS de m\u00e9ta-commentaires : pas de 'en conclusion', 'pour r\u00e9sumer', 'cette approche'
- Phrases directes, courtes, actionnables
- Ton : nutritionniste qui parle en face-\u00e0-face`;

  const raw = await aiRequest(
    system,
    typeInstructions[sectionTitle] || typeInstructions['libre'],
    1500
  );
  return postProcess(raw);
}

export async function suggestActions(form, sectionTitle, currentContent) {
  const context = buildClientContext(form);

  const system = `Tu es Anissa, nutritionniste experte.
Analyse cette section et propose exactement 3 suggestions courtes d'am\u00e9lioration.
PROFIL CLIENT : ${context}
R\u00e9ponds UNIQUEMENT avec un JSON : {"suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]}
Chaque suggestion : max 5 mots, actionnable, sp\u00e9cifique \u00e0 ce client.
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

  const system = `Tu es Anissa, nutritionniste experte.
Tu analyses des plans nutritionnels et fournis un feedback structur\u00e9.
PROFIL CLIENT :
${context}

R\u00e9ponds UNIQUEMENT en JSON valide, SANS balises markdown (pas de \`\`\`json), SANS texte avant ou apres :
{
  "score": <number 0-100>,
  "strengths": ["point fort 1 (max 15 mots)", "point fort 2 (max 15 mots)"],
  "issues": ["probleme 1 (max 15 mots)", "probleme 2 (max 15 mots)"],
  "quickWins": ["amelioration 1 (max 15 mots)", "amelioration 2 (max 15 mots)", "amelioration 3 (max 15 mots)"],
  "verdict": "<1 phrase max 20 mots>"
}

CONTRAINTES CRITIQUES :
- Chaque string TRES courte (max 15 mots)
- Max 2-3 items par tableau
- Verdict max 20 mots
- Priorite a la concision pour que le JSON reste dans la limite de tokens

R\u00c8GLES D'\u00c9CRITURE :
- JAMAIS de formulations molles, markdown ou meta-commentaires
- Phrases directes et concises`;

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
