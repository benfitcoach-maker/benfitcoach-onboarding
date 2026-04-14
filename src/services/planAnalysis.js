// Dérive des suggestions actionnables depuis les penalties du score
export function buildSuggestions(score, sections) {
  if (!score) return [];
  const suggestions = [];

  // Depuis les penalties
  for (const p of score.penalties || []) {
    if (/calories non mentionn/i.test(p)) {
      suggestions.push({
        id: 'calories',
        label: '\ud83d\udcca Ajouter les calories',
        action: 'actionnable',
        targetSection: findSectionTitle(sections, /plan alimentaire|repas|journ\u00e9e/i),
        priority: 'high',
      });
    }
    if (/macros non/i.test(p)) {
      suggestions.push({
        id: 'macros',
        label: '\ud83e\udd69 D\u00e9tailler les macros',
        action: 'actionnable',
        targetSection: findSectionTitle(sections, /plan alimentaire|repas|nutrition/i),
        priority: 'high',
      });
    }
    if (/formulations molles/i.test(p)) {
      suggestions.push({
        id: 'tone',
        label: '\ud83d\udcbc Reformuler en directives claires',
        action: 'rewrite',
        targetSection: null, // toutes les sections
        priority: 'medium',
      });
    }
    if (/trop.*supplements/i.test(p)) {
      suggestions.push({
        id: 'supplements',
        label: '\ud83d\udc8a R\u00e9duire et prioriser les suppl\u00e9ments',
        action: 'simplify',
        targetSection: findSectionTitle(sections, /suppl/i),
        priority: 'medium',
      });
    }
    if (/plan trop long/i.test(p)) {
      suggestions.push({
        id: 'length',
        label: '\u2702\ufe0f Simplifier le plan',
        action: 'simplify',
        targetSection: null,
        priority: 'medium',
      });
    }
  }

  // Depuis le score bas par axe
  if ((score.applicability || 10) < 7) {
    suggestions.push({
      id: 'applicability',
      label: '\u26a1 Rendre plus actionnable',
      action: 'actionnable',
      targetSection: findSectionTitle(sections, /plan alimentaire|repas/i),
      priority: 'medium',
    });
  }
  if ((score.coherence || 10) < 7) {
    suggestions.push({
      id: 'coherence',
      label: '\ud83c\udfaf Adapter au profil client',
      action: 'adapt',
      targetSection: null,
      priority: 'high',
    });
  }

  // D\u00e9dupliquer et limiter \u00e0 4
  const seen = new Set();
  return suggestions
    .filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; })
    .sort((a, b) => (a.priority === 'high' ? -1 : 1))
    .slice(0, 4);
}

function findSectionTitle(sections, regex) {
  if (!sections || !sections.length) return null;
  const found = sections.find(s => regex.test(s.title));
  return found ? found.id : null;
}

// Score normalis\u00e9 en couleur
export function getScoreColor(normalized) {
  if (normalized >= 8) return '#4ade80';
  if (normalized >= 6) return '#fbbf24';
  return '#f87171';
}

export function getScoreLabel(normalized) {
  if (normalized >= 8) return 'Excellent';
  if (normalized >= 6) return 'Correct';
  if (normalized >= 4) return '\u00c0 am\u00e9liorer';
  return 'Insuffisant';
}
