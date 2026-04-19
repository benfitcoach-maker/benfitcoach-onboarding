import { ANISSA_IDENTITY_CORE, ADJUSTMENT_RULE } from './anissaIdentity';

async function aiRequest(systemPrompt, userMessage, maxTokens = 2000) {
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
    form?.prenom         ? `Client : ${form.prenom}` : '',
    form?.age            ? `\u00c2ge : ${form.age} ans` : '',
    form?.genre          ? `Genre : ${form.genre}` : '',
    form?.poids          ? `Poids : ${form.poids} kg` : '',
    form?.objectifPrincipalNutrition
                         ? `Objectif : ${form.objectifPrincipalNutrition}` : '',
    form?.symptomesObjectifs?.length
                         ? `Sympt\u00f4mes : ${form.symptomesObjectifs.join(', ')}` : '',
    form?.allergies      ? `Allergies : ${form.allergies}` : '',
    form?.alimentsEvites ? `Aliments \u00e9vit\u00e9s : ${form.alimentsEvites}` : '',
    form?.pathologies    ? `Pathologies : ${form.pathologies}` : '',
  ].filter(Boolean).join('\n');
}

// Optimise UNE section \u2014 retourne { improvedContent, changes[] }
export async function optimizeSection(form, sectionTitle, currentContent, analysisIssues = []) {
  const context = buildClientContext(form);
  const issuesHint = analysisIssues.length > 0
    ? `\n\nProbl\u00e8mes identifi\u00e9s \u00e0 corriger :\n${analysisIssues.map(i => `- ${i}`).join('\n')}`
    : '';

  const system = `${ANISSA_IDENTITY_CORE}

CONTEXTE : Tu optimises une seule partie du plan.
Objectif : ameliorer sans impacter le reste du plan.

${ADJUSTMENT_RULE}

REGLES D'OPTIMISATION :
- Ne pas impacter le reste du plan
- Ameliorer sans complexifier
- Reste concis \u2014 am\u00e9liore sans rallonger de plus de 30%

PROFIL CLIENT :
${context}

R\u00c8GLES DE SORTIE :
- Retourne UNIQUEMENT un JSON valide, sans markdown
- Format : { "content": "...", "changes": ["changement 1", "changement 2"] }
- "content" : le contenu am\u00e9lior\u00e9 de la section
- "changes" : liste de 1 \u00e0 4 am\u00e9liorations pr\u00e9cises apport\u00e9es
- M\u00eame format que l'original (listes si listes)
- Ajoute calories/macros si manquants
- Corrige les incoh\u00e9rences avec le profil client

R\u00c8GLES D'\u00c9CRITURE :
- JAMAIS de formulations molles : 'id\u00e9alement', 'n'h\u00e9sitez pas', 'il est conseill\u00e9', 'vous pourriez', 'il est important de', 'en effet', 'force est de constater'
- JAMAIS de markdown dans le contenu : pas de **gras**, pas de # titres
- JAMAIS de m\u00e9ta-commentaires : pas de 'cette approche', 'ce protocole', 'en conclusion', 'pour r\u00e9sumer'
- Phrases directes, courtes, actionnables
- Tutoiement, chaleureux mais expert

EXEMPLES DE STYLE :
\u274c "Id\u00e9alement, il est conseill\u00e9 de consommer des l\u00e9gumes verts"
\u2705 "200g de l\u00e9gumes verts \u00e0 chaque repas"
\u274c "N'h\u00e9sitez pas \u00e0 int\u00e9grer des sources de prot\u00e9ines"
\u2705 "Ajoute 25g de prot\u00e9ines \u00e0 chaque repas : poulet, poisson, \u0153ufs ou l\u00e9gumineuses"${issuesHint}`;

  const text = await aiRequest(
    system,
    `Section "${sectionTitle}" \u00e0 optimiser :\n\n${currentContent}`,
    1000
  );

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      improvedContent: postProcess(parsed.content || currentContent),
      changes: parsed.changes || [],
    };
  } catch {
    return { improvedContent: postProcess(text || currentContent), changes: ['Section optimis\u00e9e'] };
  }
}

// Optimise TOUTES les sections \u2014 retourne section par section
export async function optimizeAllSections(form, sections, analysisIssues = []) {
  const results = [];
  for (const section of sections) {
    if (!section.content?.trim()) {
      results.push({ id: section.id, title: section.title,
        original: '', improved: '', changes: [], skip: true });
      continue;
    }
    try {
      const { improvedContent, changes } = await optimizeSection(
        form, section.title, section.content, analysisIssues
      );
      results.push({
        id: section.id,
        title: section.title,
        original: section.content,
        improved: improvedContent,
        changes,
        skip: false,
      });
    } catch (err) {
      results.push({ id: section.id, title: section.title,
        original: section.content, improved: section.content,
        changes: [], skip: true, error: err.message });
    }
  }
  return results;
}

