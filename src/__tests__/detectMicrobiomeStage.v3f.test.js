// V97.4 V3.F — Tests unitaires du moteur de détection microbiome.
// Date : 2026-05-12
//
// Couverture :
//   - Comportement par phase (1 à 5) avec scénarios markers réalistes
//   - Discordance entre phases → null (refus de trancher)
//   - Sous-seuil de votes → null
//   - Override Anissa propage final_phase + flag + override_reason
//   - inferred_phase / reasons conservés en cas d'override (audit)
//   - Wording suggestif : confidence présente, alias renderer cohérents
//   - Robustesse : journey vide, markers absent, règle qui throw

import { describe, it, expect } from 'vitest';
import { detectMicrobiomeStage } from '../services/clinical/microbiome/detectMicrobiomeStage';

// Helper : construit un journey_state minimal avec markers
function makeJourney(markersByTest, microbiomeOverride) {
  return {
    results_data: {
      from_plan: markersByTest.map(([testCode, markers]) => ({
        test_code: testCode,
        test_name: testCode,
        markers,
      })),
      external: [],
    },
    microbiome_override: microbiomeOverride,
  };
}

describe('V3.F — detectMicrobiomeStage', () => {

  // ───── Cas no-op
  it('journey vide / absent → final_phase null, pas de crash', () => {
    expect(() => detectMicrobiomeStage()).not.toThrow();
    expect(() => detectMicrobiomeStage({})).not.toThrow();
    expect(() => detectMicrobiomeStage({ journeyState: null })).not.toThrow();
    const out = detectMicrobiomeStage({ journeyState: {} });
    expect(out.final_phase).toBeNull();
    expect(out.inferred_phase).toBeNull();
    expect(out.confidence).toBeNull();
    expect(out.reasons).toEqual([]);
    expect(out.overridden_by_practitioner).toBe(false);
  });

  it('markers absents → final_phase null', () => {
    const out = detectMicrobiomeStage({
      journeyState: makeJourney([['ortho_test', undefined]]),
    });
    expect(out.final_phase).toBeNull();
    expect(out.reasons).toEqual([]);
  });

  // ───── Phase 1 : éradication
  it('Phase 1 — candida prioritaire seul (1 règle weight 2) → inferred=1, confidence faible', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida albicans', status: 'prioritaire' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.inferred_phase).toBe(1);
    expect(out.final_phase).toBe(1);
    expect(out.confidence).toBe('faible'); // 2 votes >= threshold mais < 3
    expect(out.reasons).toContain('Candida albicans flaggué prioritaire par Anissa');
    expect(out.label).toBe('Éradication');
    expect(out.target_markers).toContain('candida_albicans');
  });

  it('Phase 1 — candida + calprotectine → confidence modérée (2 règles)', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida', status: 'prioritaire' },
        { marker_code: 'calprotectine', label: 'Calprotectine', status: 'prioritaire' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.inferred_phase).toBe(1);
    expect(out.confidence).toBe('modérée'); // 2+1 = 3 votes
    expect(out.reasons.length).toBeGreaterThanOrEqual(2);
  });

  // ───── Phase 2 : recolonisation
  it('Phase 2 — flore protectrice basse (akkermansia + faecalibacterium)', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'akkermansia', label: 'Akkermansia', status: 'prioritaire' },
        { marker_code: 'faecalibacterium', label: 'Faecalibacterium', status: 'surveiller' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.inferred_phase).toBe(2);
    expect(out.label).toBe('Recolonisation');
  });

  // ───── Phase 3 : muqueuse / immunorégulation
  it('Phase 3 — pattern perméabilité (zonuline + IgA)', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'zonuline', label: 'Zonuline', status: 'prioritaire' },
        { marker_code: 'iga_secretoire', label: 'IgA sécrétoire', status: 'surveiller' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.inferred_phase).toBe(3);
    expect(out.label).toBe('Muqueuse / immunorégulation');
    expect(out.target_markers).toContain('zonuline');
  });

  // ───── Phase 4 : régulation immunitaire
  it('Phase 4 — inflammation systémique sans zonuline', () => {
    const journey = makeJourney([
      ['ortho_inflammation', [
        { marker_code: 'crp_us', label: 'CRP', status: 'prioritaire' },
        { marker_code: 'fibrinogene', label: 'Fibrinogène', status: 'surveiller' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.inferred_phase).toBe(4);
    expect(out.label).toBe('Régulation immunitaire');
  });

  // ───── Discordance : refus de trancher
  it('Discordance entre 2 phases proches → final_phase null mais reasons préservées', () => {
    // Candida prioritaire (phase 1, weight 2) + zonuline + IgA (phase 3, weight 2)
    // → 2 vs 2 → discordance (écart 0 ≤ 1)
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida', status: 'prioritaire' },
        { marker_code: 'zonuline', label: 'Zonuline', status: 'prioritaire' },
        { marker_code: 'iga_secretoire', label: 'IgA', status: 'surveiller' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.inferred_phase).toBeNull();
    expect(out.final_phase).toBeNull();
    expect(out.confidence).toBeNull();
    // Mais reasons des 2 leaders présentes pour audit
    expect(out.reasons.length).toBeGreaterThan(0);
  });

  // ───── Sous-seuil
  it('1 vote isolé < threshold → final_phase null', () => {
    // Diversité basse sans inflammation = phase 2 weight 1 SEULE → 1 < 2
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'diversite_microbiote', label: 'Diversité', status: 'surveiller' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.inferred_phase).toBeNull();
    expect(out.final_phase).toBeNull();
    // Les reasons restent listées (audit)
    expect(out.reasons.length).toBeGreaterThan(0);
  });

  // ───── Override
  it('Override Anissa → final_phase = override, overridden_by_practitioner true', () => {
    const journey = makeJourney(
      [
        ['ortho_microbiome_complete_plus', [
          { marker_code: 'candida_albicans', label: 'Candida', status: 'prioritaire' },
        ]],
      ],
      { phase: 3, reason: 'cliente très inflammatoire et hypersensible' },
    );
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.inferred_phase).toBe(1);          // auto = éradication
    expect(out.final_phase).toBe(3);             // override = muqueuse
    expect(out.overridden_by_practitioner).toBe(true);
    expect(out.override_reason).toBe('cliente très inflammatoire et hypersensible');
    expect(out.label).toBe('Muqueuse / immunorégulation'); // alias renderer = override
    // Reasons de l'inférence auto restent pour transparence
    expect(out.reasons).toContain('Candida albicans flaggué prioritaire par Anissa');
    // Goal reflète l'override avec wording praticienne
    expect(out.goal).toMatch(/praticienne/i);
  });

  it('Override invalide (phase hors 1-5) → ignoré', () => {
    const journey = makeJourney(
      [['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida', status: 'prioritaire' },
      ]]],
      { phase: 99, reason: 'test' },
    );
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.overridden_by_practitioner).toBe(false);
    expect(out.final_phase).toBe(1);
  });

  // ───── Wording suggestif (alias renderer)
  it('Goal contient "Orientation compatible" + confidence (cas inféré sans override)', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida', status: 'prioritaire' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.goal).toMatch(/Orientation compatible/i);
    expect(out.goal).toMatch(/confiance/i);
  });

  it('Sortie expose target_markers + allowed_axes + avoid_axes (alias renderer)', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida', status: 'prioritaire' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(Array.isArray(out.target_markers)).toBe(true);
    expect(Array.isArray(out.allowed_axes)).toBe(true);
    expect(Array.isArray(out.avoid_axes)).toBe(true);
    expect(Array.isArray(out.allowed_interventions)).toBe(true);
    expect(Array.isArray(out.blocked_interventions)).toBe(true);
    // Les 2 doivent être cohérents
    expect(out.allowed_interventions).toEqual(out.allowed_axes);
  });
});

