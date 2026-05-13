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
  // V97.12.4 : expand/collapse des notes internes (default collapse au-dela
  // de 3 alertes pour eviter le mur de texte).
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const pack = PACK_DEFINITIONS[packType];
  const packPrice = pack?.price || 0;
  const creditChf = pack?.includedAnalysisCreditChf || 0;

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

  // ─── Calcul cout + credit flat + couverture par card ───────────
  // V97.12.3 : le credit pack (0 / 250 / 400 CHF) est applique en
  // deduction monetaire FLAT sur le total. Pour l'affichage des badges
  // "Incluse dans l'accompagnement", on identifie greedy par pertinence
  // desc les analyses ENTIEREMENT couvertes par le credit (cumul ≤ credit).
  const { totalCost, selectedTests, creditApplied, costForClient, coveredCodes } = useMemo(() => {
    const allSelected = [
      ...enrichedSuggestions.filter(s => selected[s.code]),
      ...extraTests.filter(s => selected[s.code]),
    ];
    const total = allSelected.reduce((sum, t) => sum + (t.cost_anissa_chf || 0), 0);
    const applied = Math.min(total, creditChf);

    // Greedy : trier par pertinence desc, marquer "couvertes" tant que
    // le cumul reste sous le plafond du credit.
    const covered = new Set();
    if (creditChf > 0 && allSelected.length > 0) {
      const sorted = [...allSelected].sort((a, b) => {
        const pa = a.pertinence_score || 0;
        const pb = b.pertinence_score || 0;
        return pb - pa;
      });
      let remaining = creditChf;
      for (const t of sorted) {
        const cost = t.cost_anissa_chf || 0;
        if (cost <= remaining) {
          covered.add(t.code);
          remaining -= cost;
        }
      }
    }

    return {
      totalCost: total,
      selectedTests: allSelected,
      creditApplied: applied,
      costForClient: Math.max(0, total - creditChf),
      coveredCodes: covered,
      // V97.12.1 : champ deprecate mais conserve pour compat schema BDD.
      totalMargin: packPrice - total,
    };
  }, [selected, enrichedSuggestions, extraTests, creditChf, packPrice]);

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
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: '#2d5a3d',
                  marginBottom: 6,
                }}>
                  Lecture clinique synthétique
                </div>
                <p style={{ margin: 0, color: '#1a2e1f', lineHeight: 1.65, fontSize: 14 }}>
                  {iaResult.client_summary}
                </p>
              </div>

              <h3 style={{ marginTop: 16, fontSize: 14 }}>Analyses suggérées</h3>
              <div>
                {/* V97.12.4 : la 1re suggestion avec score >= 9 (Prioritaire)
                    obtient un ribbon "ANALYSE PRIORITAIRE" + border-left
                    accentue pour que l'oeil aille directement dessus. */}
                {(() => {
                  let topPriorityFlagged = false;
                  return enrichedSuggestions.map((s) => {
                    const isTopPriority = !topPriorityFlagged && (s.pertinence_score || 0) >= 9;
                    if (isTopPriority) topPriorityFlagged = true;
                    return (
                      <SuggestionRow
                        key={s.code}
                        suggestion={s}
                        selected={!!selected[s.code]}
                        onToggle={() => toggleSelected(s.code)}
                        isCovered={coveredCodes.has(s.code)}
                        isTopPriority={isTopPriority}
                      />
                    );
                  });
                })()}
                {extraTests.map(s => (
                  <SuggestionRow
                    key={s.code}
                    suggestion={s}
                    selected={!!selected[s.code]}
                    onToggle={() => toggleSelected(s.code)}
                    isExtra
                    isCovered={coveredCodes.has(s.code)}
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

              {iaResult.alerts_anissa?.length > 0 && (() => {
                // V97.12.4 : section renommee "Notes internes Anissa".
                // Important compliance : ces notes ne doivent PAS apparaitre
                // dans les exports cliente (PDF programme, app cliente, etc.).
                // Default collapse au-dela de 3 pour eviter le mur de texte
                // sur cas complexes.
                const alerts = iaResult.alerts_anissa;
                const MAX_VISIBLE = 3;
                const hidden = Math.max(0, alerts.length - MAX_VISIBLE);
                const visible = showAllAlerts ? alerts : alerts.slice(0, MAX_VISIBLE);
                return (
                  <div style={alertsStyle}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '.1em',
                      textTransform: 'uppercase',
                      color: '#6b5018',
                      marginBottom: 4,
                    }}>
                      <span>🔒</span>
                      Notes internes Anissa
                      <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#9b7d3a', fontSize: 11 }}>
                        — non transmises à la cliente
                      </span>
                    </div>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                      {visible.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                    {hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllAlerts(v => !v)}
                        style={{
                          marginTop: 8,
                          background: 'transparent',
                          border: 'none',
                          color: '#6b5018',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        {showAllAlerts ? '— Replier' : `+ ${hidden} observation${hidden > 1 ? 's' : ''} complémentaire${hidden > 1 ? 's' : ''}`}
                      </button>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {!loading && iaResult && (
          <div style={footerStyle}>
            <div style={{ flex: 1 }}>
              {/* V97.12.2 — Credit pack applique en deduction monetaire flat
                  sur le total des analyses (peut couvrir 1 ou 2 analyses
                  selon les couts, jusqu'au plafond du credit). */}
              <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                Pack accompagnement : <strong>{packPrice} CHF</strong>
                {creditChf > 0 && (
                  <> · Crédit analyse inclus : <strong>{creditChf} CHF</strong></>
                )}
              </div>
              {selectedTests.length > 0 && (
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  Total analyses sélectionnées : <strong>{totalCost} CHF</strong>
                  {creditApplied > 0 && (
                    <span style={{ color: '#2d5a3d', fontWeight: 500 }}>
                      {' '}· ✓ Crédit appliqué : −{creditApplied} CHF
                    </span>
                  )}
                </div>
              )}
              {/* V97.12.3 : conclusion economique aeree, vraie chute du cockpit */}
              <div style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px dashed rgba(45,90,61,0.25)',
                fontSize: 19,
                fontWeight: 600,
                color: '#2d5a3d',
              }}>
                💳 Coût analyses pour la cliente : {costForClient} CHF
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
function SuggestionRow({ suggestion, selected, onToggle, isExtra, isCovered = false, isTopPriority = false }) {
  const s = suggestion;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: 10,
      marginBottom: 6,
      // V97.12.3-4 : highlight credit, border-left accent si top priority
      background: isCovered
        ? 'rgba(45,90,61,0.12)'
        : selected ? 'rgba(45,90,61,0.08)' : 'rgba(0,0,0,0.02)',
      border: `1px solid ${
        isCovered ? 'rgba(45,90,61,0.4)' :
        selected ? 'rgba(45,90,61,0.3)' : 'rgba(0,0,0,0.08)'
      }`,
      borderLeft: isTopPriority ? '3px solid #2d5a3d' : undefined,
      borderRadius: 6,
      cursor: 'pointer',
      position: 'relative',
    }} onClick={onToggle}>
      {isTopPriority && (
        <span style={{
          position: 'absolute',
          top: -8,
          left: 12,
          background: '#2d5a3d',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          lineHeight: 1.4,
        }}>
          ● Analyse prioritaire
        </span>
      )}
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
          {isCovered && (
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              background: '#2d5a3d',
              padding: '3px 9px',
              borderRadius: 4,
              letterSpacing: '.02em',
            }}>
              ✓ Incluse dans l'accompagnement
            </span>
          )}
          {!isExtra && s.pertinence_score && (
            (() => {
              // V97.12.3 : labels cliniques au lieu de "Pertinence X".
              // Avant : tout ressortait "Pertinence modérée" → effet "tout
              // se vaut". Maintenant : Prioritaire / Complémentaire /
              // Exploration secondaire — vocabulaire clinique, hierarchie
              // immediate.
              const score = s.pertinence_score;
              const label = score >= 9 ? 'Prioritaire'
                : score >= 7 ? 'Complémentaire'
                : 'Exploration secondaire';
              const color = score >= 9 ? '#2d5a3d'
                : score >= 7 ? '#5a7a4d'
                : '#999';
              const weight = score >= 9 ? 600 : 500;
              return (
                <span style={{ fontSize: 11, color, fontWeight: weight }}>
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
  // V97.12.3 : encart plus aere + titre eyebrow "Lecture clinique synthetique".
  // Avant : visuellement disabled (gris). Maintenant : presence claire avec
  // titre, fond sage subtil, contraste deep #1a2e1f.
  background: 'rgba(45,90,61,0.08)',
  border: '1px solid rgba(45,90,61,0.18)',
  padding: '14px 16px',
  borderRadius: 8,
  marginBottom: 16,
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
