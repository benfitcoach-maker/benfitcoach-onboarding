// V97.17 — Tests protocolPhases.js
// Suite minimale qui couvre les chemins critiques avant deploy :
//   - 4 templates exposes correctement
//   - suggestTemplateFromAnalyses : 4 branches (microbiome / sang / multi / vide)
//   - instanceFromTemplate : structure valide
//   - startParcours / transitionToNextPhase : transitions OK
//   - isValidProtocolPhases : guards de base

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ALL_TEMPLATES,
  TEMPLATE_MICROBIOTE_5,
  TEMPLATE_MICROBIOTE_3,
  TEMPLATE_NUTRITION_2,
  TEMPLATE_CUSTOM,
  suggestTemplateFromAnalyses,
  instanceFromTemplate,
  getActivePhase,
  suggestNextPhase,
  transitionToNextPhase,
  startParcours,
  isValidProtocolPhases,
  preloadPhaseRecommendationsFromSupabase,
  getLivePhaseRecommendations,
  getPhaseRecoSource,
  _resetPhaseRecoCache,
} from '../protocolPhases';

describe('ALL_TEMPLATES', () => {
  it('expose les 4 templates attendus', () => {
    expect(Object.keys(ALL_TEMPLATES)).toEqual([
      'microbiote_5_phases',
      'microbiote_3_phases',
      'nutrition_simple_2_phases',
      'custom',
    ]);
  });

  it('Microbiote 5 phases a exactement 5 phases nommees cote cliente', () => {
    expect(TEMPLATE_MICROBIOTE_5.phases).toHaveLength(5);
    const clientNames = TEMPLATE_MICROBIOTE_5.phases.map((p) => p.client_name);
    expect(clientNames).toEqual([
      'Apaisement digestif',
      'Rééquilibrage intestinal',
      'Réparation profonde',
      'Consolidation',
      'Stabilisation long terme',
    ]);
  });

  it('Phases ont les 3 tons narratifs (manifeste regle 5)', () => {
    for (const p of TEMPLATE_MICROBIOTE_5.phases) {
      expect(p.narrative_present).toBeTruthy();
      expect(p.narrative_past).toBeTruthy();
      expect(p.narrative_future).toBeTruthy();
    }
  });

  it('Microbiote 3 phases + Nutrition 2 phases + Custom ont structures attendues', () => {
    expect(TEMPLATE_MICROBIOTE_3.phases).toHaveLength(3);
    expect(TEMPLATE_NUTRITION_2.phases).toHaveLength(2);
    expect(TEMPLATE_CUSTOM.phases).toHaveLength(0);
  });

  it('Phase 5 stabilisation a duration_weeks_max = 0 (ouvert)', () => {
    const last = TEMPLATE_MICROBIOTE_5.phases[4];
    expect(last.duration_weeks_max).toBe(0);
  });
});

describe('suggestTemplateFromAnalyses', () => {
  it('Microbiome NGS detecte → microbiote_5_phases', () => {
    const client = { analysisPlan: { items: [{ name: 'Microbiome NGS' }] } };
    const s = suggestTemplateFromAnalyses(client);
    expect(s.templateId).toBe('microbiote_5_phases');
  });

  it('Bilan sanguin seul → nutrition_simple_2_phases', () => {
    const client = { analyses: ['Bilan sanguin complet'] };
    const s = suggestTemplateFromAnalyses(client);
    expect(s.templateId).toBe('nutrition_simple_2_phases');
  });

  it('Multi-analyses avec microbiome → microbiote_5_phases (microbiome prime)', () => {
    const client = {
      analyses: ['Bilan sanguin', 'Microbiome NGS', 'Genetique'],
    };
    const s = suggestTemplateFromAnalyses(client);
    expect(s.templateId).toBe('microbiote_5_phases');
  });

  it('Aucune analyse → microbiote_5_phases (fallback V97.17.5.1)', () => {
    // V97.17.5.1 : custom etait suggere mais avait phases: [] → crashait
    // la timeline a l'init. Fallback sur microbiote 5 phases comme template
    // le plus complet par defaut. Anissa peut toujours choisir custom
    // manuellement via "Choisir un autre" (a debloquer V97.17.6).
    const s = suggestTemplateFromAnalyses({});
    expect(s.templateId).toBe('microbiote_5_phases');
  });

  it('Mot clef "sequencage" detecte aussi le microbiome', () => {
    const client = { form: { analyses: ['Sequencage 16S'] } };
    const s = suggestTemplateFromAnalyses(client);
    expect(s.templateId).toBe('microbiote_5_phases');
  });
});

