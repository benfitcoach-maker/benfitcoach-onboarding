// V97.4 V3.C — Preview de validation visuelle (DEV ONLY).
// Date : 2026-05-12
//
// ⚠️⚠️⚠️ FICHIER TEMPORAIRE — DEV ONLY — À SUPPRIMER APRÈS VALIDATION V3.D ⚠️⚠️⚠️
//
// NE PAS EXPOSER EN PROD. NE PAS UTILISER COMME RÉFÉRENCE PRODUIT. NE PAS
// FAIRE ÉVOLUER COMME UNE FEATURE. Si tu lis ce commentaire et que V3.D
// est déjà mergée et validée → tu peux supprimer ce répertoire `__preview__/`
// complet (voir checklist en fin de fichier).
//
// Pourquoi ce fichier ?
//   Le SaaS est admin-only avec auth Supabase prod. Pour vérifier qu'un
//   composant UI se comporte correctement sans se loguer / sans toucher
//   à la prod, on monte ici ResultCard avec des mocks réalistes calés
//   sur le catalogue Ortho-Analytic (cf. orthoAnalyticTests.js).
//
// Comment c'est branché ?
//   App.jsx capture le path /preview-v3c, mais UNIQUEMENT en mode DEV
//   (`import.meta.env.DEV`). En build prod, la condition est compilée à
//   `false` par Vite et toute la branche (+ ce fichier) est tree-shake.
//   → AUCUNE route /preview-v3c accessible en prod.
//
// Quand le supprimer ?
//   Cible : juste après validation V3.D (propagation des markers détaillés
//   à l'IA via buildClinicalContext). À ce moment-là :
//     1. Supprimer ce fichier (src/__preview__/V3CPreview.jsx)
//     2. Supprimer le répertoire src/__preview__/ s'il est vide
//     3. Supprimer dans src/App.jsx :
//          - l'import `V3CPreview from './__preview__/V3CPreview'`
//          - le handler `if (import.meta.env.DEV && pathname === '/preview-v3c')`
//     4. Conserver `src/__tests__/ResultCard.v3c.test.jsx` (régression durable)

import { useState } from 'react';
import { ResultCard } from '../ClientJourneyPage';
import '../styles/journey.css';

// Mocks calés sur catalogue Ortho-Analytic (subset de Mikroernährung)
const MOCK_EXPECTED_MARKERS_VITD = [
  { code: 'vit_d_25oh', label: 'Vitamine D (25-OH)', unit: 'ng/mL', axis: 'carence' },
  { code: 'vit_b12', label: 'Vitamine B12', unit: 'pg/mL', axis: 'carence' },
  { code: 'folates', label: 'Folates (B9)', unit: 'ng/mL', axis: 'carence' },
  { code: 'ferritine', label: 'Ferritine', unit: 'µg/L', axis: 'carence' },
  { code: 'magnesium_globulaire', label: 'Magnésium globulaire', unit: 'mmol/L', axis: 'carence' },
  { code: 'omega_3_index', label: 'Index Oméga-3', unit: '%', axis: 'inflammation' },
];

