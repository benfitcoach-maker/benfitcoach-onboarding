// V97.4 V3.C — Test unitaire ResultCard (rendu SSR).
// Date : 2026-05-12
//
// Stratégie : on rend ResultCard via renderToString (pas besoin de jsdom).
// Suffisant pour valider la STRUCTURE du DOM produite par les nouveaux
// props expectedMarkers / markers — labels, unités, inputs, statuts.
//
// On NE teste pas les interactions live (clic, focus) : ça relève d'un test
// e2e ou Playwright. Ici on valide :
//   - Section "Marqueurs attendus" rendue uniquement si expectedMarkers non-vide ET onMarkerChange fourni
//   - Chaque marker affiche label + unit + 3 inputs (value, note, status)
//   - Pré-remplissage depuis markers[] (legacy d'une cliente existante)
//   - Fallback : si expectedMarkers absent → carte rendue en mode libre uniquement
//   - Fallback : markers absent / null / undefined → pas de crash
//   - Compat ancienne cliente : ResultCard appelé sans aucun props V3.C → rendu identique V2.A

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ResultCard } from '../ClientJourneyPage';

// Mock réaliste calé sur orthoAnalyticTests.js (Mikroernährung).
const MOCK_EXPECTED_MARKERS = [
  { code: 'vit_d_25oh', label: 'Vitamine D (25-OH)', unit: 'ng/mL', axis: 'carence' },
  { code: 'ferritine', label: 'Ferritine', unit: 'µg/L', axis: 'carence' },
  { code: 'omega_3_index', label: 'Index Oméga-3', unit: '%', axis: 'inflammation' },
];

const noop = () => {};

