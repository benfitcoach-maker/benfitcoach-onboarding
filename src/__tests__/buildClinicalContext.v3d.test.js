// V97.4 V3.D — Tests unitaires buildClinicalContext.
// Date : 2026-05-12
//
// Couverture :
//   - Legacy : journey sans markers[] → comportement V3.B inchangé.
//   - V3.D : propagation from_plan[].markers[] dans enteredResults
//     avec source_level: "marker" et clinicalSignals avec
//     confidence: "note Anissa marker".
//   - Tags : enteredResults niveau test reçoit source_level: "test".
//   - Robustesse : markers absent / null / vide / partiel ne crash pas
//     et n'altère pas les sorties.

import { describe, it, expect } from 'vitest';
import { buildClinicalContext } from '../services/clinical/buildClinicalContext';

describe('V3.D — propagation markers à l\'IA', () => {

  it('aucun markers[] → comportement legacy V3.B (rétro-compat)', () => {
    const ctx = buildClinicalContext({
      journeyState: {
        results_data: {
          from_plan: [
            {
              test_code: 'ortho_mikroernaehrung',
              test_name: 'Mikroernährung',
              value: 'B12=1200 / Vit D=18',
              synthesis: 'Carence à corriger',
              status: 'surveiller',
            },
          ],
          external: [],
        },
      },
    });
    // 1 enteredResult niveau test, taggué V3.D
    expect(ctx.enteredResults).toHaveLength(1);
    expect(ctx.enteredResults[0].source_level).toBe('test');
    expect(ctx.enteredResults[0].label).toBe('Mikroernährung');
    expect(ctx.enteredResults[0].value).toBe('B12=1200 / Vit D=18');
    // 1 signal niveau test, confidence inchangée V2.A
    expect(ctx.clinicalSignals).toHaveLength(1);
    expect(ctx.clinicalSignals[0].confidence).toBe('note Anissa');
  });

  it('markers avec value/synthesis → enteredResults marker-level avec source_level: "marker"', () => {
    const ctx = buildClinicalContext({
      journeyState: {
        results_data: {
          from_plan: [
            {
              test_code: 'ortho_mikroernaehrung',
              test_name: 'Mikroernährung',
              value: '',
              synthesis: '',
              markers: [
                {
                  marker_code: 'ferritine',
                  label: 'Ferritine',
                  unit: 'µg/L',
                  value: '22',
                  synthesis: 'Réserves basses',
                  status: 'prioritaire',
                },
                {
                  marker_code: 'vit_d_25oh',
                  label: 'Vitamine D (25-OH)',
                  unit: 'ng/mL',
                  value: '18',
                  synthesis: '',
                  status: 'surveiller',
                },
              ],
            },
          ],
          external: [],
        },
      },
    });
    // Pas de niveau test (value+synthesis vides) → uniquement les 2 markers
    expect(ctx.enteredResults).toHaveLength(2);
    expect(ctx.enteredResults.every((r) => r.source_level === 'marker')).toBe(true);

    const ferEntry = ctx.enteredResults.find((r) => r.label.includes('Ferritine'));
    expect(ferEntry).toBeDefined();
    expect(ferEntry.label).toBe('Mikroernährung → Ferritine');
    expect(ferEntry.value).toBe('22');
    expect(ferEntry.synthesis).toBe('Réserves basses');
    expect(ferEntry.unit).toBe('µg/L');
    expect(ferEntry.source_level).toBe('marker');

    const vitdEntry = ctx.enteredResults.find((r) => r.label.includes('Vitamine D'));
    expect(vitdEntry.label).toBe('Mikroernährung → Vitamine D (25-OH)');
    expect(vitdEntry.value).toBe('18');
    expect(vitdEntry.synthesis).toBe('');
  });

  it('markers status prioritaire/surveiller → clinicalSignals avec confidence "note Anissa marker"', () => {
    const ctx = buildClinicalContext({
      journeyState: {
        results_data: {
          from_plan: [
            {
              test_code: 'ortho_mikroernaehrung',
              test_name: 'Mikroernährung',
              markers: [
                { marker_code: 'ferritine', label: 'Ferritine', value: '22', status: 'prioritaire' },
                { marker_code: 'vit_d_25oh', label: 'Vitamine D', value: '18', status: 'surveiller' },
                { marker_code: 'magnesium_globulaire', label: 'Magnésium', value: '0.75', status: 'optimal' },
              ],
            },
          ],
          external: [],
        },
      },
    });
    // optimal → pas de signal. prioritaire + surveiller → 2 signals.
    expect(ctx.clinicalSignals).toHaveLength(2);
    expect(ctx.clinicalSignals.every((s) => s.confidence === 'note Anissa marker')).toBe(true);

    const ferSig = ctx.clinicalSignals.find((s) => s.label.includes('Ferritine'));
    expect(ferSig.label).toContain('Mikroernährung → Ferritine');
    expect(ferSig.label).toContain('priorité haute');
    expect(ferSig.priority).toBe(1);
    expect(ferSig.source_markers).toEqual(['Ferritine']);

    const vitdSig = ctx.clinicalSignals.find((s) => s.label.includes('Vitamine D'));
    expect(vitdSig.label).toContain('à surveiller');
    expect(vitdSig.priority).toBe(2);
  });

  it('mix test-level + marker-level → 2 niveaux distincts dans enteredResults ET clinicalSignals', () => {
    const ctx = buildClinicalContext({
      journeyState: {
        results_data: {
          from_plan: [
            {
              test_code: 'ortho_mikroernaehrung',
              test_name: 'Mikroernährung',
              value: 'Bilan global déficitaire',
              synthesis: 'Plusieurs carences',
              status: 'surveiller',
              markers: [
                { marker_code: 'ferritine', label: 'Ferritine', value: '22', synthesis: 'Basse', status: 'prioritaire' },
              ],
            },
          ],
          external: [],
        },
      },
    });
    // enteredResults : 1 test-level + 1 marker-level = 2
    expect(ctx.enteredResults).toHaveLength(2);
    const testEntry = ctx.enteredResults.find((r) => r.source_level === 'test');
    const markerEntry = ctx.enteredResults.find((r) => r.source_level === 'marker');
    expect(testEntry).toBeDefined();
    expect(markerEntry).toBeDefined();
    expect(testEntry.label).toBe('Mikroernährung');
    expect(markerEntry.label).toBe('Mikroernährung → Ferritine');

    // clinicalSignals : 1 niveau test (surveiller) + 1 niveau marker (prioritaire) = 2
    expect(ctx.clinicalSignals).toHaveLength(2);
    const confidences = ctx.clinicalSignals.map((s) => s.confidence).sort();
    expect(confidences).toEqual(['note Anissa', 'note Anissa marker']);
  });

  it('markers vide / null / undefined → aucun crash, aucun marker-level produit', () => {
    const variants = [
      undefined,
      null,
      [],
      [null],
      [{}],
    ];
    for (const variantMarkers of variants) {
      const ctx = buildClinicalContext({
        journeyState: {
          results_data: {
            from_plan: [
              {
                test_code: 'ortho_test',
                test_name: 'Test X',
                value: 'lvl test',
                markers: variantMarkers,
              },
            ],
            external: [],
          },
        },
      });
      // Toujours 1 enteredResult niveau test, jamais d'entry marker
      const markerEntries = ctx.enteredResults.filter((r) => r.source_level === 'marker');
      expect(markerEntries).toHaveLength(0);
      // Toujours 1 niveau test
      const testEntries = ctx.enteredResults.filter((r) => r.source_level === 'test');
      expect(testEntries).toHaveLength(1);
    }
  });

  it('marker value/synthesis vides → exclu d\'enteredResults mais status conservé pour signal', () => {
    const ctx = buildClinicalContext({
      journeyState: {
        results_data: {
          from_plan: [
            {
              test_code: 'ortho_test',
              test_name: 'Test',
              markers: [
                // Pas de value/synthesis mais status défini → 0 enteredResult, 1 signal
                { marker_code: 'm1', label: 'M1', status: 'prioritaire' },
                // Pas de value/synthesis NI status → ignoré partout
                { marker_code: 'm2', label: 'M2' },
              ],
            },
          ],
          external: [],
        },
      },
    });
    expect(ctx.enteredResults).toHaveLength(0);
    expect(ctx.clinicalSignals).toHaveLength(1);
    expect(ctx.clinicalSignals[0].confidence).toBe('note Anissa marker');
    expect(ctx.clinicalSignals[0].label).toContain('M1');
  });

  it('external analyses → toujours source_level: "test" (pas de markers possible)', () => {
    const ctx = buildClinicalContext({
      journeyState: {
        results_data: {
          from_plan: [],
          external: [
            { name: 'Bilan thyroïdien externe', value: 'TSH=2.5', synthesis: 'Normal', status: null },
            { name: 'Cortisol salivaire', value: 'élevé', synthesis: 'Stress chronique', status: 'prioritaire' },
          ],
        },
      },
    });
    expect(ctx.enteredResults).toHaveLength(2);
    expect(ctx.enteredResults.every((r) => r.source_level === 'test')).toBe(true);
    expect(ctx.clinicalSignals).toHaveLength(1);
    expect(ctx.clinicalSignals[0].confidence).toBe('note Anissa');
  });

  it('même marqueur dans 2 tests → 2 entrées distinctes (pas de dédup, prêt longitudinal)', () => {
    // Ferritine peut apparaître dans Mikroernährung ET Profil inflammation.
    // V3.D ne dédupliquera pas — V3.E gérera T0/T1.
    const ctx = buildClinicalContext({
      journeyState: {
        results_data: {
          from_plan: [
            {
              test_code: 'ortho_mikroernaehrung',
              test_name: 'Mikroernährung',
              markers: [{ marker_code: 'ferritine', label: 'Ferritine', value: '22', status: 'surveiller' }],
            },
            {
              test_code: 'ortho_inflammation',
              test_name: 'Profil inflammation',
              markers: [{ marker_code: 'ferritine', label: 'Ferritine', value: '120', status: 'surveiller' }],
            },
          ],
          external: [],
        },
      },
    });
    const ferEntries = ctx.enteredResults.filter((r) => r.label.includes('Ferritine'));
    expect(ferEntries).toHaveLength(2);
    expect(ferEntries.find((r) => r.value === '22')).toBeDefined();
    expect(ferEntries.find((r) => r.value === '120')).toBeDefined();
    const ferSignals = ctx.clinicalSignals.filter((s) => s.label.includes('Ferritine'));
    expect(ferSignals).toHaveLength(2);
  });

  it('journey vide ou absent → aucun crash, structure shape vide cohérente', () => {
    expect(() => buildClinicalContext()).not.toThrow();
    expect(() => buildClinicalContext({})).not.toThrow();
    expect(() => buildClinicalContext({ journeyState: null })).not.toThrow();
    const ctx = buildClinicalContext({ journeyState: {} });
    expect(ctx.enteredResults).toEqual([]);
    expect(ctx.clinicalSignals).toEqual([]);
    expect(ctx.selectedTests).toEqual([]);
    expect(ctx.expectedMarkers).toEqual([]);
  });

  it('label marker manquant → fallback marker_code, jamais "undefined → undefined"', () => {
    const ctx = buildClinicalContext({
      journeyState: {
        results_data: {
          from_plan: [
            {
              test_name: 'Test',
              markers: [
                { marker_code: 'mystery_marker', value: '42', status: 'prioritaire' },
              ],
            },
          ],
          external: [],
        },
      },
    });
    expect(ctx.enteredResults[0].label).toBe('Test → mystery_marker');
    expect(ctx.clinicalSignals[0].label).toContain('mystery_marker');
  });
});