// Cliente "ancienne" : a déjà saisi 2 markers avant V3.C
const PRESEEDED_MARKERS = [
  {
    marker_code: 'ferritine',
    label: 'Ferritine',
    unit: 'µg/L',
    value: '22',
    synthesis: 'Réserves basses, à remonter via fer héminique + vitamine C',
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
];

function StatefulCard({ title, expectedMarkers, initialMarkers, mode }) {
  const [value, setValue] = useState(mode === 'preseeded' ? 'Vit D = 18 / Ferritine = 22 / B12 = 1200' : '');
  const [synthesis, setSynthesis] = useState(mode === 'preseeded' ? 'Plusieurs carences à corriger en priorité.' : '');
  const [category, setCategory] = useState(mode === 'preseeded' ? 'carence' : null);
  const [status, setStatus] = useState(mode === 'preseeded' ? 'prioritaire' : null);
  const [markers, setMarkers] = useState(initialMarkers || []);

  const handleMarkerChange = (markerCode, field, val) => {
    setMarkers((prev) => {
      const idx = prev.findIndex((m) => m && m.marker_code === markerCode);
      if (idx === -1) {
        const cat = (expectedMarkers || []).find((cm) => cm && cm.code === markerCode);
        return [
          ...prev,
          {
            marker_code: markerCode,
            label: cat?.label || markerCode,
            unit: cat?.unit || null,
            value: '',
            synthesis: '',
            status: null,
            [field]: val,
          },
        ];
      }
      return prev.map((m, k) => k === idx ? { ...m, [field]: val } : m);
    });
  };

  return (
    <div style={{ marginBottom: 28 }}>
      <ResultCard
        title={title}
        badge="Plan d'analyses"
        badgeColor="accent"
        value={value}
        synthesis={synthesis}
        category={category}
        status={status}
        onValueChange={setValue}
        onSynthesisChange={setSynthesis}
        onCategoryChange={setCategory}
        onStatusChange={setStatus}
        expectedMarkers={expectedMarkers}
        markers={markers}
        onMarkerChange={expectedMarkers && expectedMarkers.length > 0 ? handleMarkerChange : undefined}
      />
      {/* Inspecteur d'état pour debug — pas un design final, juste visibilité */}
      <details style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 11, opacity: 0.7 }}>
        <summary>État JSON (debug)</summary>
        <pre data-testid={`state-${title.replace(/\s+/g, '-').toLowerCase()}`} style={{ background: '#fafafa', padding: 8, border: '1px solid #eee', borderRadius: 4, overflow: 'auto' }}>
          {JSON.stringify({ value, synthesis, category, status, markers }, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default function V3CPreview() {
  return (
    <div style={{ padding: '32px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>V3.C Preview — Marqueurs attendus dans ResultCard</h1>
      <p style={{ color: '#666', marginBottom: 32, fontSize: 13 }}>
        Page DEV ONLY pour vérifier visuellement la section &quot;Marqueurs attendus&quot;.
        Ne sera pas accessible en prod. À supprimer après validation V3.C.
      </p>

      <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 12 }}>1. Cliente nouvelle — test du catalogue (Mikroernährung)</h2>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
        Section &quot;Marqueurs attendus&quot; doit s&apos;afficher avec 6 lignes. Tous les champs vides.
      </p>
      <StatefulCard
        title="Mikroernährung (micronutrition)"
        expectedMarkers={MOCK_EXPECTED_MARKERS_VITD}
        initialMarkers={[]}
        mode="fresh"
      />

      <h2 style={{ fontSize: 16, marginTop: 32, marginBottom: 12 }}>2. Cliente avec markers pré-remplis (legacy)</h2>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
        Ferritine doit être teintée rouge (prioritaire), Vitamine D jaune (surveiller).
      </p>
      <StatefulCard
        title="Mikroernährung (avec données existantes)"
        expectedMarkers={MOCK_EXPECTED_MARKERS_VITD}
        initialMarkers={PRESEEDED_MARKERS}
        mode="preseeded"
      />

      <h2 style={{ fontSize: 16, marginTop: 32, marginBottom: 12 }}>3. Test hors catalogue (expectedMarkers vide)</h2>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
        Section &quot;Marqueurs attendus&quot; doit être ABSENTE. Seuls les champs libres restent.
      </p>
      <StatefulCard
        title="Test custom Anissa (sans catalogue)"
        expectedMarkers={[]}
        initialMarkers={[]}
        mode="fresh"
      />

      <h2 style={{ fontSize: 16, marginTop: 32, marginBottom: 12 }}>4. Compat V2.A — props V3.C absents</h2>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
        Carte rendue exactement comme avant V3.C (aucun crash, pas de section markers).
      </p>
      <ResultCard
        title="Ancien bilan cliente"
        badge="Plan d'analyses"
        badgeColor="accent"
        value="B12 = 1200 pg/mL · Vit D = 18 ng/mL"
        synthesis="Profil compatible avec carence."
        category="carence"
        status="surveiller"
        onValueChange={() => {}}
        onSynthesisChange={() => {}}
        onCategoryChange={() => {}}
        onStatusChange={() => {}}
      />
    </div>
  );
}