export async function adaptPlanFromReview(form, currentPlan, review, analysis) {
  const context = [
    form?.prenom         ? `Client : ${form.prenom}` : '',
    form?.age            ? `Âge : ${form.age} ans` : '',
    form?.genre          ? `Genre : ${form.genre}` : '',
    form?.poids          ? `Poids : ${form.poids} kg` : '',
    form?.objectifPrincipalNutrition
                         ? `Objectif : ${form.objectifPrincipalNutrition}` : '',
    form?.symptomesObjectifs?.length
                         ? `Symptômes : ${form.symptomesObjectifs.join(', ')}` : '',
    form?.allergies      ? `Allergies : ${form.allergies}` : '',
    form?.alimentsEvites ? `Aliments évités : ${form.alimentsEvites}` : '',
    form?.pathologies    ? `Pathologies : ${form.pathologies}` : '',
  ].filter(Boolean).join('\n');

  // Construire les directives depuis le bilan
  const directives = [];

  // Adhérence faible → simplifier
  if (review.adherence === '<50' || review.adherence === '50') {
    directives.push('SIMPLIFIER : réduire le nombre de préparations, privilégier des repas rapides (<15 min)');
  }

  // Motivation / monotonie → varier
  if (review.main_issue === 'motivation' || review.main_issue === 'taste') {
    directives.push('VARIER : introduire 2-3 nouvelles recettes, rotation des sources de protéines et légumes');
  }

  // Faim → revoir satiété
  if (review.main_issue === 'hunger') {
    directives.push('SATIÉTÉ : augmenter les fibres et protéines aux repas, ajouter une collation protéinée');
  }

  // Organisation compliquée → simplifier structure
  if (review.organisation === 'complex' || review.difficulty === 'hard') {
    directives.push('SIMPLIFIER STRUCTURE : réduire à 3 repas principaux, limiter les préparations spéciales');
  }

  // Énergie basse → ajuster glucides/timing
  if (review.energy === 'low') {
    directives.push('ÉNERGIE : revoir le timing des glucides complexes, ajouter une collation l\'après-midi');
  }

  // Digestion difficile → alléger
  if (review.digestion === 'bad') {
    directives.push('DIGESTION : réduire les aliments fermentescibles, privilégier les cuissons douces');
  }

  // Stagnation → recalibrer
  if (review.progress === 'none') {
    directives.push('RECALIBRER : revoir les portions, introduire un déficit calorique progressif si perte de poids visée');
  }

  // Intégrer les recommandations IA si disponibles
  if (analysis?.recommandations?.length > 0) {
    directives.push(...analysis.recommandations.map(r => `APPLIQUER : ${r}`));
  }

  const directivesText = directives.length > 0
    ? directives.join('\n')
    : 'Améliorer globalement la qualité et la personnalisation du plan';

  const system = `${ANISSA_IDENTITY_CORE}

CONTEXTE : Ceci est une consultation de mi-parcours apres 4 semaines.
Objectif : corriger la trajectoire sans repartir de zero.

${ADJUSTMENT_RULE}

REGLES CRITIQUES DE MI-PARCOURS :
- Ne jamais refaire un programme complet
- Modifier seulement ce qui bloque
- Garder ce qui fonctionne
- Simplifier si adherence faible
- Maximum 30% de changement par rapport au plan initial

PROFIL CLIENT :
${context}

DIRECTIVES D'ADAPTATION (basées sur le bilan) :
${directivesText}

RÈGLES D'ÉCRITURE :
- Garder la structure existante (mêmes titres de sections)
- Appliquer les directives section par section
- Pas de **gras**, pas de # titres markdown
- Pas de "idéalement", "n'hésitez pas", "il est conseillé", "il est important de"
- Pas de "cette approche", "ce protocole", "en conclusion", "pour résumer"
- Pas de listes à 3 éléments parfaitement parallèles (signe d'IA)
- Phrases courtes et directes. Quantités précises.
- Tutoiement, chaleureux mais expert
- Varie la longueur des phrases
- Retourner UNIQUEMENT le plan adapté, sans introduction ni explication

EXEMPLE DE STYLE ATTENDU :
❌ "Il est recommandé d'augmenter progressivement l'apport en protéines pour optimiser la satiété."
✅ "Ajouter 30g de protéines au déjeuner. Œuf, poulet, sardines — au choix."

❌ "Cette approche permettra de réduire la monotonie alimentaire tout en maintenant l'équilibre nutritionnel."
✅ "Changer au moins 2 recettes par semaine. La routine tue la motivation."`;

  const text = await aiRequest(
    system,
    `Plan actuel à adapter :\n\n${(currentPlan || '').slice(0, 4000)}\n\nAdapte ce plan selon les directives.`,
    3000
  );

  return postProcess(text);
}

