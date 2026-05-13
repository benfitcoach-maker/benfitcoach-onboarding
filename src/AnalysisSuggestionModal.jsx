// ─────────────────────────────────────────────────────────────────
// Phase B.1.b — Modale suggestion d'analyses Ortho/MGD
// Date : 2026-05-09
//
// Workflow :
// 1. A l'ouverture, charge le catalogue lab_tests depuis Supabase
// 2. Appelle l'IA suggestAnalyses() avec anamnese pseudonymisee
// 3. Affiche les 3-5 suggestions avec checkboxes
// 4. Anissa coche/decoche -> marge calculee live
// 5. Validation -> appelle onValidate(plan) + ferme modale
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { suggestAnalyses, enrichSuggestionsWithCatalog } from './services/suggestAnalyses';
import { PACK_DEFINITIONS } from './services/packSystem';

export default function AnalysisSuggestionModal({
  isOpen,
  onClose,
  client,
  packType,
  onValidate,  // async (plan) => {} — appele a la validation
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [iaResult, setIaResult] = useState(null);     // { client_summary, suggestions, alerts_anissa }
  const [enrichedSuggestions, setEnrichedSuggestions] = useState([]);
  const [selected, setSelected] = useState({});       // { code: true/false }
  const [extraTests, setExtraTests] = useState([]);   // tests ajoutés hors suggestions IA
  const [saving, setSaving] = useState(false);

  const pack = PACK_DEFINITIONS[packType];
  const packPrice = pack?.price || 0;

  // ─── Chargement initial : catalog + IA ─────────────────────────
  useEffect(() => {
    if (!isOpen || !client || !packType) return;
    let cancelled = false;

    async function loadAndSuggest() {
      setLoading(true);
      setError(null);
      setIaResult(null);
      setEnrichedSuggestions([]);
      setSelected({});
      setExtraTests([]);

      try {
        // 1. Charger catalogue
        const { data: tests, error: catErr } = await supabase
          .from('lab_tests')
          .select('*')
          .eq('is_active', true)
          .order('category')
          .order('cost_anissa_chf');

        if (catErr) throw new Error(`Erreur chargement catalogue : ${catErr.message}`);
        if (cancelled) return;
        setCatalog(tests || []);

        // 2. Appel IA
        const result = await suggestAnalyses({
          client,
          packType,
          catalog: tests || [],
        });
        if (cancelled) return;

        if (!result || !Array.isArray(result.suggestions)) {
          throw new Error('Reponse IA invalide ou vide');
        }

        const enriched = enrichSuggestionsWithCatalog(result.suggestions, tests || []);
        setIaResult(result);
        setEnrichedSuggestions(enriched);

        // Pre-selectionner les recommended_default
        const initialSelected = {};
        enriched.forEach(s => {
          if (s.recommended_default) initialSelected[s.code] = true;
        });
        setSelected(initialSelected);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Erreur inattendue');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAndSuggest();
    return () => { cancelled = true; };
  }, [isOpen, client?.id, packType]);

  // ─── Marge calculee live ───────────────────────────────────────
  const { totalCost, totalMargin, marginPct, selectedTests } = useMemo(() => {
    const allSelected = [
      ...enrichedSuggestions.filter(s => selected[s.code]),
      ...extraTests.filter(s => selected[s.code]),
    ];
    const cost = allSelected.reduce((sum, t) => sum + (t.cost_anissa_chf || 0), 0);
    const margin = packPrice - cost;
    const pct = packPrice > 0 ? Math.round((margin / packPrice) * 100) : 0;
    return {
      totalCost: cost,
      totalMargin: margin,
      marginPct: pct,
      selectedTests: allSelected,
    };
  }, [selected, enrichedSuggestions, extraTests, packPrice]);

  // ─── Tests disponibles hors suggestions (pour ajout manuel) ────
  const availableExtraTests = useMemo(() => {
    const suggestedCodes = new Set(enrichedSuggestions.map(s => s.code));
    const extraCodes = new Set(extraTests.map(s => s.code));
    return catalog.filter(t => !suggestedCodes.has(t.code) && !extraCodes.has(t.code));
  }, [catalog, enrichedSuggestions, extraTests]);

  // ─── Handlers ──────────────────────────────────────────────────
  function toggleSelected(code) {
    setSelected(prev => ({ ...prev, [code]: !prev[code] }));
  }

  function addExtraTest(code) {
    const test = catalog.find(t => t.code === code);
    if (!test) return;
    setExtraTests(prev => [...prev, {
      code: test.code,
      display_name: test.display_name,
      cost_anissa_chf: test.cost_anissa_chf,
      category: test.category,
      source_lab: test.source_lab,
      justification: 'Ajout manuel par Anissa',
      pertinence_score: null,
      recommended_default: false,
    }]);
    setSelected(prev => ({ ...prev, [code]: true }));
  }

  async function handleValidate() {
    if (selectedTests.length === 0) {
      setError('Selectionnez au moins une analyse');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const plan = {
        client_id: client.id,
        pack_type: packType,
        pack_price_chf: packPrice,
        selected_tests: selectedTests.map(t => ({
          code: t.code,
          name: t.display_name,
          cost_anissa_chf: t.cost_anissa_chf,
          category: t.category,
          source_lab: t.source_lab,
          status: 'recommended',
          reason: t.justification,
          score: t.pertinence_score,
        })),
        total_cost_anissa_chf: totalCost,
        total_margin_chf: totalMargin,
        notes_anissa: iaResult?.alerts_anissa?.join(' • ') || null,
        status: 'draft',
      };
      await onValidate(plan);
      onClose();
    } catch (err) {
      setError(err?.message || 'Erreur sauvegarde plan');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  // ─── RENDER ────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" style={overlayStyle} onClick={onClose}>
      <div className="modal-content" style={contentStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>💡 Suggestion d'analyses</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
              {client?.form?.prenom || 'Cliente'} • Pack : <strong>{pack?.label}</strong> ({packPrice} CHF)
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Fermer">×</button>
        </div>

        <div style={bodyStyle}>
          {loading && (
            <div style={loadingStyle}>
              <p>⚙ Analyse algorithmique de l'anamnèse en cours…</p>
              <p style={{ fontSize: 12, color: '#888' }}>~5-10 secondes</p>
            </div>
          )}

          {error && (
            <div style={errorStyle}>
              <strong>Erreur :</strong> {error}
            </div>
          )}

          {!loading && iaResult && (
            <>
              <div style={summaryStyle}>
                <strong>Résumé clinique :</strong>
                <p style={{ margin: '4px 0 0' }}>{iaResult.client_summary}</p>
              </div>

              <h3 style={{ marginTop: 16, fontSize: 14 }}>Analyses suggérées</h3>
              <div>
                {enrichedSuggestions.map(s => (
                  <SuggestionRow
                    key={s.code}
                    suggestion={s}
                    selected={!!selected[s.code]}
                    onToggle={() => toggleSelected(s.code)}
                  />
                ))}
                {extraTests.map(s => (
                  <SuggestionRow
                    key={s.code}
                    suggestion={s}
                    selected={!!selected[s.code]}
                    onToggle={() => toggleSelected(s.code)}
                    isExtra
                  />
                ))}
              </div>

              {availableExtraTests.length > 0 && (
                <div style={addExtraStyle}>
                  <label style={{ fontSize: 12, color: '#666' }}>+ Ajouter une analyse hors suggestions :</label>
                  <select
                    onChange={e => { if (e.target.value) addExtraTest(e.target.value); e.target.value = ''; }}
                    style={{ marginLeft: 8, padding: '4px 8px', maxWidth: 320 }}
                  >
                    <option value="">— Choisir —</option>
                    {availableExtraTests.map(t => (
                      <option key={t.code} value={t.code}>
                        {t.display_name} ({t.cost_anissa_chf} CHF)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {iaResult.alerts_anissa?.length > 0 && (
                <div style={alertsStyle}>
                  <strong>⚠️ Alertes Anissa :</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                    {iaResult.alerts_anissa.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {!loading && iaResult && (
          <div style={footerStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#888' }}>
                Pack {packPrice} CHF — Coût analyses {totalCost} CHF
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: totalMargin >= 0 ? '#2d5a3d' : '#c44' }}>
                💰 Marge : {totalMargin} CHF ({marginPct}%)
              </div>
            </div>
            <button onClick={onClose} style={btnSecondaryStyle} disabled={saving}>
              Annuler
            </button>
            <button
              onClick={handleValidate}
              style={btnPrimaryStyle}
              disabled={saving || selectedTests.length === 0}
            >
              {saving ? 'Enregistrement…' : `Valider le plan (${selectedTests.length} ${selectedTests.length > 1 ? 'analyses' : 'analyse'})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sous-composant : ligne de suggestion ───────────────────────
function SuggestionRow({ suggestion, selected, onToggle, isExtra }) {
  const s = suggestion;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: 10,
      marginBottom: 6,
      background: selected ? 'rgba(45,90,61,0.08)' : 'rgba(0,0,0,0.02)',
      border: `1px solid ${selected ? 'rgba(45,90,61,0.3)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: 6,
      cursor: 'pointer',
    }} onClick={onToggle}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
        style={{ marginTop: 4 }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>{s.display_name}</strong>
          <span style={{ fontSize: 12, color: '#666' }}>· {s.cost_anissa_chf} CHF</span>
          <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>· {s.category}</span>
          {isExtra && (
            <span style={{ fontSize: 10, color: '#888', background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4 }}>
              Ajouté
            </span>
          )}
          {!isExtra && s.pertinence_score && (
            (() => {
              // V97.11.6 : remplacer le score chiffre "X/10" par un label
              // qualitatif. Un score chiffre est lu comme une certitude
              // medicale ("10/10 = sûr"), ce qui depasse le perimetre
              // d'une nutritionniste fonctionnelle. Labels qualitatifs =
              // priorite algorithmique, moins ambigus juridiquement.
              const score = s.pertinence_score;
              const label = score >= 10 ? 'Pertinence élevée'
                : score >= 7 ? 'Pertinence modérée'
                : 'Pertinence exploratoire';
              const color = score >= 10 ? '#2d5a3d'
                : score >= 7 ? '#666'
                : '#999';
              return (
                <span style={{ fontSize: 11, color, fontWeight: 500 }}>
                  · {label}
                </span>
              );
            })()
          )}
        </div>
        <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
          {s.justification}
        </div>
      </div>
    </div>
  );
}

// ─── Styles inline (simples, sans dépendance CSS) ────────────────
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const contentStyle = {
  background: '#fff', borderRadius: 12, maxWidth: 760, width: '100%',
  maxHeight: '90vh', display: 'flex', flexDirection: 'column',
};
const headerStyle = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)',
};
const closeBtnStyle = {
  background: 'none', border: 'none', fontSize: 28, cursor: 'pointer',
  color: '#888', padding: 0, lineHeight: 1, marginLeft: 12,
};
const bodyStyle = {
  padding: 20, overflowY: 'auto', flex: 1,
};
const loadingStyle = {
  textAlign: 'center', padding: '40px 20px',
};
const errorStyle = {
  background: 'rgba(196,68,68,0.1)', color: '#c44', padding: 12,
  borderRadius: 6, marginBottom: 12,
};
const summaryStyle = {
  // V97.11.10 : couleur texte explicite pour lisibilite sur fond ivoire
  // (theme Anissa). Avant ce fix le texte heritait du gris faible du theme.
  background: 'rgba(45,90,61,0.08)',
  border: '1px solid rgba(45,90,61,0.18)',
  padding: 12, borderRadius: 6,
  fontSize: 13, marginBottom: 12,
  color: '#1a2e1f', lineHeight: 1.55,
};
const alertsStyle = {
  background: 'rgba(255,193,7,0.1)', padding: 12, borderRadius: 6,
  fontSize: 13, marginTop: 12, color: '#856404',
};
const addExtraStyle = {
  marginTop: 12, padding: 10, background: 'rgba(0,0,0,0.02)',
  borderRadius: 6, display: 'flex', alignItems: 'center', flexWrap: 'wrap',
};
const footerStyle = {
  display: 'flex', alignItems: 'center', gap: 12, padding: 16,
  borderTop: '1px solid rgba(0,0,0,0.08)',
};
const btnSecondaryStyle = {
  padding: '10px 20px', background: 'transparent', border: '1px solid #ccc',
  borderRadius: 6, cursor: 'pointer', fontSize: 13,
};
const btnPrimaryStyle = {
  padding: '10px 20px', background: '#2d5a3d', color: '#fff', border: 'none',
  borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
