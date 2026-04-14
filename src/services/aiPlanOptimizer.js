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

  const system = `Tu es Anissa, nutritionniste experte.
Tu optimises une section d'un plan nutritionnel personnalis\u00e9.

PROFIL CLIENT :
${context}

R\u00c8GLES :
- Retourne UNIQUEMENT un JSON valide, sans markdown
- Format : { "content": "...", "changes": ["changement 1", "changement 2"] }
- "content" : le contenu am\u00e9lior\u00e9 de la section
- "changes" : liste de 1 \u00e0 4 am\u00e9liorations pr\u00e9cises apport\u00e9es
- M\u00eame format que l'original (listes si listes)
- Ajoute calories/macros si manquants
- Corrige les incoh\u00e9rences avec le profil client
- Reste concis \u2014 am\u00e9liore sans rallonger de plus de 30%

R\u00c8GLES D'\u00c9CRITURE ABSOLUES :
- JAMAIS de formulations molles : 'id\u00e9alement', 'n'h\u00e9sitez pas', 'il est conseill\u00e9', 'vous pourriez', 'il est important de', 'en effet', 'force est de constater'
- JAMAIS de markdown dans le contenu : pas de **gras**, pas de # titres
- JAMAIS de m\u00e9ta-commentaires : pas de 'cette approche', 'ce protocole', 'en conclusion', 'pour r\u00e9sumer'
- Phrases directes, courtes, actionnables
- Ton : comme une nutritionniste qui parle \u00e0 son client en face-\u00e0-face

EXEMPLES DE STYLE :
\u274c "Id\u00e9alement, il est conseill\u00e9 de consommer des l\u00e9gumes verts"
\u2705 "Consommez 200g de l\u00e9gumes verts \u00e0 chaque repas"
\u274c "N'h\u00e9sitez pas \u00e0 int\u00e9grer des sources de prot\u00e9ines"
\u2705 "Ajoutez 25g de prot\u00e9ines \u00e0 chaque repas : poulet, poisson, \u0153ufs ou l\u00e9gumineuses"${issuesHint}`;

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