export async function adaptPlanForReturn(form, lastPlan, diagnostic) {
  const context = [
    form?.prenom         ? `Client : ${form.prenom}` : '',
    form?.age            ? `Âge : ${form.age} ans` : '',
    form?.poids          ? `Poids actuel : ${form.poids} kg` : '',
    form?.objectifPrincipalNutrition
                         ? `Objectif : ${form.objectifPrincipalNutrition}` : '',
    form?.allergies      ? `Allergies : ${form.allergies}` : '',
    form?.pathologies    ? `Pathologies : ${form.pathologies}` : '',
  ].filter(Boolean).join('\n');

  const profileDirectives = {
    simplify:
      'REPRISE APRÈS ABANDON : plan ultra-simple. 3 repas max, 0 préparation complexe. ' +
      '1 seul objectif prioritaire. Recettes rapides (<15 min). Pas de suppléments complexes au départ.',
    recalibrate:
      'REPRISE APRÈS STAGNATION : changer complètement la stratégie. ' +
      'Revoir la répartition des macros. Introduire un jour de charge si perte de poids. ' +
      'Nouvelles recettes, nouveau timing des repas.',
    stabilize:
      'REPRISE APRÈS PERTE DE POIDS : phase de stabilisation 2 semaines. ' +
      'Augmenter légèrement les glucides complexes. Maintenir les acquis. ' +
      'Réintroduire progressivement les aliments restreints.',
    metabolic:
      'AJUSTEMENT MÉTABOLIQUE : recalibrer les apports. ' +
      'Probable adaptation — réduire le déficit, augmenter la variété. ' +
      'Introduire des cycles caloriques sur la semaine.',
    standard:
      'REPRISE STANDARD : partir des acquis du cycle précédent. ' +
      'Garder ce qui fonctionnait, améliorer ce qui bloquait.',
  };

  const directive = profileDirectives[diagnostic.returnProfile] || profileDirectives.standard;

  const whatWorkedText = diagnostic.whatWorked.length > 0
    ? `Ce qui a fonctionné : ${diagnostic.whatWorked.join(', ')}`
    : '';
  const whatFailedText = diagnostic.whatFailed.length > 0
    ? `Ce qui n'a pas fonctionné : ${diagnostic.whatFailed.join(', ')}`
    : '';

  const weightContext = diagnostic.weightAnalysis
    ? [
        `Poids de départ : ${diagnostic.weightAnalysis.start} kg`,
        `Poids actuel estimé : ${diagnostic.weightAnalysis.end} kg`,
        diagnostic.weightAnalysis.totalLoss !== 0
          ? `Évolution : ${diagnostic.weightAnalysis.totalLoss > 0
              ? `-${diagnostic.weightAnalysis.totalLoss} kg perdu`
              : `+${Math.abs(diagnostic.weightAnalysis.totalLoss)} kg repris`}`
          : '',
        diagnostic.weightAnalysis.hasRebound
          ? `Reprise après plateau : +${diagnostic.weightAnalysis.reboundFromTrough} kg`
          : '',
        diagnostic.weightAnalysis.isStagnant
          ? 'Stagnation pondérale observée sur plusieurs mesures'
          : '',
      ].filter(Boolean).join('\n')
    : '';

  const ingredientContext = (() => {
    const fi = diagnostic.favoriteIngredients;
    if (!fi) return '';
    const parts = [];
    if (fi.favoriteProteins?.length > 0) {
      parts.push(`Protéines appréciées : ${fi.favoriteProteins.join(', ')}`);
    }
    if (fi.favoriteVeggies?.length > 0) {
      parts.push(`Légumes appréciés : ${fi.favoriteVeggies.join(', ')}`);
    }
    return parts.length > 0
      ? `ALIMENTS À CONSERVER (appréciés sur les cycles précédents) :\n${parts.join('\n')}\nPrivilégier ces aliments dans le plan de reprise.`
      : '';
  })();

  const system = `${ANISSA_IDENTITY_CORE}

CONTEXTE : Le client revient apres une pause de ${diagnostic.daysSinceLastConsult} jours.
Objectif : relancer sans pression et reconstruire une dynamique.

${ADJUSTMENT_RULE}

REGLES DE REPRISE :
- Simplifier fortement si abandon
- Eviter toute culpabilisation
- Redonner des victoires rapides les 2 premieres semaines
- Partir des acquis du cycle precedent quand possible

PROFIL CLIENT :
${context}

HISTORIQUE :
${whatWorkedText}
${whatFailedText}
Recommandation : ${diagnostic.recommendation}
${weightContext ? `\nCOURBE POIDS :\n${weightContext}` : ''}
${diagnostic.cycleContext ? `\nCONTEXTE CYCLES : ${diagnostic.cycleContext}` : ''}
${ingredientContext ? `\n${ingredientContext}` : ''}

DIRECTIVE PRINCIPALE :
${directive}

RÈGLES D'ÉCRITURE :
- Pas de **gras**, pas de # titres markdown
- Pas de "idéalement", "n'hésitez pas", "il est conseillé"
- Phrases directes et courtes. Quantités précises.
- Tutoiement, chaleureux mais expert
- Varie la longueur des phrases — certaines très courtes

EXEMPLE :
❌ "Il est recommandé d'augmenter progressivement les protéines."
✅ "Ajouter 30g de protéines au déjeuner. Œuf, poulet ou sardines."`;

  const text = await aiRequest(
    system,
    lastPlan?.trim()
      ? `Plan précédent (adapter pour la reprise) :\n\n${lastPlan.slice(0, 3000)}`
      : `Créer un plan de reprise complet pour ${form?.prenom || 'ce client'}.`,
    3000
  );

  return postProcess(text);
}
