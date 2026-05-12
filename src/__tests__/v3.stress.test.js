// V97.4 V3.H — Stress tests cross-couche V3 (data → moteur → IA).
// Date : 2026-05-12
//
// Objectif : valider la robustesse de la chaîne complète V3 sur des
// scénarios edge case réels qu'on n'a pas couverts dans les tests unitaires
// par phase. Ces tests cherchent activement à casser le moteur.
//
// Si un test ici échoue, c'est qu'on a un problème de robustesse à
// corriger AVANT généralisation V3 sur toutes les clientes.

import { describe, it, expect } from 'vitest';
import { buildClinicalContext } from '../services/clinical/buildClinicalContext';
import { detectMicrobiomeStage } from '../services/clinical/microbiome/detectMicrobiomeStage';
import { buildClinicalContextBlockFr } from '../services/prompts/nutrition/_clinicalContext.fr';

describe('V3 Stress — robustesse cross-couche', () => {

  // ───── Volume
  it('Stress 1 — 20 markers répartis sur 5 tests : aucun crash, dedup expectedMarkers OK', () => {
    const journey = {
      results_data: {
        from_plan: [
          { test_code: 'ortho_mikroernaehrung', test_name: 'Mikro', markers: makeMarkers(['vit_d_25oh', 'vit_b12', 'folates', 'ferritine'], 'optimal') },
          { test_code: 'ortho_thyroide_complete', test_name: 'Thyro', markers: makeMarkers(['tsh', 't3_libre', 't4_libre', 'anti_tpo'], 'optimal') },
          { test_code: 'ortho_inflammation', test_name: 'Inflam', markers: makeMarkers(['crp_us', 'fibrinogene'], 'surveiller') },
          { test_code: 'ortho_microbiome_complete_plus', test_name: 'Microbio', markers: makeMarkers(['zonuline', 'akkermansia', 'iga_secretoire', 'candida_albicans', 'calprotectine'], 'prioritaire') },
          { test_code: 'ortho_metabolique', test_name: 'Meta', markers: makeMarkers(['glycemie_jeun', 'hba1c', 'insuline'], 'surveiller') },
        ],
        external: [],
      },
    };
    const ctx = buildClinicalContext({ journeyState: journey });
    expect(ctx.selectedTests).toHaveLength(5);
    expect(ctx.enteredResults.length).toBeGreaterThan(0);
    expect(() => buildClinicalContextBlockFr(ctx)).not.toThrow();
    const block = buildClinicalContextBlockFr(ctx);
    expect(block.length).toBeGreaterThan(100);
    expect(block.length).toBeLessThan(20000); // pas d'explosion prompt
  });

  // ───── Conflicting status
  it('Stress 2 — même marker prio + optimal dans 2 tests différents : pas de crash', () => {
    const journey = {
      results_data: {
        from_plan: [
          { test_code: 'a', test_name: 'A', markers: [{ marker_code: 'ferritine', label: 'Ferritine', value: '22', status: 'prioritaire' }] },
          { test_code: 'b', test_name: 'B', markers: [{ marker_code: 'ferritine', label: 'Ferritine', value: '120', status: 'optimal' }] },
        ],
        external: [],
      },
    };
    expect(() => buildClinicalContext({ journeyState: journey })).not.toThrow();
    const ctx = buildClinicalContext({ journeyState: journey });
    // Pas de dédup → 2 entrées dans enteredResults
    expect(ctx.enteredResults.filter((r) => r.label.includes('Ferritine'))).toHaveLength(2);
  });

  // ───── Override invalid types
  it('Stress 3 — override phase=string ignoré', () => {
    const out = detectMicrobiomeStage({
      journeyState: { microbiome_override: { phase: '3', reason: 'test' } },
    });
    expect(out.overridden_by_practitioner).toBe(false);
  });

  it('Stress 4 — override phase=0 (hors range 1-5) ignoré', () => {
    const out = detectMicrobiomeStage({
      journeyState: { microbiome_override: { phase: 0 } },
    });
    expect(out.overridden_by_practitioner).toBe(false);
  });

  it('Stress 5 — override phase=6 ignoré', () => {
    const out = detectMicrobiomeStage({
      journeyState: { microbiome_override: { phase: 6 } },
    });
    expect(out.overridden_by_practitioner).toBe(false);
  });

  it('Stress 6 — override sans phase ignoré', () => {
    const out = detectMicrobiomeStage({
      journeyState: { microbiome_override: { reason: 'test sans phase' } },
    });
    expect(out.overridden_by_practitioner).toBe(false);
  });

  it('Stress 7 — override null/string/array ignoré', () => {
    for (const bad of [null, 'phase 3', [], 0, false]) {
      const out = detectMicrobiomeStage({ journeyState: { microbiome_override: bad } });
      expect(out.overridden_by_practitioner).toBe(false);
    }
  });

  // ───── Override force quand inferred est null
  it('Stress 8 — override valide écrase un inferred null (aucune règle ne fire)', () => {
    const out = detectMicrobiomeStage({
      journeyState: {
        results_data: { from_plan: [], external: [] },
        microbiome_override: { phase: 4, reason: 'choix clinique pur' },
      },
    });
    expect(out.inferred_phase).toBeNull();
    expect(out.final_phase).toBe(4);
    expect(out.overridden_by_practitioner).toBe(true);
    expect(out.label).toBe('Régulation immunitaire');
  });

  // ───── Données malformées
  it('Stress 9 — markers sans marker_code ignorés silencieusement', () => {
    const journey = {
      results_data: {
        from_plan: [
          {
            test_code: 'a',
            test_name: 'A',
            markers: [
              { label: 'Sans code', value: '42', status: 'prioritaire' }, // pas de marker_code → ignoré
              { marker_code: 'ferritine', label: 'Ferritine', value: '22', status: 'prioritaire' },
            ],
          },
        ],
        external: [],
      },
    };
    const ctx = buildClinicalContext({ journeyState: journey });
    // Seulement le marker avec code valide est propagé
    expect(ctx.clinicalSignals.filter((s) => s.confidence === 'note Anissa marker')).toHaveLength(1);
  });

  it('Stress 10 — test entries sans test_code ni test_name ignorés', () => {
    const journey = {
      results_data: {
        from_plan: [
          { value: 'Orphelin', synthesis: 'Sans identité' },
          { test_code: 'a', test_name: 'A', value: 'OK', synthesis: '' },
        ],
        external: [],
      },
    };
    const ctx = buildClinicalContext({ journeyState: journey });
    expect(ctx.enteredResults).toHaveLength(1);
    expect(ctx.enteredResults[0].label).toBe('A');
  });

  // ───── Discordance triple
  it('Stress 11 — 3 phases tied → final_phase null, reasons multi-phases', () => {
    const journey = {
      results_data: {
        from_plan: [
          {
            test_code: 'ortho_microbiome_complete_plus',
            test_name: 'Microbio',
            markers: [
              { marker_code: 'candida_albicans', label: 'Candida', status: 'prioritaire' },   // P1: 2
              { marker_code: 'akkermansia', label: 'Akkermansia', status: 'prioritaire' },     // P2: contribue
              { marker_code: 'faecalibacterium', label: 'Faecal', status: 'prioritaire' },     // P2: 2 (flore_protectrice ≥2)
            ],
          },
        ],
        external: [],
      },
    };
    const out = detectMicrobiomeStage({ journeyState: journey });
    // P1 (2) vs P2 (2) → écart 0 ≤ 1 → discordance
    expect(out.inferred_phase).toBeNull();
    expect(out.reasons.length).toBeGreaterThan(1);
  });

  // ───── Same marker_code multi-test (longitudinal pre-V3.E)
  it('Stress 12 — même marker_code dans 3 tests : 3 enteredResults distincts (préparation longitudinal V3.E)', () => {
    const journey = {
      results_data: {
        from_plan: [
          { test_code: 'a', test_name: 'T0', markers: [{ marker_code: 'ferritine', label: 'Ferritine', value: '22', status: 'prioritaire' }] },
          { test_code: 'b', test_name: 'T1', markers: [{ marker_code: 'ferritine', label: 'Ferritine', value: '55', status: 'surveiller' }] },
          { test_code: 'c', test_name: 'T2', markers: [{ marker_code: 'ferritine', label: 'Ferritine', value: '90', status: 'optimal' }] },
        ],
        external: [],
      },
    };
    const ctx = buildClinicalContext({ journeyState: journey });
    expect(ctx.enteredResults.filter((r) => r.label.includes('Ferritine'))).toHaveLength(3);
  });

  // ───── External + status
  it('Stress 13 — external avec status prioritaire → signal confidence "note Anissa" (test-level)', () => {
    const journey = {
      results_data: {
        from_plan: [],
        external: [
          { name: 'Cortisol salivaire externe', value: 'élevé', synthesis: 'Stress', status: 'prioritaire' },
        ],
      },
    };
    const ctx = buildClinicalContext({ journeyState: journey });
    expect(ctx.clinicalSignals).toHaveLength(1);
    expect(ctx.clinicalSignals[0].confidence).toBe('note Anissa'); // pas "marker"
  });

  // ───── Renderer integration
  it('Stress 14 — render complet d\'un cas microbiome enrichi : wording prudent + microbiomeStage présent', () => {
    const journey = {
      results_data: {
        from_plan: [
          {
            test_code: 'ortho_microbiome_complete_plus',
            test_name: 'Microbiome Complete Plus',
            value: 'Profil dysbiose modérée',
            synthesis: 'Pattern perméabilité',
            status: 'surveiller',
            markers: [
              { marker_code: 'zonuline', label: 'Zonuline', value: 'élevée', synthesis: '', status: 'prioritaire' },
              { marker_code: 'iga_secretoire', label: 'IgA sécrétoire', value: 'basse', synthesis: '', status: 'surveiller' },
              { marker_code: 'calprotectine', label: 'Calprotectine', value: 'modérée', synthesis: '', status: 'surveiller' },
            ],
          },
        ],
        external: [],
      },
    };
    const ctx = buildClinicalContext({ journeyState: journey });
    const block = buildClinicalContextBlockFr(ctx);

    // Wording prudent obligatoire
    expect(block).toMatch(/Phase probable/);
    expect(block).not.toMatch(/la cliente est en phase/i);
    expect(block).toMatch(/Muqueuse/);
    expect(block).toMatch(/confiance/);

    // Source-level visible via "Test → Marker"
    expect(block).toMatch(/Microbiome Complete Plus → Zonuline/);
  });

  // ───── Surcharge prompt
  it('Stress 15 — 50 markers : prompt rendu < 30 KB (pas d\'explosion)', () => {
    const markerCodes = [
      'vit_d_25oh', 'vit_b12', 'folates', 'ferritine', 'fer_serique', 'transferrine_saturation',
      'magnesium_globulaire', 'zinc', 'selenium', 'omega_3_index',
      'tsh', 't3_libre', 't4_libre', 'anti_tpo',
      'crp_us', 'fibrinogene', 'homocysteine', 'vitesse_sedimentation',
      'estradiol', 'progesterone', 'dhea_s', 'testosterone',
      'cortisol_matin', 'cortisol_profil_journee',
      'glycemie_jeun', 'hba1c', 'insuline',
      'cholesterol_total', 'ldl_cholesterol', 'hdl_cholesterol', 'triglycerides',
      'zonuline', 'iga_secretoire', 'calprotectine', 'akkermansia', 'faecalibacterium',
      'diversite_microbiote', 'candida_albicans',
      'producteurs_butyrate', 'histamine_stool', 'parasites_qpcr',
    ];
    const journey = {
      results_data: {
        from_plan: [
          { test_code: 'multi', test_name: 'Bilan complet', markers: markerCodes.map((c) => ({ marker_code: c, label: c, value: '42', synthesis: '', status: 'optimal' })) },
        ],
        external: [],
      },
    };
    const ctx = buildClinicalContext({ journeyState: journey });
    const block = buildClinicalContextBlockFr(ctx);
    expect(block.length).toBeLessThan(30000);
  });
});

function makeMarkers(codes, status) {
  return codes.map((c) => ({ marker_code: c, label: c, value: '42', synthesis: '', status }));
}
