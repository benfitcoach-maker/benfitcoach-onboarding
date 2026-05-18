// V97.26 (audit fix tests gap) — Tests aggregateObservability.
// Compute cote client, logique non testee = risque KPI faussee.

import { describe, it, expect } from 'vitest';
import { aggregateObservability } from '../planObservability';

describe('aggregateObservability', () => {
  it('Retourne stats vides si pas de rows', () => {
    const s = aggregateObservability([]);
    expect(s.total).toBe(0);
    expect(s.composerBetaRatio).toBe(0);
    expect(s.avgViolations).toBe(0);
    expect(s.avgSlopFlags).toBe(0);
    expect(s.haikuAcceptRate).toBe(null);
    expect(s.haikuRequested).toBe(0);
    expect(s.generationsByWeek).toEqual([]);
    expect(s.topGuardrails).toEqual([]);
    expect(s.topMissingProfiles).toEqual([]);
    expect(s.topSlopCategories).toEqual([]);
  });

  it('Null safety si input invalide', () => {
    expect(aggregateObservability(null).total).toBe(0);
    expect(aggregateObservability(undefined).total).toBe(0);
  });

  it('Aggrege une seule generation correctement', () => {
    const rows = [{
      id: 'a',
      generated_at: '2026-05-18T10:00:00Z',
      composer_beta: true,
      guardrails_applied: ['grossesse'],
      violations_count: 2,
      slop_flags_count: 5,
      plan_length_chars: 1000,
      slop_rewrites_requested_count: 3,
      slop_rewrites_accepted_count: 2,
      slop_rewrites_refused_count: 1,
      missing_micronutrients_count: 1,
      missing_evictions_count: 0,
      slop_flags_by_category: { ai_vocab: 3, cliche: 2 },
      slop_flags_by_severity: { high: 2, medium: 2, low: 1 },
    }];
    const s = aggregateObservability(rows);
    expect(s.total).toBe(1);
    expect(s.composerBetaRatio).toBe(1);
    expect(s.avgViolations).toBe(2);
    expect(s.avgSlopFlags).toBe(5);
    expect(s.avgPlanLength).toBe(1000);
    expect(s.haikuRequested).toBe(3);
    expect(s.haikuAccepted).toBe(2);
    expect(s.haikuRefused).toBe(1);
    expect(s.haikuAcceptRate).toBeCloseTo(2 / 3, 5);
    expect(s.topGuardrails[0]).toEqual({ profile_key: 'grossesse', count: 1 });
    expect(s.topSlopCategories).toEqual(expect.arrayContaining([
      { category: 'ai_vocab', count: 3 },
      { category: 'cliche', count: 2 },
    ]));
  });

  it('Compte composerBetaRatio sur N rows', () => {
    const rows = [
      { generated_at: '2026-05-18T10:00:00Z', composer_beta: true, guardrails_applied: [] },
      { generated_at: '2026-05-18T10:00:00Z', composer_beta: false, guardrails_applied: [] },
      { generated_at: '2026-05-18T10:00:00Z', composer_beta: true, guardrails_applied: [] },
    ];
    const s = aggregateObservability(rows);
    expect(s.composerBetaRatio).toBeCloseTo(2 / 3, 5);
  });

  it('Groupe par semaine ISO (lundi UTC midi-safe)', () => {
    // 2026-05-18 = lundi, 2026-05-19 = mardi : meme semaine.
    // 2026-05-26 = lundi suivant.
    const rows = [
      { generated_at: '2026-05-18T08:00:00Z', composer_beta: false, guardrails_applied: [] },
      { generated_at: '2026-05-19T14:00:00Z', composer_beta: false, guardrails_applied: [] },
      { generated_at: '2026-05-26T10:00:00Z', composer_beta: false, guardrails_applied: [] },
    ];
    const s = aggregateObservability(rows);
    expect(s.generationsByWeek).toHaveLength(2);
    expect(s.generationsByWeek[0].count).toBe(2); // semaine 18-24
    expect(s.generationsByWeek[1].count).toBe(1); // semaine 25-31
  });

  it('Top guardrails counts cumules sur N rows', () => {
    const rows = [
      { generated_at: '2026-05-18T10:00:00Z', composer_beta: false, guardrails_applied: ['grossesse', 'diabete'] },
      { generated_at: '2026-05-18T10:00:00Z', composer_beta: false, guardrails_applied: ['grossesse'] },
      { generated_at: '2026-05-18T10:00:00Z', composer_beta: false, guardrails_applied: ['menopause'] },
    ];
    const s = aggregateObservability(rows);
    expect(s.topGuardrails[0]).toEqual({ profile_key: 'grossesse', count: 2 });
    // Order : grossesse 2, diabete 1, menopause 1 (les 2 derniers indeterministes — verifier presence)
    const keys = s.topGuardrails.map((g) => g.profile_key);
    expect(keys).toContain('diabete');
    expect(keys).toContain('menopause');
  });

  it('topMissingProfiles cumule seulement si missing > 0', () => {
    const rows = [
      // Pas de missing → pas dans topMissingProfiles
      { generated_at: '2026-05-18T10:00:00Z', composer_beta: false, guardrails_applied: ['grossesse'],
        missing_micronutrients_count: 0, missing_evictions_count: 0 },
      // Missing → compte
      { generated_at: '2026-05-18T10:00:00Z', composer_beta: false, guardrails_applied: ['grossesse'],
        missing_micronutrients_count: 2, missing_evictions_count: 1 },
    ];
    const s = aggregateObservability(rows);
    expect(s.topMissingProfiles).toHaveLength(1);
    expect(s.topMissingProfiles[0].profile_key).toBe('grossesse');
    expect(s.topMissingProfiles[0].gens).toBe(1);
    expect(s.topMissingProfiles[0].avgMissing).toBe(3);
  });

  it('haikuAcceptRate null si pas de demande', () => {
    const rows = [
      { generated_at: '2026-05-18T10:00:00Z', composer_beta: false, guardrails_applied: [],
        slop_rewrites_requested_count: 0, slop_rewrites_accepted_count: 0 },
    ];
    const s = aggregateObservability(rows);
    expect(s.haikuAcceptRate).toBe(null);
  });
});