describe('ResultCard V3.C — section Marqueurs attendus', () => {
  it('rend la section markers quand expectedMarkers est fourni + onMarkerChange', () => {
    const html = renderToString(
      <ResultCard
        title="Mikroernährung"
        badge="Plan d'analyses"
        badgeColor="accent"
        value=""
        synthesis=""
        category="carence"
        status={null}
        onValueChange={noop}
        onSynthesisChange={noop}
        onCategoryChange={noop}
        onStatusChange={noop}
        expectedMarkers={MOCK_EXPECTED_MARKERS}
        markers={[]}
        onMarkerChange={noop}
      />
    );
    expect(html).toContain('Marqueurs attendus');
    expect(html).toContain('jrn-marker-grid');
    expect(html).toContain('jrn-marker-row');
  });

  it('affiche label + unité pour chaque marker attendu', () => {
    const html = renderToString(
      <ResultCard
        title="Mikroernährung"
        badge="Plan d'analyses"
        badgeColor="accent"
        value=""
        synthesis=""
        category={null}
        status={null}
        onValueChange={noop}
        onSynthesisChange={noop}
        onCategoryChange={noop}
        onStatusChange={noop}
        expectedMarkers={MOCK_EXPECTED_MARKERS}
        markers={[]}
        onMarkerChange={noop}
      />
    );
    for (const m of MOCK_EXPECTED_MARKERS) {
      expect(html).toContain(m.label);
      if (m.unit) expect(html).toContain(m.unit);
    }
  });

  it('rend 3 inputs (value, note, status) par marker', () => {
    const html = renderToString(
      <ResultCard
        title="Mikroernährung"
        badge="Plan d'analyses"
        badgeColor="accent"
        value=""
        synthesis=""
        category={null}
        status={null}
        onValueChange={noop}
        onSynthesisChange={noop}
        onCategoryChange={noop}
        onStatusChange={noop}
        expectedMarkers={MOCK_EXPECTED_MARKERS}
        markers={[]}
        onMarkerChange={noop}
      />
    );
    // 3 markers × 1 input value + 1 input note = 6 inputs text de classe jrn-marker-row__*
    const valueInputs = html.match(/class="jrn-marker-row__value"/g) || [];
    const noteInputs = html.match(/class="jrn-marker-row__note"/g) || [];
    const statusSelects = html.match(/class="jrn-marker-row__status"/g) || [];
    expect(valueInputs).toHaveLength(MOCK_EXPECTED_MARKERS.length);
    expect(noteInputs).toHaveLength(MOCK_EXPECTED_MARKERS.length);
    expect(statusSelects).toHaveLength(MOCK_EXPECTED_MARKERS.length);
  });

  it('pré-remplit les inputs depuis markers[] existant (legacy cliente)', () => {
    const SAVED = [
      {
        marker_code: 'ferritine',
        label: 'Ferritine',
        unit: 'µg/L',
        value: '22',
        synthesis: 'Réserves basses, à remonter',
        status: 'prioritaire',
      },
    ];
    const html = renderToString(
      <ResultCard
        title="Mikroernährung"
        badge="Plan d'analyses"
        badgeColor="accent"
        value=""
        synthesis=""
        category={null}
        status={null}
        onValueChange={noop}
        onSynthesisChange={noop}
        onCategoryChange={noop}
        onStatusChange={noop}
        expectedMarkers={MOCK_EXPECTED_MARKERS}
        markers={SAVED}
        onMarkerChange={noop}
      />
    );
    expect(html).toContain('value="22"');
    expect(html).toContain('Réserves basses');
    // Statut "prioritaire" doit teinter la ligne via la classe modifier
    expect(html).toContain('jrn-marker-row--prioritaire');
  });

  it('ne rend PAS la section markers si expectedMarkers est vide', () => {
    const html = renderToString(
      <ResultCard
        title="Test custom hors catalogue"
        badge="Plan d'analyses"
        badgeColor="accent"
        value=""
        synthesis=""
        category={null}
        status={null}
        onValueChange={noop}
        onSynthesisChange={noop}
        onCategoryChange={noop}
        onStatusChange={noop}
        expectedMarkers={[]}
        markers={[]}
        onMarkerChange={noop}
      />
    );
    expect(html).not.toContain('Marqueurs attendus');
    expect(html).not.toContain('jrn-marker-grid');
    // La carte garde les sections legacy
    expect(html).toContain('Valeurs laboratoire');
    expect(html).toContain('Lecture clinique');
  });

  it('ne crash pas si markers est null/undefined', () => {
    expect(() =>
      renderToString(
        <ResultCard
          title="X"
          badge="Plan d'analyses"
          badgeColor="accent"
          value=""
          synthesis=""
          category={null}
          status={null}
          onValueChange={noop}
          onSynthesisChange={noop}
          onCategoryChange={noop}
          onStatusChange={noop}
          expectedMarkers={MOCK_EXPECTED_MARKERS}
          markers={null}
          onMarkerChange={noop}
        />
      )
    ).not.toThrow();
    expect(() =>
      renderToString(
        <ResultCard
          title="X"
          badge="Plan d'analyses"
          badgeColor="accent"
          value=""
          synthesis=""
          category={null}
          status={null}
          onValueChange={noop}
          onSynthesisChange={noop}
          onCategoryChange={noop}
          onStatusChange={noop}
          expectedMarkers={MOCK_EXPECTED_MARKERS}
          onMarkerChange={noop}
        />
      )
    ).not.toThrow();
  });

  it('compat V2.A : appel sans props V3.C → rendu identique à avant', () => {
    const html = renderToString(
      <ResultCard
        title="Bilan ancien client"
        badge="Plan d'analyses"
        badgeColor="accent"
        value="Vit D = 18 ng/mL"
        synthesis="Carence modérée"
        category="carence"
        status="surveiller"
        onValueChange={noop}
        onSynthesisChange={noop}
        onCategoryChange={noop}
        onStatusChange={noop}
      />
    );
    expect(html).not.toContain('Marqueurs attendus');
    expect(html).toContain('Valeurs laboratoire');
    expect(html).toContain('Lecture clinique');
    expect(html).toContain('Vit D = 18 ng/mL');
    expect(html).toContain('Carence modérée');
  });

  it('section markers absente si expectedMarkers fourni mais onMarkerChange manquant', () => {
    // Garde-fou : on ne rend pas un widget read-only sans handler.
    const html = renderToString(
      <ResultCard
        title="X"
        badge="Plan d'analyses"
        badgeColor="accent"
        value=""
        synthesis=""
        category={null}
        status={null}
        onValueChange={noop}
        onSynthesisChange={noop}
        onCategoryChange={noop}
        onStatusChange={noop}
        expectedMarkers={MOCK_EXPECTED_MARKERS}
        markers={[]}
      />
    );
    expect(html).not.toContain('Marqueurs attendus');
  });
});