describe('instanceFromTemplate', () => {
  it('Cree une instance avec toutes phases en upcoming', () => {
    const inst = instanceFromTemplate('microbiote_5_phases');
    expect(inst.template).toBe('microbiote_5_phases');
    expect(inst.phases).toHaveLength(5);
    expect(inst.phases.every((p) => p.status === 'upcoming')).toBe(true);
    expect(inst.phases.every((p) => p.started_at === null)).toBe(true);
  });

  it('Throw si template inconnu', () => {
    expect(() => instanceFromTemplate('inconnu')).toThrow();
  });
});

describe('startParcours + transitionToNextPhase', () => {
  it('startParcours active la phase 1', () => {
    const inst = instanceFromTemplate('microbiote_3_phases');
    const started = startParcours(inst);
    expect(started.phases[0].status).toBe('active');
    expect(started.phases[0].started_at).toBeTruthy();
    expect(started.phases[1].status).toBe('upcoming');
  });

  it('startParcours throw si une phase est deja active', () => {
    const inst = instanceFromTemplate('microbiote_3_phases');
    const started = startParcours(inst);
    expect(() => startParcours(started)).toThrow();
  });

  it('transitionToNextPhase termine la courante et active la suivante', () => {
    const inst = instanceFromTemplate('microbiote_3_phases');
    const started = startParcours(inst);
    const next = transitionToNextPhase(started);
    expect(next.phases[0].status).toBe('completed');
    expect(next.phases[0].completed_at).toBeTruthy();
    expect(next.phases[1].status).toBe('active');
    expect(next.phases[1].started_at).toBeTruthy();
  });

  it('transitionToNextPhase throw apres la derniere phase', () => {
    const inst = instanceFromTemplate('nutrition_simple_2_phases');
    let cur = startParcours(inst);
    cur = transitionToNextPhase(cur); // active phase 2
    expect(() => transitionToNextPhase(cur)).toThrow();
  });
});

describe('getActivePhase + suggestNextPhase', () => {
  it('getActivePhase retourne null si rien actif', () => {
    const inst = instanceFromTemplate('microbiote_3_phases');
    expect(getActivePhase(inst)).toBeNull();
  });

  it('getActivePhase retourne la phase active apres start', () => {
    const inst = instanceFromTemplate('microbiote_3_phases');
    const started = startParcours(inst);
    const active = getActivePhase(started);
    expect(active?.order).toBe(1);
  });

  it('suggestNextPhase ne suggere PAS si duree min pas atteinte', () => {
    const inst = instanceFromTemplate('microbiote_5_phases');
    const started = startParcours(inst);
    // Phase 1 demarree maintenant → semaine 1, min 4 → pas de suggestion
    const s = suggestNextPhase(started);
    expect(s.shouldSuggest).toBe(false);
  });

  it('suggestNextPhase suggere si duree min atteinte', () => {
    const inst = instanceFromTemplate('microbiote_5_phases');
    // Forcer started_at il y a 5 semaines
    const fiveWeeksAgo = new Date(Date.now() - 5 * 7 * 86400000).toISOString();
    inst.phases[0].status = 'active';
    inst.phases[0].started_at = fiveWeeksAgo;
    const s = suggestNextPhase(inst);
    expect(s.shouldSuggest).toBe(true);
    expect(s.nextPhaseId).toBe('p2');
  });

  it('suggestNextPhase ne suggere PAS sur phase ouverte (duration_weeks_min = 0)', () => {
    const inst = instanceFromTemplate('microbiote_5_phases');
    // Active la phase 5 (stabilisation, ouverte)
    inst.phases[4].status = 'active';
    inst.phases[4].started_at = new Date().toISOString();
    const s = suggestNextPhase(inst);
    expect(s.shouldSuggest).toBe(false);
  });
});

describe('isValidProtocolPhases', () => {
  it('Valide une instance fraiche', () => {
    const inst = instanceFromTemplate('microbiote_5_phases');
    expect(isValidProtocolPhases(inst)).toBe(true);
  });

  it('Invalide si plusieurs phases actives', () => {
    const inst = instanceFromTemplate('microbiote_5_phases');
    inst.phases[0].status = 'active';
    inst.phases[1].status = 'active';
    expect(isValidProtocolPhases(inst)).toBe(false);
  });

  it('Invalide si status inconnu', () => {
    const inst = instanceFromTemplate('microbiote_5_phases');
    inst.phases[0].status = 'skipped';
    expect(isValidProtocolPhases(inst)).toBe(false);
  });

  it('Invalide si null/undefined/format casse', () => {
    expect(isValidProtocolPhases(null)).toBe(false);
    expect(isValidProtocolPhases(undefined)).toBe(false);
    expect(isValidProtocolPhases({})).toBe(false);
    expect(isValidProtocolPhases({ template: 'x' })).toBe(false);
  });
});