// ═══════════════════════════════════════════════════════════════════
// V3.G — Régressions sur les 3 cas réels anonymisés validés 2026-05-12.
// Ces tests verrouillent les comportements attendus post-ajustements :
//   - permeabilite_pattern.weight 2 → 3
//   - règle diversite_prioritaire_isolee (P2, weight 2)
//   - règle candida_avec_pathogene (P1, weight 1)
//   - markers producteurs_butyrate / histamine_stool / parasites_qpcr ajoutés
// ═══════════════════════════════════════════════════════════════════

describe('V3.G — régressions cas réels validés', () => {

  it('Cas 1 — pattern perméabilité → P3 inférée (P3 écrase P2)', () => {
    // Avant V3.G : null (discordance P3=2 vs P2=1)
    // Après V3.G : P3=3 (permeabilite_pattern weight 3) vs P2=1 → P3 gagne
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'zonuline', label: 'Zonuline', status: 'prioritaire' },
        { marker_code: 'iga_secretoire', label: 'IgA sécrétoire', status: 'surveiller' },
        { marker_code: 'calprotectine', label: 'Calprotectine', status: 'surveiller' },
        { marker_code: 'diversite_microbiote', label: 'Diversité', status: 'surveiller' },
        { marker_code: 'candida_albicans', label: 'Candida', status: 'optimal' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.inferred_phase).toBe(3);
    expect(out.final_phase).toBe(3);
    expect(out.label).toBe('Muqueuse / immunorégulation');
    // 3 votes (permeabilite_pattern weight 3) → modérée
    expect(out.confidence).toBe('modérée');
    expect(out.reasons.some((r) => /perméabilité/i.test(r))).toBe(true);
  });

  it('Cas 2 — diversité prio + akkermansia bas → P2 inférée via diversite_prioritaire_isolee', () => {
    // Avant V3.G : null (sous-seuil, 1 vote isolé)
    // Après V3.G : nouvelle règle diversite_prioritaire_isolee weight 2
    //   + diversite_basse_sans_inflammation_aigue weight 1 = 3 votes
    // → P2 inférée, confidence modérée
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'diversite_microbiote', label: 'Diversité', status: 'prioritaire' },
        { marker_code: 'producteurs_butyrate', label: 'Producteurs butyrate', status: 'surveiller' },
        { marker_code: 'akkermansia', label: 'Akkermansia', status: 'surveiller' },
        { marker_code: 'histamine_stool', label: 'Histamine intestinale', status: 'optimal' },
        { marker_code: 'candida_albicans', label: 'Candida', status: 'optimal' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.inferred_phase).toBe(2);
    expect(out.final_phase).toBe(2);
    expect(out.label).toBe('Recolonisation');
    // Au moins une des règles diversité doit avoir fire
    expect(out.reasons.some((r) => /diversité/i.test(r) || /Diversité/i.test(r))).toBe(true);
  });

  it('Cas 3 — candida prio + parasites surveiller → P1 inférée, confidence renforcée par candida_avec_pathogene', () => {
    // Avant V3.G : P1 inférée mais confidence faible (2 votes)
    // Après V3.G : nouvelle règle candida_avec_pathogene weight 1
    //   candida_prioritaire (2) + candida_avec_pathogene (1) = 3 votes
    // → P1 inférée, confidence modérée
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida', status: 'prioritaire' },
        { marker_code: 'parasites_qpcr', label: 'Parasites qPCR', status: 'surveiller' },
        { marker_code: 'calprotectine', label: 'Calprotectine', status: 'optimal' },
        { marker_code: 'zonuline', label: 'Zonuline', status: 'optimal' },
        { marker_code: 'iga_secretoire', label: 'IgA sécrétoire', status: 'optimal' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.inferred_phase).toBe(1);
    expect(out.final_phase).toBe(1);
    expect(out.label).toBe('Éradication');
    expect(out.confidence).toBe('modérée');
    expect(out.reasons.some((r) => /pathogène/i.test(r) || /parasites/i.test(r))).toBe(true);
  });

  // Garde-fous : nouvelles règles ne doivent pas surclasser des cas
  // qui n'auraient pas dû fire.

  it('Garde-fou diversite_prioritaire_isolee : ne fire PAS si un marker barrière est prioritaire', () => {
    // Diversité prio + zonuline prio → règle ne doit pas fire (pas isolée)
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'diversite_microbiote', label: 'Diversité', status: 'prioritaire' },
        { marker_code: 'zonuline', label: 'Zonuline', status: 'prioritaire' },
        // Ajout pour faire pencher vers P3 : permeabilite_pattern doit fire (zonuline + calprotectine)
        { marker_code: 'calprotectine', label: 'Calprotectine', status: 'surveiller' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    // P3 doit gagner (permeabilite_pattern weight 3) sur ce profil
    expect(out.inferred_phase).toBe(3);
    expect(out.reasons.every((r) => !/isolée/i.test(r))).toBe(true);
  });

  it('Garde-fou candida_avec_pathogene : ne fire PAS sans candida prioritaire', () => {
    // parasites surveiller mais candida optimal → règle ne doit pas fire
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida', status: 'optimal' },
        { marker_code: 'parasites_qpcr', label: 'Parasites', status: 'surveiller' },
      ]],
    ]);
    const out = detectMicrobiomeStage({ journeyState: journey });
    expect(out.reasons.every((r) => !/pathogène/i.test(r))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// V3.H Gap #1 — Pression antibiotique depuis l'anamnèse.
// ═══════════════════════════════════════════════════════════════════

describe('V3.H Gap #1 — règles antibiotiques (form)', () => {

  it('antibio < 3 mois + candida flaggé → P1 renforcée', () => {
    // antibio_recent_avec_candida (P1, w2) + candida_prioritaire (P1, w2) = 4 votes
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida', status: 'prioritaire' },
      ]],
    ]);
    const form = { antibiotiques_recents: 'moins_3_mois' };
    const out = detectMicrobiomeStage({ journeyState: journey, form });
    expect(out.inferred_phase).toBe(1);
    expect(out.confidence).toBe('forte'); // ≥ 4 votes
    expect(out.reasons.some((r) => /Antibiotiques.{0,5}< 3 mois.{0,30}Candida/i.test(r))).toBe(true);
  });

  it('antibio récent SANS candida → P2 recolonisation', () => {
    // antibio_recent_sans_candida (P2, w2) seul = 2 votes
    const form = { antibiotiques_recents: 'moins_12_mois' };
    const out = detectMicrobiomeStage({ journeyState: { results_data: { from_plan: [], external: [] } }, form });
    expect(out.inferred_phase).toBe(2);
    expect(out.reasons.some((r) => /recolonisation post-antibiotique/i.test(r))).toBe(true);
  });

  it('antibio_recent_sans_candida ne fire PAS si candida flaggé (laisse antibio_avec_candida prendre P1)', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida', status: 'surveiller' },
      ]],
    ]);
    const form = { antibiotiques_recents: 'moins_3_mois' };
    const out = detectMicrobiomeStage({ journeyState: journey, form });
    expect(out.inferred_phase).toBe(1);
    // La raison "recolonisation post-antibiotique" ne doit PAS être dans le résultat
    expect(out.reasons.every((r) => !/recolonisation post-antibiotique/i.test(r))).toBe(true);
  });

  it('antifongiques récents seuls → P1 weight 1 (sous-seuil isolément)', () => {
    const form = { antifongiques_recents: 'oui_12_mois' };
    const out = detectMicrobiomeStage({ journeyState: {}, form });
    // 1 vote sous le seuil → final_phase null, mais reasons listées
    expect(out.inferred_phase).toBeNull();
    expect(out.reasons.some((r) => /Antifongiques/i.test(r))).toBe(true);
  });

  it('antifongiques + candida prio → P1 modérée (combo)', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida', status: 'prioritaire' },
      ]],
    ]);
    const form = { antifongiques_recents: 'oui_12_mois' };
    const out = detectMicrobiomeStage({ journeyState: journey, form });
    expect(out.inferred_phase).toBe(1);
    expect(out.confidence).toBe('modérée'); // 2 + 1 = 3 votes
  });

  it('infections récurrentes + heavy antibio history (combo) → P2 modérée', () => {
    const form = {
      infections_recurrentes: 'frequentes',
      antibiotiques_frequence_12mois: '4_plus_cures',
    };
    const out = detectMicrobiomeStage({ journeyState: {}, form });
    // antibio_recent_sans_candida fire (heavy history compte comme signal antibio, pas de candida) → 2
    // infections_recurrentes_avec_antibio fire → 1
    // Total P2 = 3 votes, confidence modérée.
    expect(out.inferred_phase).toBe(2);
    expect(out.confidence).toBe('modérée');
    expect(out.reasons.some((r) => /Infections récurrentes/i.test(r))).toBe(true);
  });

  it('Form vide / absent → comportement identique à V3.G (rétro-compat)', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida', status: 'prioritaire' },
      ]],
    ]);
    const outNoForm = detectMicrobiomeStage({ journeyState: journey });
    const outEmptyForm = detectMicrobiomeStage({ journeyState: journey, form: {} });
    // Phase identique aux 2 cas (form n'ajoute rien)
    expect(outNoForm.inferred_phase).toBe(1);
    expect(outEmptyForm.inferred_phase).toBe(1);
    // Aucune règle form n'a fire
    expect(outNoForm.reasons.every((r) => !/Antibiotiques/i.test(r))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// V3.H Gap #2 — Transit détaillé depuis l'anamnèse.
// ═══════════════════════════════════════════════════════════════════

describe('V3.H Gap #2 — règles transit (form)', () => {

  it('Bristol 1-2 + ballonnements fréquents seul → sous-seuil (1 vote isolé)', () => {
    const form = {
      bristol_selles: '1_2',
      ballonnements_post_repas: 'frequents',
    };
    const out = detectMicrobiomeStage({ journeyState: {}, form });
    // 1 vote P2 isolé → null
    expect(out.inferred_phase).toBeNull();
    expect(out.reasons.some((r) => /Constipation.{0,30}ballonnements/i.test(r))).toBe(true);
  });

  it('Bristol 1-2 + ballonnements + diversité prio → P2 modérée (combo)', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'diversite_microbiote', label: 'Diversité', status: 'prioritaire' },
      ]],
    ]);
    const form = {
      bristol_selles: '1_2',
      ballonnements_post_repas: 'frequents',
    };
    const out = detectMicrobiomeStage({ journeyState: journey, form });
    // diversite_prioritaire_isolee (2) + transit_constipation_pattern (1)
    // + diversite_basse_sans_inflammation_aigue (1) = 4 votes P2
    expect(out.inferred_phase).toBe(2);
    expect(out.confidence).toBe('forte'); // ≥4
  });

  it('Diarrhée Bristol 6-7 + douleurs fréquentes → P3 sous-seuil isolé', () => {
    const form = {
      bristol_selles: '6_7',
      douleurs_digestives: 'frequentes',
    };
    const out = detectMicrobiomeStage({ journeyState: {}, form });
    // 1 vote P3 isolé → null mais reason listée
    expect(out.inferred_phase).toBeNull();
    expect(out.reasons.some((r) => /Diarrh\u00e9e.{0,30}douleurs/i.test(r))).toBe(true);
  });

  it('Diarrhée + douleurs + zonuline prio + calprotectine surveiller → P3 forte', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'zonuline', label: 'Zonuline', status: 'prioritaire' },
        { marker_code: 'calprotectine', label: 'Calprotectine', status: 'surveiller' },
      ]],
    ]);
    const form = {
      bristol_selles: '6_7',
      douleurs_digestives: 'frequentes',
    };
    const out = detectMicrobiomeStage({ journeyState: journey, form });
    // permeabilite_pattern (3) + transit_inflammation_pattern (1) = 4 votes P3
    expect(out.inferred_phase).toBe(3);
    expect(out.confidence).toBe('forte');
  });

  it('Reflux fréquent + ballonnements fréquents → P3 sous-seuil isolé', () => {
    const form = {
      reflux: 'frequent',
      ballonnements_post_repas: 'frequents',
    };
    const out = detectMicrobiomeStage({ journeyState: {}, form });
    // 1 vote P3 isolé → null mais reason listée
    expect(out.inferred_phase).toBeNull();
    expect(out.reasons.some((r) => /Reflux.*SIBO/i.test(r))).toBe(true);
  });

  it('Reflux + bloating + zonuline prio + IgA surveiller → P3 forte (combo)', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'zonuline', label: 'Zonuline', status: 'prioritaire' },
        { marker_code: 'iga_secretoire', label: 'IgA', status: 'surveiller' },
      ]],
    ]);
    const form = {
      reflux: 'frequent',
      ballonnements_post_repas: 'frequents',
    };
    const out = detectMicrobiomeStage({ journeyState: journey, form });
    // permeabilite_pattern (3) + transit_reflux_avec_bloating (1) = 4 votes P3
    expect(out.inferred_phase).toBe(3);
    expect(out.confidence).toBe('forte');
  });

  it('Garde-fou : Bristol 3-4 + ballonnements non → aucune règle transit ne fire', () => {
    const form = {
      bristol_selles: '3_4',
      ballonnements_post_repas: 'non',
      reflux: 'non',
      douleurs_digestives: 'non',
    };
    const out = detectMicrobiomeStage({ journeyState: {}, form });
    expect(out.inferred_phase).toBeNull();
    expect(out.reasons.every((r) => !/Constipation|Diarrh\u00e9e|Reflux/i.test(r))).toBe(true);
  });

  it('Rétro-compat : form sans champ transit → V3.H Gap #1 inchangé', () => {
    const journey = makeJourney([
      ['ortho_microbiome_complete_plus', [
        { marker_code: 'candida_albicans', label: 'Candida', status: 'prioritaire' },
      ]],
    ]);
    const formGap1 = { antibiotiques_recents: 'moins_3_mois' };
    const out = detectMicrobiomeStage({ journeyState: journey, form: formGap1 });
    // Comportement identique au test Gap #1 antibio < 3 mois + candida
    expect(out.inferred_phase).toBe(1);
    expect(out.confidence).toBe('forte');
  });
});

