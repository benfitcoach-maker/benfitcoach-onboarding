// P1.2 (colmatage backdoors, 2026-06-10) — le gate de clairance doit vivre
// dans le SERVICE d'export, pas sur un bouton. Avant ce remède, exportPlanToWord
// et exportFicheFrigoPDF n'avaient AUCUNE clairance interne : 3 call sites
// (ClientJourneyPage handleExportWord, NutritionConsultation menu Exporter,
// NutritionHistory handleExportFrigo) sortaient un plan non clairé sans aucun
// contrôle. On factorise une garde pure `assertExportCleared` que les 2 services
// appellent en tête → une seule barrière couvre tous les call sites.
//
// Test ROUGE avant remède (assertExportCleared / ExportClinicalError n'existent
// pas) → VERT après.

import { describe, it, expect } from 'vitest';
import {
  assertExportCleared,
  ExportClinicalError,
} from '../clinicalClearance';

// Plan déterministe non clairé : un allergène déclaré présent dans le texte
// → violation HIGH (ne dépend ni des guardrails ni des interactions DB).
const UNCLEARED_PLAN = "Petit déjeuner : tartine de pâte d'arachide.";
const FORM_ALLERGIC = { allergies: 'arachide' };

describe('assertExportCleared — gate clairance au niveau service (P1.2)', () => {
  it('plan non clairé (allergène présent) → throw ExportClinicalError porteur du verdict', () => {
    let thrown = null;
    try {
      assertExportCleared(UNCLEARED_PLAN, { form: FORM_ALLERGIC });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ExportClinicalError);
    expect(thrown.verdict.cleared).toBe(false);
    expect(thrown.verdict.violations.length).toBeGreaterThan(0);
  });

  it('override conscient (clinicalOverride:true) → ne throw pas, renvoie le verdict', () => {
    const v = assertExportCleared(UNCLEARED_PLAN, { form: FORM_ALLERGIC }, { clinicalOverride: true });
    expect(v.cleared).toBe(false); // verdict toujours rapporté, mais non bloquant
  });

  it('plan clairé → ne throw pas, renvoie cleared:true', () => {
    const v = assertExportCleared('Petit déjeuner : flocons avoine, myrtilles.', { form: {} });
    expect(v.cleared).toBe(true);
  });

  it('entrée illisible (vide) → fail-closed → throw sans override', () => {
    expect(() => assertExportCleared('', { form: {} })).toThrow(ExportClinicalError);
  });

  it('entrée illisible (vide) + override → ne throw pas', () => {
    expect(() => assertExportCleared('', { form: {} }, { clinicalOverride: true })).not.toThrow();
  });
});