// ─── V97.22.2 — preloadPhaseRecommendationsFromSupabase + cache DB ───────

describe('preloadPhaseRecommendationsFromSupabase', () => {
  beforeEach(() => {
    _resetPhaseRecoCache();
  });

  it('Pas de supabase client → fallback hardcode', async () => {
    const res = await preloadPhaseRecommendationsFromSupabase(null);
    expect(res.ok).toBe(false);
    expect(res.source).toBe('hardcode');
    expect(getPhaseRecoSource()).toBe('hardcode');
  });

  it('DB erreur → fallback hardcode', async () => {
    const fakeSupabase = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
        }),
      }),
    };
    const res = await preloadPhaseRecommendationsFromSupabase(fakeSupabase);
    expect(res.ok).toBe(false);
    expect(res.source).toBe('hardcode');
  });

  it('Table vide → fallback hardcode', async () => {
    const fakeSupabase = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    };
    const res = await preloadPhaseRecommendationsFromSupabase(fakeSupabase);
    expect(res.ok).toBe(false);
    expect(getPhaseRecoSource()).toBe('hardcode');
  });

  it('Cache les phases et getLive les utilise', async () => {
    const fakeSupabase = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({
            data: [{
              template_key: 'microbiote_5_phases',
              phase_id: 'p1',
              phase_order: 1,
              client_name: 'Apaisement DB',
              clinical_name: 'Eradication DB',
              foods_favor: ['kiwi DB'],
              foods_limit: ['cafe DB'],
              cooking: ['vapeur DB'],
              cooking_avoid: ['grille DB'],
              supplements: [{ name: 'X DB', dose: '5g', timing: 'matin' }],
              clinical_notes: 'Notes DB',
              enabled: true,
            }],
            error: null,
          }),
        }),
      }),
    };
    const res = await preloadPhaseRecommendationsFromSupabase(fakeSupabase);
    expect(res.ok).toBe(true);
    expect(res.source).toBe('supabase');
    expect(getPhaseRecoSource()).toBe('supabase');

    const reco = getLivePhaseRecommendations('microbiote_5_phases', 'p1');
    expect(reco.source).toBe('supabase');
    expect(reco.client_name).toBe('Apaisement DB');
    expect(reco.foods_favor).toContain('kiwi DB');
  });

  it('getLive avec phase non en DB → fallback hardcode pour cette phase', async () => {
    // DB contient p1 mais pas p2 → getLive('p2') retombe sur hardcode
    const fakeSupabase = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({
            data: [{
              template_key: 'microbiote_5_phases',
              phase_id: 'p1',
              phase_order: 1,
              client_name: 'Apaisement DB',
              clinical_name: 'Eradication DB',
              foods_favor: ['DB'],
              foods_limit: [], cooking: [], cooking_avoid: [],
              supplements: [], clinical_notes: '', enabled: true,
            }],
            error: null,
          }),
        }),
      }),
    };
    await preloadPhaseRecommendationsFromSupabase(fakeSupabase);
    const p2 = getLivePhaseRecommendations('microbiote_5_phases', 'p2');
    expect(p2.source).toBe('hardcode');
    // p2 = Reequilibrage dans le hardcode JS
    expect(p2.clinical_name).toBe('Restitution');
  });

  it('getLive avec template inexistant → null', () => {
    _resetPhaseRecoCache();
    const reco = getLivePhaseRecommendations('inexistant', 'p1');
    expect(reco).toBe(null);
  });

  it('Reset cache fait retomber sur hardcode', async () => {
    const fakeSupabase = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({
            data: [{
              template_key: 'microbiote_5_phases', phase_id: 'p1', phase_order: 1,
              client_name: 'DB', clinical_name: 'DB',
              foods_favor: ['DB'], foods_limit: [], cooking: [], cooking_avoid: [],
              supplements: [], clinical_notes: '', enabled: true,
            }],
            error: null,
          }),
        }),
      }),
    };
    await preloadPhaseRecommendationsFromSupabase(fakeSupabase);
    expect(getPhaseRecoSource()).toBe('supabase');
    _resetPhaseRecoCache();
    expect(getPhaseRecoSource()).toBe('hardcode');
    const reco = getLivePhaseRecommendations('microbiote_5_phases', 'p1');
    expect(reco.source).toBe('hardcode');
    expect(reco.client_name).toBe('Apaisement digestif'); // hardcode
  });
});
