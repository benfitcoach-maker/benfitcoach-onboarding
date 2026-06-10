// ─────────────────────────────────────────────────────────────────
// Phase J + L — Editeur de plan complet pour Etape 6 du parcours
// Date : 2026-05-10
//
// UI propre alignee sur le design system journey.css. Remplace l'embed
// de NutritionConsultation dans l'etape 6.
//
// Fonctionnalites V2 (Phase L) :
//   - Lecture du dernier plan (local store + Supabase fallback)
//   - Genération IA avec note libre + directives persistantes
//   - Modal d'apercu plein ecran lisible (markdown render simple)
//   - Edition markdown libre (textarea grande)
//   - Sauvegarde Supabase
//   - Export Word du plan principal
//   - Onglet Fiche frigo (build + apercu + export Word)
//   - Reformulation IA d'une selection / paragraphe
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { saveNutritionConsultation, getNutritionConsultations } from './store';
import { callClaude } from './services/anthropic';
import { trackPlanGenerated, trackPlanGenerationFailed, trackPlanModification } from './services/observability';
import { buildSystemPromptFr, buildSystemPromptFrV2 } from './services/prompts/nutrition/fr';
// V97.27 — Services anti-slop / guardrails entierement deplaces dans
// les hooks (useSlopAudit, useGuardrailsAudit) et les composants extraits
// (AntiSlopSection, GuardrailsAuditBanner). JourneyPlanEditor n'importe
// plus rien de ces services directement.
// V97.20 (OBS-1) — Tracking des generations de plans.
// V97.27 — recordSlopAction + updateSlopFlagsCount deplaces dans useSlopAudit.
import { recordPlanGeneration } from './services/planObservability';
// V97.27 (refacto) — Hooks et components extraits.
import { useSlopAudit } from './hooks/useSlopAudit';
import { useGuardrailsAudit } from './hooks/useGuardrailsAudit';
import { usePlanAutosave } from './hooks/usePlanAutosave';
import { GuardrailsAuditBanner } from './components/GuardrailsAuditBanner';
import { AntiSlopSection } from './components/AntiSlopSection';
// V97.22.3 (V97.18 Phase D) — Phase active du parcours injectee dans le composer.
import { getActivePhase, getActivePhaseWeek } from './services/protocolPhases';
// V97.4 Phase V2.B : constructeur clinicalContext depuis journey_state.
// Utilisé uniquement quand composerBeta === true (path composer opt-in).
import { buildClinicalContext } from './services/clinical/buildClinicalContext';
import { COACH_IDENTITY } from './services/coachIdentity';
import { exportPlanToWord } from './services/exportToWord';
import { structurePlanSections } from './services/planFormatters';
import { analyzeFullPlan } from './services/aiClient';
import FicheFrigoPreview from './FicheFrigoPreview';
import PremiumSwitch from './components/PremiumSwitch';

// V97.4 V3.G — Date pivot pour le rollout progressif Composer beta.
// Clientes créées >= cette date → V3 activé par défaut (markers détaillés,
// microbiomeStage, clinicalContext). Anciennes clientes restent en opt-in
// manuel pour éviter régression silencieuse sur dossiers déjà ouverts.
// → Changer cette constante avant un ON global éventuel.
const COMPOSER_BETA_DEFAULT_CUTOFF = '2026-05-12';

export default function JourneyPlanEditor({ client, onPlanSaved, controlledAiDirectives }) {
  const [tab, setTab] = useState('plan'); // 'plan' | 'fridge'
  const [planText, setPlanText] = useState('');
  const [aiDirectives, setAiDirectives] = useState('');

  // V97.13.x : sync depuis la sidebar parent (ClientJourneyPage) quand prop fournie.
  // Évite la race condition où l'éditeur a une copie stale du textarea sidebar.
  useEffect(() => {
    if (controlledAiDirectives !== undefined && controlledAiDirectives !== aiDirectives) {
      setAiDirectives(controlledAiDirectives);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledAiDirectives]);
  const [consultation, setConsultation] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(null); // 'plan' | 'fridge'
  const [showGenModal, setShowGenModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showFridgeModal, setShowFridgeModal] = useState(false);
  const [error, setError] = useState(null);
  // Phase AP : audit IA du plan
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [auditError, setAuditError] = useState(null);
  // Phase AM : auto-save debouncé (état : idle | dirty | saving | saved | error)
  // V97.27 (refacto) — Autosave debounce extrait dans usePlanAutosave.
  // Hook initialise plus bas car onSave depend de handleSave (lui-meme
  // depend des states qui sont declares apres).
  // savedToast supprimé Phase AM (remplacé par AutosaveIndicator persistant)

  // Phase Q : split en sections + IA par section
  const sections = useMemo(() => splitPlanIntoSections(planText), [planText]);
  const [aiBusy, setAiBusy] = useState(null); // { sectionIndex, action } | null
  const [aiError, setAiError] = useState(null);

  const updateSection = (index, newContent) => {
    const next = sections.map((s, i) => i === index ? { ...s, content: newContent } : s);
    setPlanText(joinSectionsIntoPlan(next));
  };
  const updateSectionTitle = (index, newTitle) => {
    const next = sections.map((s, i) => i === index ? { ...s, title: newTitle } : s);
    setPlanText(joinSectionsIntoPlan(next));
  };
  const removeSection = (index) => {
    if (!window.confirm(`Supprimer la section "${sections[index].title}" ?`)) return;
    const next = sections.filter((_, i) => i !== index);
    setPlanText(joinSectionsIntoPlan(next));
  };
  const insertSectionAfter = (index) => {
    const next = [...sections];
    next.splice(index + 1, 0, { title: 'NOUVELLE SECTION', content: '' });
    setPlanText(joinSectionsIntoPlan(next));
  };

  const loadLatest = useCallback(async () => {
    if (!client?.id) {
      setLoadingInitial(false);
      return;
    }
    setLoadingInitial(true);
    const local = getNutritionConsultations(client.id);
    if (local && local.length > 0) {
      const last = local[0];
      setConsultation(last);
      setPlanText(last.nutritionPlan || '');
      setAiDirectives(last.aiDirectives || '');
      setLoadingInitial(false);
      return;
    }
    const { data } = await supabase
      .from('nutrition_consultations')
      .select('nutrition_plan, plan_text, ai_directives, fiche_frigo_json, created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setConsultation({
        clientId: client.id,
        nutritionPlan: data.nutrition_plan || data.plan_text || '',
        aiDirectives: data.ai_directives || '',
        ficheFrigoJson: data.fiche_frigo_json || null,
        createdAt: data.created_at,
      });
      setPlanText(data.nutrition_plan || data.plan_text || '');
      setAiDirectives(data.ai_directives || '');
    }
    setLoadingInitial(false);
  }, [client?.id]);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  // ─── Reecriture IA d'une section ─────────────────────────────
  const runRewriteSection = async (sectionIndex, action) => {
    const target = sections[sectionIndex];
    if (!target || target.content.trim().length < 10) {
      setAiError('Cette section est trop courte pour une transformation IA.');
      return;
    }
    setAiBusy({ sectionIndex, action });
    setAiError(null);
    try {
      const system = REWRITE_PROMPTS[action];
      const res = await callClaude({
        system,
        user: target.content,
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4000,
      });
      const newText = typeof res === 'string' ? res : (res?.text || '').trim();
      if (!newText) throw new Error('Réponse IA vide');
      const cleaned = newText.replace(/^"|"$/g, '').trim();
      updateSection(sectionIndex, cleaned);
    } catch (e) {
      setAiError(e?.message || 'Erreur réécriture IA');
    } finally {
      setAiBusy(null);
    }
  };

  // ─── Audit IA du plan (Phase AP) ─────────────────────────────
  const handleAudit = async () => {
    if (!planText.trim()) {
      setAuditError('Aucun plan à auditer.');
      return;
    }
    setAuditing(true);
    setAuditError(null);
    setAuditResult(null);
    try {
      const result = await analyzeFullPlan(
        client.form || {},
        planText,
        '', // supplementsText : pas séparé dans cette V — inclus dans planText
        {
          locale: 'FR',
          composerProfile: null,
          aiDirectives: aiDirectives || '',
        }
      );
      if (!result) throw new Error('L\'IA n\'a pas pu produire d\'audit structuré');
      setAuditResult(result);
    } catch (e) {
      setAuditError(e?.message || 'Erreur audit IA');
    } finally {
      setAuditing(false);
    }
  };

  // ─── Sauvegarde ──────────────────────────────────────────────
  // V97.27 : autosave + indicateur state extraits dans usePlanAutosave.
  // handleSave reste ici (logique metier specifique). Le hook gere :
  //  - debounce 1.5s sur changement planText
  //  - flash 'saved' 1.8s puis retour 'idle'
  //  - markInitial pour seed lastSavedTextRef au premier load
  const handleSave = useCallback(async () => {
    setSaving(true);
    autosaveControl.markSaving();
    setError(null);
    try {
      const next = {
        ...(consultation || { clientId: client.id }),
        clientId: client.id,
        nutritionPlan: planText,
        aiDirectives,
        createdAt: consultation?.createdAt || new Date().toISOString(),
        status: 'a_valider',
        consultantName: COACH_IDENTITY?.name || 'Anissa',
      };
      await saveNutritionConsultation(next);
      setConsultation(next);
      autosaveControl.markSaved(planText);
      onPlanSaved?.();
    } catch (e) {
      setError(e?.message || 'Erreur sauvegarde');
      autosaveControl.markError();
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, consultation, planText, aiDirectives, onPlanSaved]);

  const autosaveControl = usePlanAutosave({ planText, loadingInitial, onSave: handleSave });
  const autosaveState = autosaveControl.autosaveState;

  // Initialise lastSavedTextRef au premier load via hook
  useEffect(() => {
    if (!loadingInitial && planText) {
      autosaveControl.markInitial(planText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingInitial]);

  // ─── Export Word ─────────────────────────────────────────────
  const handleExportPlan = async () => {
    setExporting('plan');
    setError(null);
    try {
      await exportPlanToWord(client, consultation || { clientId: client.id, date: new Date().toISOString() }, planText);
    } catch (e) {
      setError(e?.message || 'Erreur export Word');
    } finally {
      setExporting(null);
    }
  };

  // Sections parsees du plan pour FicheFrigoPreview (composant existant)
  const fridgeSections = useMemo(() => {
    if (!planText) return [];
    try {
      return structurePlanSections(planText, '', { isFollowup: false, locale: 'FR' });
    } catch {
      return [];
    }
  }, [planText]);

  if (loadingInitial) {
    return <div style={{ color: 'var(--jrn-text-muted)' }}>Chargement du plan…</div>;
  }

  const hasPlan = planText.trim().length > 0;

  return (
    <div>
      {/* ─── Tabs ──────────────────────────────────────────────── */}
      <div className="jpe-tabs">
        <button onClick={() => setTab('plan')} className={`jpe-tab ${tab === 'plan' ? 'jpe-tab--active' : ''}`}>
          Plan nutritionnel
        </button>
        <button onClick={() => setTab('fridge')} className={`jpe-tab ${tab === 'fridge' ? 'jpe-tab--active' : ''}`} disabled={!hasPlan}>
          Fiche frigo
        </button>
      </div>

      {/* ─── Tab : Plan ────────────────────────────────────────── */}
      {tab === 'plan' && (
        <>
          {/* BC.5G.2 : barre d'actions visible uniquement si plan existe.
              Quand pas de plan, le CTA 'Générer' est intégré dans l'empty state
              (un seul vrai bouton primaire, pas de doublon visuel). */}
          {hasPlan && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--jrn-3)',
              marginTop: 'var(--jrn-5)',
              marginBottom: 'var(--jrn-6)',
              flexWrap: 'wrap',
            }}>
              <button onClick={() => setShowGenModal(true)} className="jrn-btn jrn-btn--primary">
                ✨ Régénérer avec l'IA
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--jrn-3)', flexWrap: 'wrap' }}>
                <AutosaveIndicator state={autosaveState} />
                <button onClick={handleAudit} disabled={auditing} className="jrn-btn jrn-btn--soft" title="Audit qualité du plan par IA (cohérence, oublis, contre-indications)">
                  {auditing ? '🔎 Audit…' : '🔎 Audit qualité'}
                </button>
                <button onClick={() => setShowPreviewModal(true)} className="jrn-btn jrn-btn--ghost">
                  Aperçu
                </button>
                <button onClick={handleExportPlan} disabled={exporting === 'plan'} className="jrn-btn jrn-btn--ghost">
                  {exporting === 'plan' ? 'Export…' : 'Exporter Word'}
                </button>
              </div>
            </div>
          )}

          {!hasPlan && (
            <div className="jrn-plan-empty">
              <div className="jrn-plan-empty__icon">✦</div>
              <span className="jrn-plan-empty__version">Version initiale · non générée</span>
              <h4 className="jrn-plan-empty__title">Aucun brouillon pour le moment</h4>

              <div className="jrn-plan-empty__cols">
                {/* Colonne sources (input) */}
                <div className="jrn-plan-empty__col">
                  <p className="jrn-plan-empty__col-label">L'IA utilisera</p>
                  <ul className="jrn-plan-empty__sources">
                    <li><span className="jrn-plan-empty__check">✓</span><strong>Anamnèse</strong></li>
                    <li><span className="jrn-plan-empty__check">✓</span><strong>Analyses biologiques</strong></li>
                    <li><span className="jrn-plan-empty__check">✓</span><strong>Axes prioritaires</strong></li>
                    <li><span className="jrn-plan-empty__check">✓</span><strong>Directive IA</strong></li>
                  </ul>
                </div>

                {/* Colonne outputs (preview du brouillon) */}
                <div className="jrn-plan-empty__col">
                  <p className="jrn-plan-empty__col-label">Le brouillon contiendra</p>
                  <ul className="jrn-plan-empty__outputs">
                    <li><span className="jrn-plan-empty__dot">✦</span>Structure des repas</li>
                    <li><span className="jrn-plan-empty__dot">✦</span>Timing nutritionnel</li>
                    <li><span className="jrn-plan-empty__dot">✦</span>Supplémentation suggérée</li>
                    <li><span className="jrn-plan-empty__dot">✦</span>Recommandations lifestyle</li>
                    <li><span className="jrn-plan-empty__dot">✦</span>Fiches pratiques</li>
                  </ul>
                </div>
              </div>

              <button onClick={() => setShowGenModal(true)} className="jrn-btn jrn-btn--hero jrn-plan-empty__cta">
                ✨ Générer le premier brouillon
              </button>
            </div>
          )}

          {hasPlan && (
            <>
              {aiError && <div className="jrn-error" style={{ marginBottom: 'var(--jrn-3)' }}>⚠ {aiError}</div>}

              {/* Liste de sections editables */}
              <div className="jpe-sections">
                {sections.map((section, i) => (
                  <PlanSection
                    key={i}
                    index={i}
                    title={section.title}
                    content={section.content}
                    onTitleChange={(v) => updateSectionTitle(i, v)}
                    onContentChange={(v) => updateSection(i, v)}
                    onDelete={() => removeSection(i)}
                    onInsertAfter={() => insertSectionAfter(i)}
                    onAi={(action) => runRewriteSection(i, action)}
                    busyAction={aiBusy?.sectionIndex === i ? aiBusy.action : null}
                  />
                ))}
                {sections.length === 0 && (
                  <div className="jrn-surface jrn-surface--quiet" style={{ textAlign: 'center', padding: 'var(--jrn-8)' }}>
                    <p style={{ margin: 0, color: 'var(--jrn-text-muted)' }}>
                      Le plan n'a pas de sections (titres ##). Le contenu brut :
                    </p>
                    <textarea
                      value={planText}
                      onChange={(e) => setPlanText(e.target.value)}
                      rows={20}
                      className="jrn-textarea"
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, marginTop: 'var(--jrn-3)' }}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ─── Tab : Fiche frigo ─────────────────────────────────── */}
      {tab === 'fridge' && (
        <div style={{ marginTop: 'var(--jrn-5)' }}>
          {!hasPlan ? (
            <div className="jrn-surface jrn-surface--quiet" style={{ textAlign: 'center', padding: 'var(--jrn-10)' }}>
              <p style={{ margin: 0, color: 'var(--jrn-text-muted)' }}>
                Générez d'abord un plan nutritionnel pour construire la fiche frigo.
              </p>
            </div>
          ) : (
            <>
              <p className="jrn-step-intro" style={{ marginTop: 0, marginBottom: 'var(--jrn-4)' }}>
                Fiche frigo extraite automatiquement du plan. Cliquez ci-dessous pour ouvrir l'éditeur complet (3 vues : aperçu, édition, vue cliente) et l'export PDF.
              </p>
              <div className="jrn-actions" style={{ marginTop: 0 }}>
                <button onClick={() => setShowFridgeModal(true)} className="jrn-btn jrn-btn--primary">
                  Ouvrir l'éditeur fiche frigo
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {error && <div className="jrn-error">⚠ {error}</div>}

      {/* ─── Modals ────────────────────────────────────────────── */}
      {showGenModal && (
        <GenerationModal
          client={client}
          consultation={consultation}
          aiDirectives={aiDirectives}
          onDirectivesChange={setAiDirectives}
          onCancel={() => setShowGenModal(false)}
          onAdopt={(text, updatedDirectives) => {
            // V97.3 Phase C1 : tracking adoption plan IA (source='ai')
            // Mesure beforeLength = planText AVANT (0 si première génération,
            // ou ancien plan si régénération). afterLength = plan adopté.
            trackPlanModification({
              clientId: client?.id,
              consultationId: consultation?.id,
              section: 'global',
              source: 'ai',
              beforeLength: planText?.length || 0,
              afterLength: text?.length || 0,
            });
            setPlanText(text);
            setAiDirectives(updatedDirectives);
            setShowGenModal(false);
            // Persistance auto des directives mises a jour
            if (updatedDirectives !== aiDirectives) {
              setTimeout(() => handleSave(), 50);
            }
          }}
        />
      )}
      {showPreviewModal && (
        <PreviewModal text={planText} onClose={() => setShowPreviewModal(false)} />
      )}
      {(auditResult || auditError) && (
        <AuditModal
          result={auditResult}
          error={auditError}
          onClose={() => { setAuditResult(null); setAuditError(null); }}
        />
      )}
      {showFridgeModal && (
        <FicheFrigoPreview
          consultation={{
            ...(consultation || {}),
            nutritionPlan: planText,
            ficheFrigoJson: consultation?.ficheFrigoJson || consultation?.fiche_frigo_json || null,
            date: consultation?.createdAt || new Date().toISOString(),
          }}
          sections={fridgeSections}
          client={client}
          onClose={() => setShowFridgeModal(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Modal de génération (plein écran lisible)
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// AuditModal — Affiche le résultat de l'audit IA (Phase AP)
// ═══════════════════════════════════════════════════════════════════

function AuditModal({ result, error, onClose }) {
  const score = result?.score ?? null;
  const verdict = result?.verdict || result?.summary || '';
  const quickWins = Array.isArray(result?.quickWins) ? result.quickWins : (Array.isArray(result?.quick_wins) ? result.quick_wins : []);
  const strengths = Array.isArray(result?.strengths) ? result.strengths : [];
  const issues = Array.isArray(result?.issues) ? result.issues : [];

  const scoreColor = score == null
    ? 'var(--jrn-text-muted)'
    : score >= 80
      ? 'var(--jrn-accent)'
      : score >= 60
        ? '#8a6722'
        : 'var(--jrn-error)';

  return (
    <div className="jpe-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="jpe-modal jpe-modal--xl">
        <header className="jpe-modal__header">
          <div>
            <p className="jrn-step-eyebrow">🔎 Audit qualité du plan</p>
            <h3 className="jpe-modal__title">Revue interne par IA</h3>
          </div>
          <button onClick={onClose} className="jrn-btn jrn-btn--ghost">Fermer</button>
        </header>

        <div className="jpe-modal__body">
          {error && (
            <div className="jrn-surface jrn-surface--warn">
              <div className="jrn-label">Erreur</div>
              <p style={{ margin: '4px 0 0', color: 'var(--jrn-text)' }}>{error}</p>
            </div>
          )}

          {result && (
            <>
              {/* Score global */}
              {score != null && (
                <div className="jrn-surface" style={{ marginBottom: 'var(--jrn-5)', display: 'flex', alignItems: 'center', gap: 'var(--jrn-5)' }}>
                  <div style={{
                    fontFamily: 'var(--jrn-font-display)',
                    fontStyle: 'italic',
                    fontSize: 56,
                    fontWeight: 600,
                    color: scoreColor,
                    lineHeight: 1,
                  }}>
                    {score}<span style={{ fontSize: 20, color: 'var(--jrn-text-muted)', fontStyle: 'normal' }}>/100</span>
                  </div>
                  {verdict && (
                    <div style={{ flex: 1, fontSize: 14, color: 'var(--jrn-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {verdict}
                    </div>
                  )}
                </div>
              )}

              {/* Forces */}
              {strengths.length > 0 && (
                <div style={{ marginBottom: 'var(--jrn-5)' }}>
                  <div className="jrn-label" style={{ color: 'var(--jrn-accent)' }}>✓ Points forts ({strengths.length})</div>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.7, color: 'var(--jrn-text)' }}>
                    {strengths.map((s, i) => <li key={i}>{typeof s === 'string' ? s : s.text || s.message || JSON.stringify(s)}</li>)}
                  </ul>
                </div>
              )}

              {/* Issues */}
              {issues.length > 0 && (
                <div style={{ marginBottom: 'var(--jrn-5)' }}>
                  <div className="jrn-label" style={{ color: '#b53a3a' }}>⚠ Points à améliorer ({issues.length})</div>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.7, color: 'var(--jrn-text)' }}>
                    {issues.map((issue, i) => {
                      const text = typeof issue === 'string' ? issue : (issue.text || issue.message || issue.description || JSON.stringify(issue));
                      const severity = issue?.severity || issue?.priority;
                      return (
                        <li key={i}>
                          {text}
                          {severity && (
                            <span style={{
                              marginLeft: 6,
                              fontSize: 9,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: 'rgba(181, 58, 58, 0.1)',
                              color: '#b53a3a',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                            }}>
                              {severity}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Quick wins */}
              {quickWins.length > 0 && (
                <div style={{ marginBottom: 'var(--jrn-5)' }}>
                  <div className="jrn-label" style={{ color: '#7e5ec7' }}>✨ Quick wins suggérés par l'IA ({quickWins.length})</div>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.7, color: 'var(--jrn-text)' }}>
                    {quickWins.map((q, i) => <li key={i}>{typeof q === 'string' ? q : q.text || q.action || q.message || JSON.stringify(q)}</li>)}
                  </ul>
                </div>
              )}

              <p style={{ fontSize: 11, color: 'var(--jrn-text-muted)', marginTop: 'var(--jrn-5)', fontStyle: 'italic' }}>
                Cet audit est un assistant qualité interne. Anissa garde le dernier mot sur le contenu du plan.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Indicateur d'auto-save discret (4 états)
// ═══════════════════════════════════════════════════════════════════

function AutosaveIndicator({ state }) {
  const map = {
    idle:   { label: 'Auto-sauvegarde activée',          color: 'var(--jrn-text-muted)' },
    dirty:  { label: '● Modifications…',                  color: 'var(--jrn-warn)' },
    saving: { label: '⟳ Sauvegarde…',                     color: 'var(--jrn-text-muted)' },
    saved:  { label: '✓ Sauvegardé',                      color: 'var(--jrn-accent)' },
    error:  { label: '⚠ Erreur — réessayer',              color: 'var(--jrn-error)' },
  };
  const cur = map[state] || map.idle;
  return (
    <span style={{
      fontFamily: 'var(--jrn-font-ui)',
      fontSize: 'var(--jrn-text-xs)',
      color: cur.color,
      letterSpacing: '.02em',
      whiteSpace: 'nowrap',
    }}>
      {cur.label}
    </span>
  );
}

function GenerationModal({ client, consultation, aiDirectives, onDirectivesChange, onCancel, onAdopt }) {
  // BC.5G.6 : la directive est éditée dans la sidebar atelier (source unique).
  // À l'ouverture, on refetch la dernière directive en BDD pour être à jour
  // (la sidebar peut avoir été modifiée après le mount de JourneyPlanEditor).
  const [draftDirectives, setDraftDirectives] = useState(aiDirectives || '');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // V97.13.x : la prop `aiDirectives` vient désormais de la sidebar parent
  // (ClientJourneyPage → JourneyPlanEditor via controlledAiDirectives).
  // On re-fetch DB UNIQUEMENT si la prop est vide (fallback pour cas où le parent
  // n'a pas encore chargé). Sinon, la prop fait foi pour éviter d'écraser une
  // directive fraîchement tapée et pas encore persistée (race autosave 250ms).
  useEffect(() => {
    if (!client?.id) return;
    if (aiDirectives && aiDirectives.trim()) return; // prop a priorité
    let cancelled = false;
    (async () => {
      try {
        const { getNutritionConsultations } = await import('./store');
        const list = getNutritionConsultations(client.id) || [];
        const last = list[0];
        if (!cancelled && last?.aiDirectives) {
          setDraftDirectives(last.aiDirectives);
        }
      } catch { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, [client?.id, aiDirectives]);

  // V97.13.x : si la prop change pendant que le modal est ouvert (peu probable
  // mais possible si l'utilisateur tape encore via un autre tab), on re-sync.
  useEffect(() => {
    if (aiDirectives && aiDirectives !== draftDirectives) {
      setDraftDirectives(aiDirectives);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDirectives]);
  // Phase AN : composer beta profil-aware (digestif chronique, post-partum...)
  // Toggle persisté en localStorage par cliente. Détecte le profil clinique
  // depuis le form, injecte les modules MUST INCLUDE / INTERDITS spécifiques.
  // V97.4 V3.G — Rollout progressif "Default ON pour nouvelles clientes".
  // Décision Benoit 2026-05-12 : V3 (clinicalContext + markers + microbiomeStage)
  // activé par défaut UNIQUEMENT pour les clientes créées à partir du cutoff.
  // Les anciennes clientes restent OFF tant qu'Anissa ne coche pas explicitement
  // → évite régressions silencieuses sur dossiers en cours.
  //
  // Hiérarchie de décision (du + prioritaire au -) :
  //   1. Choix explicite stocké en localStorage (Anissa a déjà coché/décoché)
  //   2. Cliente créée ≥ cutoff → ON par défaut
  //   3. Sinon → OFF (legacy)
  const [composerBeta, setComposerBeta] = useState(() => {
    try {
      const stored = localStorage.getItem(`jpe_composer_beta_${client?.id}`);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
      // Pas de choix explicite : on regarde l'âge de la cliente.
      const created = client?.created_at;
      if (created && new Date(created) >= new Date(COMPOSER_BETA_DEFAULT_CUTOFF)) {
        return true;
      }
      return false;
    } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(`jpe_composer_beta_${client?.id}`, composerBeta ? 'true' : 'false'); } catch { /* */ }
  }, [composerBeta, client?.id]);
  const [detectedProfile, setDetectedProfile] = useState(null);
  // V97.27 (refacto) — Hook guardrails : state + preload DB + ref synchrone
  // pour audit post-gen (preserve fix race condition V97.25 HIGH-2).
  const guardrails = useGuardrailsAudit({ supabase });
  // V97.20 (OBS-1) — id de la row d'observability associee a la generation courante.
  // null tant que pas encore enregistree. Utilise pour increment compteurs slop.
  const [observabilityId, setObservabilityId] = useState(null);
  // V97.27 (refacto) — Hook anti-slop : remplace 4 useState + 4 handlers
  // inline qui faisaient ~120 lignes.
  const slop = useSlopAudit({ observabilityId });

  // V97.27 — Preload guardrails DB gere par useGuardrailsAudit hook.

  // Barre de progression estimee : asymptote vers 92% sur ~60s, puis 100% a l'arrivee.
  // L'API Claude ne stream pas la progression reelle ; on simule pour donner du feedback.
  useEffect(() => {
    if (!generating) return;
    setProgress(0);
    setElapsed(0);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const sec = (Date.now() - startTime) / 1000;
      setElapsed(sec);
      // Courbe : 0 → 92% en ~80s, asymptotique
      setProgress(92 * (1 - Math.exp(-sec / 28)));
    }, 250);
    return () => clearInterval(interval);
  }, [generating]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setResult(null);
    setDetectedProfile(null);
    guardrails.reset();
    slop.reset();
    setObservabilityId(null);
    // V97.3 Phase B : timer + capture system prompt pour observabilité
    const startedAt = Date.now();
    const MODEL = 'claude-sonnet-4-20250514';
    let systemForTracking = null;
    // V97.20 (OBS-1) — capture locale du profile (state async pas dispo a temps)
    let profileForObs = null;
    try {
      const form = client.form || {};
      const planMode = form.consultationType === 'oneshot' ? 'oneshot' : 'followup';

      // V97.18 Phase D — Extrait la phase active du parcours pour injecter
      // ses recommandations cliniques (foods_favor/limit, supplements, etc.)
      // dans le composer. Source : consultation.protocol_phases ou client.protocol_phases.
      // Best-effort : null si pas de parcours active (legacy ou pas encore demarre).
      const pp = consultation?.protocol_phases || client?.protocol_phases || null;
      const activePhaseObj = getActivePhase(pp);
      const weekInfo = activePhaseObj ? getActivePhaseWeek(pp) : null;
      const activePhase = (pp?.template && activePhaseObj?.id) ? {
        templateKey: pp.template,
        phaseId: activePhaseObj.id,
        weekNumber: weekInfo?.weekNumber,
      } : null;

      const opts = {
        isFollowup: false,
        clientFormule: client.formule || 'nutrition',
        followupWeek: 0,
        planMode,
        activePhase,
      };

      // Phase AN : choix du builder selon le toggle composer beta
      let system;
      if (composerBeta) {
        // V97.4 Phase V2.B : construit clinicalContext depuis les données
        // saisies par Anissa étape 4 (results_data) avant d'appeler le builder.
        // Best-effort : si la construction échoue, fallback clinicalContext = null
        // (le composer se comportera comme avant V2). Ne bloque jamais la génération.
        let clinicalContext = null;
        try {
          clinicalContext = buildClinicalContext({
            journeyState: client?.journey_state,
            form,
          });
        } catch (err) {
          console.warn('[clinicalContext] build failed', err);
          clinicalContext = null;
        }

        const v2 = buildSystemPromptFrV2(form, opts, { useComposer: true, clinicalContext });
        if (v2.blocked) {
          const reason = v2.profile?.blockReason || 'profil non supporté';
          // Tracking échec composer-blocked avant le throw (best-effort)
          trackPlanGenerationFailed({
            clientId: client?.id,
            model: MODEL,
            durationMs: Date.now() - startedAt,
            errorType: 'composer_blocked',
            errorMessageSafe: `profil non supporté: ${reason}`.slice(0, 200),
            composerBeta: true,
          });
          throw new Error(`Composer beta : profil "${reason}" pas encore supporté par les modules cliniques. Décochez "Composer beta" pour générer via le path classique.`);
        }
        system = v2.prompt;
        setDetectedProfile(v2.profile || null);
        profileForObs = v2.profile || null;
        // V97.27 — Stocker les guardrails actifs via le hook (audit post-gen).
        guardrails.setActiveGuardrails(v2.guardrails);
      } else {
        system = buildSystemPromptFr(form, opts);
      }
      systemForTracking = system;

      const user = buildMinimalUserMessage(client, form, draftDirectives);
      const res = await callClaude({
        system,
        user,
        model: MODEL,
        maxTokens: 16000,
      });
      setProgress(100);
      await new Promise((r) => setTimeout(r, 350));
      const responseText = typeof res === 'string' ? res : res?.text || JSON.stringify(res);
      setResult(responseText);
      onDirectivesChange?.(draftDirectives);

      // V97.27 — Audit clinique post-generation via hook (preserve fix
      // race condition V97.25 HIGH-2 grace au ref interne au hook).
      const { violations: auditViolations, completeness: auditCompleteness, guardrails: activeGuardrails }
        = guardrails.runAudit(responseText);

      // V97.20 (OBS-1) — Record generation observability (best-effort, non-bloquant)
      recordPlanGeneration({
        clientId: client?.id,
        generationDurationMs: Date.now() - startedAt,
        model: MODEL,
        composerBeta,
        profile: profileForObs,
        guardrails: activeGuardrails,
        violations: auditViolations,
        completeness: auditCompleteness,
        slopFlags: null, // pas encore audite
        planText: responseText,
      }).then((res) => {
        if (res.ok && res.id) setObservabilityId(res.id);
      });

      // V97.3 Phase B : tracking succès (best-effort, non bloquant)
      trackPlanGenerated({
        clientId: client?.id,
        model: MODEL,
        durationMs: Date.now() - startedAt,
        systemPrompt: systemForTracking,
        responseText,
        composerBeta,
        sectionsGenerated: ['plan'],
      });
    } catch (e) {
      setError(e?.message || 'Erreur génération IA');
      // V97.3 Phase B : tracking échec (sauf composer_blocked déjà tracké au-dessus)
      const msg = e?.message || '';
      if (!msg.startsWith('Composer beta :')) {
        const status = e?.status;
        let errorType = 'api_error';
        if (status === 429 || /rate.?limit/i.test(msg)) errorType = 'rate_limit';
        else if (status === 0 || /reseau|network|fetch/i.test(msg)) errorType = 'network_error';
        else if (/timeout|aborted/i.test(msg)) errorType = 'timeout';
        else if (status && status >= 500) errorType = 'server_error';
        trackPlanGenerationFailed({
          clientId: client?.id,
          model: MODEL,
          durationMs: Date.now() - startedAt,
          errorType,
          errorMessageSafe: msg.slice(0, 200),
          composerBeta,
        });
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="jpe-modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget && !generating) onCancel();
    }}>
      <div className="jpe-modal jpe-modal--xl">
        <header className="jpe-modal__header">
          <div>
            <p className="jrn-step-eyebrow">Génération IA</p>
            <h3 className="jpe-modal__title">Nouveau plan nutritionnel</h3>
          </div>
          <button onClick={onCancel} disabled={generating} className="jrn-btn jrn-btn--ghost">Fermer</button>
        </header>

        {!result && (
          <div className="jpe-modal__body">
            {/* BC.5G.6 : la directive vit dans la sidebar atelier (source unique).
                Ici on affiche juste un récap en lecture seule pour confirmer
                ce qui sera injecté dans la génération. */}
            <div className="jpe-modal-directive-recap">
              <div className="jpe-modal-directive-recap__head">
                <span className="jpe-modal-directive-recap__label">✦ Directive IA utilisée</span>
                <span className="jpe-modal-directive-recap__hint">éditable dans la sidebar atelier</span>
              </div>
              {draftDirectives ? (
                <p className="jpe-modal-directive-recap__text">{draftDirectives}</p>
              ) : (
                <p className="jpe-modal-directive-recap__empty">
                  Aucune directive personnalisée — la génération utilisera les sources standard
                  (anamnèse, objectifs, analyses). Pour orienter le ton/style, renseigne la
                  directive dans la sidebar de l'atelier.
                </p>
              )}
            </div>

            {/* Phase AN + AU : toggle Composer beta — switch premium (au lieu de checkbox) */}
            <div className="jpe-composer-beta">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <PremiumSwitch
                  checked={composerBeta}
                  onChange={setComposerBeta}
                  disabled={generating}
                  accent="#a78bfa"
                />
                <div style={{ flex: 1, cursor: generating ? 'not-allowed' : 'pointer' }} onClick={() => !generating && setComposerBeta(!composerBeta)}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#7e5ec7', display: 'flex', alignItems: 'center', gap: 8 }}>
                    ✨ Composer beta
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'rgba(167, 139, 250, 0.15)', color: '#7e5ec7', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      Profil-aware
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--jrn-text-muted)', marginTop: 6, lineHeight: 1.55 }}>
                    Identifie automatiquement le profil clinique (digestif chronique, post-partum, sèche, hormones féminines…) et injecte les modules MUST INCLUDE / INTERDITS spécifiques. Plus précis pour les profils complexes, plus long à générer.
                  </div>
                  {detectedProfile && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#7e5ec7' }}>
                      Profil identifié : <strong>{detectedProfile.name || detectedProfile.id || 'profil clinique'}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!generating && (
              <div className="jrn-actions">
                <button onClick={handleGenerate} className="jrn-btn jrn-btn--primary">
                  {composerBeta ? '✨ Lancer la génération profil-aware' : 'Lancer la génération'}
                </button>
              </div>
            )}

            {generating && (
              <div className="jpe-progress">
                <div className="jpe-progress__head">
                  <span className="jpe-progress__label">
                    {progress < 30 && 'Préparation du contexte…'}
                    {progress >= 30 && progress < 60 && 'L\'IA analyse l\'anamnèse…'}
                    {progress >= 60 && progress < 90 && 'Construction du plan nutritionnel…'}
                    {progress >= 90 && progress < 100 && 'Finalisation…'}
                    {progress >= 100 && 'Plan reçu ✓'}
                  </span>
                  <span className="jpe-progress__time">
                    {elapsed.toFixed(0)}s · {Math.round(progress)}%
                  </span>
                </div>
                <div className="jpe-progress__track">
                  <div
                    className="jpe-progress__fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="jpe-progress__hint">
                  La génération prend généralement 30 à 90 secondes. Ne fermez pas la fenêtre.
                </p>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="jpe-modal__body">
            {/* V97.x Phase 2 — Audit clinique post-génération.
                Affiche violations (phrases interdites) + complétude (micro
                manquants, évictions manquantes) si guardrails actifs. */}
            {guardrails.guardrailsState?.guardrails?.length > 0 && (
              <GuardrailsAuditBanner state={guardrails.guardrailsState} />
            )}
            {/* V97.x Phase 3-4 — Anti-slop via hook useSlopAudit (V97.27 refacto). */}
            <AntiSlopSection
              flags={slop.slopFlags}
              running={slop.slopRunning}
              rewrites={slop.slopRewrites}
              planText={result}
              onRun={() => slop.runAudit(result)}
              onRewrite={(flag) => slop.requestRewrite(flag, result)}
              onAcceptRewrite={(flag) => slop.acceptRewrite(flag, result, setResult)}
              onRefuseRewrite={(flag) => slop.refuseRewrite(flag)}
            />
            <div className="jpe-preview">
              <RenderedMarkdown text={result} />
            </div>
            <div className="jrn-actions">
              <button onClick={() => onAdopt(result, draftDirectives)} className="jrn-btn jrn-btn--primary">
                Adopter ce plan
              </button>
              <button onClick={() => { setResult(null); }} className="jrn-btn jrn-btn--soft">
                Régénérer
              </button>
              <button onClick={onCancel} className="jrn-btn jrn-btn--ghost">
                Fermer sans adopter
              </button>
            </div>
            <p style={{ marginTop: 'var(--jrn-3)', fontSize: 'var(--jrn-text-xs)', color: 'var(--jrn-text-muted)' }}>
              {result.length.toLocaleString('fr-CH')} caractères · adopter remplace le plan actuel.
            </p>
          </div>
        )}

        {error && <div className="jrn-error" style={{ padding: '0 var(--jrn-6) var(--jrn-4)' }}>⚠ {error}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Modal aperçu plein écran lisible (lecture du plan actuel)
// ═══════════════════════════════════════════════════════════════════

function PreviewModal({ text, onClose }) {
  return (
    <div className="jpe-modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="jpe-modal jpe-modal--xl">
        <header className="jpe-modal__header">
          <div>
            <p className="jrn-step-eyebrow">Aperçu</p>
            <h3 className="jpe-modal__title">Plan nutritionnel actuel</h3>
          </div>
          <button onClick={onClose} className="jrn-btn jrn-btn--ghost">Fermer</button>
        </header>
        <div className="jpe-modal__body">
          <div className="jpe-preview">
            <RenderedMarkdown text={text} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Render markdown léger (pas de lib externe)
// ═══════════════════════════════════════════════════════════════════

function RenderedMarkdown({ text }) {
  if (!text) return null;
  // Rendu minimaliste : titres / paragraphes / listes
  const lines = text.split('\n');
  const blocks = [];
  let buffer = [];
  let inList = false;

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    blocks.push({ type: 'p', content: buffer.join(' ').trim() });
    buffer = [];
  };

  lines.forEach((rawLine, i) => {
    const line = rawLine.trimEnd();
    if (line.startsWith('# ')) { flushBuffer(); inList = false; blocks.push({ type: 'h1', content: line.slice(2) }); return; }
    if (line.startsWith('## ')) { flushBuffer(); inList = false; blocks.push({ type: 'h2', content: line.slice(3) }); return; }
    if (line.startsWith('### ')) { flushBuffer(); inList = false; blocks.push({ type: 'h3', content: line.slice(4) }); return; }
    if (line.startsWith('#### ')) { flushBuffer(); inList = false; blocks.push({ type: 'h4', content: line.slice(5) }); return; }
    if (/^\s*[-*•]\s+/.test(line)) {
      flushBuffer();
      if (!inList) { blocks.push({ type: 'ul-start' }); inList = true; }
      blocks.push({ type: 'li', content: line.replace(/^\s*[-*•]\s+/, '') });
      return;
    }
    if (line === '') {
      flushBuffer();
      if (inList) { blocks.push({ type: 'ul-end' }); inList = false; }
      return;
    }
    buffer.push(line);
  });
  flushBuffer();
  if (inList) blocks.push({ type: 'ul-end' });

  // Rendu
  const out = [];
  let listItems = [];
  blocks.forEach((b, i) => {
    if (b.type === 'ul-start') { listItems = []; return; }
    if (b.type === 'li') { listItems.push(b.content); return; }
    if (b.type === 'ul-end') {
      out.push(<ul key={`ul-${i}`} className="jpe-md__ul">{listItems.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>);
      listItems = [];
      return;
    }
    if (b.type === 'h1') out.push(<h1 key={i} className="jpe-md__h1">{b.content}</h1>);
    else if (b.type === 'h2') out.push(<h2 key={i} className="jpe-md__h2">{b.content}</h2>);
    else if (b.type === 'h3') out.push(<h3 key={i} className="jpe-md__h3">{b.content}</h3>);
    else if (b.type === 'h4') out.push(<h4 key={i} className="jpe-md__h4">{b.content}</h4>);
    else if (b.type === 'p') out.push(<p key={i} className="jpe-md__p">{renderInline(b.content)}</p>);
  });
  return <div className="jpe-md">{out}</div>;
}

// Rendu inline : **gras** et *italique* basiques
function renderInline(text) {
  const parts = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const italMatch = remaining.match(/\*([^*]+)\*/);
    if (boldMatch && (!italMatch || boldMatch.index <= italMatch.index)) {
      if (boldMatch.index > 0) parts.push(remaining.slice(0, boldMatch.index));
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
    } else if (italMatch) {
      if (italMatch.index > 0) parts.push(remaining.slice(0, italMatch.index));
      parts.push(<em key={key++}>{italMatch[1]}</em>);
      remaining = remaining.slice(italMatch.index + italMatch[0].length);
    } else {
      parts.push(remaining);
      break;
    }
  }
  return parts;
}

// ═══════════════════════════════════════════════════════════════════
// User message minimaliste pour la génération
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// PlanSection — carte éditable d'une section du plan
// ═══════════════════════════════════════════════════════════════════

function PlanSection({ index, title, content, onTitleChange, onContentChange, onDelete, onInsertAfter, onAi, busyAction }) {
  const isBusy = busyAction !== null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const menuRef = useRef(null);
  const optionsRef = useRef(null);

  // V97.13.9 : signal UX — section "Fiche frigo" est extraite et exportée
  // en docx séparé (V92.6) via le bouton "Ouvrir l'éditeur fiche frigo".
  // Elle n'apparaîtra PAS dans le Word principal du plan. Anissa doit savoir
  // que cette section a un comportement spécial pour éviter la confusion
  // "où est passée la section 5 dans le Word ?".
  const isFridgeSection = /fiche\s*frigo|^\s*frigo\b/i.test(title || '');

  // Close menus on outside click
  useEffect(() => {
    if (!menuOpen && !optionsOpen) return;
    const handler = (e) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (optionsOpen && optionsRef.current && !optionsRef.current.contains(e.target)) setOptionsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, optionsOpen]);

  const canRunAi = !isBusy && content && content.trim().length >= 10;

  return (
    <div className={`jpe-section${isFridgeSection ? ' jpe-section--fridge' : ''}`}>
      {isFridgeSection && (
        <div className="jpe-section__notice" role="note">
          <span className="jpe-section__notice-icon" aria-hidden="true">ℹ️</span>
          <span>
            <strong>Section exportée séparément.</strong>{' '}
            Cette Fiche Frigo sera exclue du Word principal et générée en
            <em> .docx indépendant</em> (à imprimer + plastifier) via l'onglet
            <em> Fiche frigo</em> ci-dessus.
          </span>
        </div>
      )}
      <header className="jpe-section__head">
        <span className="jpe-section__num">{index + 1}</span>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="jpe-section__title"
          placeholder="Titre de la section"
        />
        {/* Menu options : "..." discret au lieu des 2 boutons + et 🗑 toujours visibles */}
        <div ref={optionsRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setOptionsOpen((o) => !o)}
            className="jpe-section__icon-btn"
            title="Options de la section"
            aria-label="Options"
            style={{ fontSize: 16, lineHeight: 1, paddingBottom: 4 }}
          >
            ⋯
          </button>
          {optionsOpen && (
            <div className="jpe-menu jpe-menu--right">
              <button onClick={() => { onInsertAfter(); setOptionsOpen(false); }} className="jpe-menu__item">
                ＋ Ajouter une section après
              </button>
              <button onClick={() => { onDelete(); setOptionsOpen(false); }} className="jpe-menu__item jpe-menu__item--danger">
                🗑 Supprimer cette section
              </button>
            </div>
          )}
        </div>
      </header>

      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        rows={Math.max(6, Math.min(20, (content || '').split('\n').length + 1))}
        className="jpe-section__textarea jpe-section__textarea--readable"
        placeholder="Contenu de la section…"
      />

      <footer className="jpe-section__footer">
        <span className="jpe-section__ai-label">
          {isBusy ? `✨ ${REWRITE_LABELS[busyAction]}…` : 'Réécriture IA disponible'}
        </span>
        {/* Menu IA déroulant : 1 seul bouton au lieu de 4 actions inline */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            disabled={!canRunAi}
            className="jrn-btn jrn-btn--soft"
            style={{ padding: '6px 14px', fontSize: 12 }}
            title={canRunAi ? 'Choisir une action IA' : 'Section trop courte pour l\'IA (min 10 caractères)'}
          >
            ✨ IA ▾
          </button>
          {menuOpen && (
            <div className="jpe-menu jpe-menu--right">
              {Object.entries(REWRITE_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { onAi(key); setMenuOpen(false); }}
                  disabled={isBusy}
                  className="jpe-menu__item"
                  title={REWRITE_HELP[key]}
                >
                  {label}
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--jrn-text-muted)', marginTop: 2, fontWeight: 400 }}>
                    {REWRITE_HELP[key]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Split / Join : convertit markdown ↔ sections
// ═══════════════════════════════════════════════════════════════════

function splitPlanIntoSections(text) {
  if (!text || !text.trim()) return [];
  const lines = text.split('\n');
  const sections = [];
  let current = null;
  let preamble = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)$/);
    if (headerMatch) {
      if (current) sections.push(current);
      current = { title: headerMatch[1].trim(), content: '' };
    } else if (current) {
      current.content += (current.content ? '\n' : '') + line;
    } else {
      preamble.push(line);
    }
  }
  if (current) sections.push(current);

  // Si du contenu existe avant le 1er ##, on le met en section "Préambule"
  const preambleText = preamble.join('\n').trim();
  if (preambleText) {
    sections.unshift({ title: 'PRÉAMBULE', content: preambleText });
  }

  // Trim each section content
  return sections.map((s) => ({
    title: s.title,
    content: s.content.replace(/^\n+/, '').replace(/\n+$/, ''),
  }));
}

function joinSectionsIntoPlan(sections) {
  return sections
    .map((s) => `## ${s.title}\n\n${s.content}`.trim())
    .join('\n\n');
}

// ═══════════════════════════════════════════════════════════════════
// Réécriture IA — actions disponibles + prompts dédiés
// ═══════════════════════════════════════════════════════════════════

const REWRITE_LABELS = {
  rewrite:     'Reformuler pro',
  simplify:    'Simplifier',
  adapt:       'Adapter cliente',
  actionnable: 'Rendre actionnable',
};
const REWRITE_HELP = {
  rewrite:     'Reformuler le passage avec un style fluide et professionnel',
  simplify:    'Raccourcir et alléger le passage tout en gardant les recommandations clés',
  adapt:       'Adapter le ton pour la cliente (vouvoiement bienveillant, vocabulaire grand public)',
  actionnable: 'Transformer en liste d\'actions concrètes et exécutables',
};
const REWRITE_BASE = `Tu es Anissa Deroubaix, nutritionniste fonctionnelle suisse. Tu reécris un passage d'un programme nutritionnel.

RÈGLES STRICTES :
- Conserve EXACTEMENT les dosages, posologies, marques, nombres, doses et noms de compléments
- Conserve la structure markdown (titres, listes, gras)
- Réponds UNIQUEMENT avec le passage transformé — aucune introduction, aucun commentaire, aucune guillemets
- Ne change PAS le sens médical / nutritionnel du passage`;

const REWRITE_PROMPTS = {
  rewrite: `${REWRITE_BASE}

ACTION : reformuler avec un style plus fluide et professionnel. Garder la même longueur approximative.`,
  simplify: `${REWRITE_BASE}

ACTION : simplifier et raccourcir le passage. Garder uniquement l'essentiel des recommandations. Phrases plus courtes, vocabulaire plus accessible.`,
  adapt: `${REWRITE_BASE}

ACTION : adapter le ton pour la cliente — vouvoiement chaleureux et bienveillant, vocabulaire grand public, ton encourageant. Garder le contenu mais le rendre humain et personnel.`,
  actionnable: `${REWRITE_BASE}

ACTION : transformer en liste d'actions concrètes et exécutables avec des verbes d'action clairs. Format : puces avec verbes à l'infinitif (ex: "Boire 1L d'eau au réveil"). Garder dosages et marques exacts.`,
};

function buildMinimalUserMessage(client, form, directives) {
  const journey = client.journey_state || {};
  const lines = [];

  // ─── Profil ─────────────────────────────────────────────────
  lines.push(`Profil cliente : ${form.prenom || 'Cliente'}, ${form.sexe || 'genre non renseigné'}`);
  if (form.dateNaissance) lines.push(`Date de naissance : ${form.dateNaissance}`);
  if (form.poids) lines.push(`Poids : ${form.poids}`);
  if (form.taille) lines.push(`Taille : ${form.taille}`);
  if (form.objectifs) lines.push(`\nObjectifs : ${form.objectifs}`);
  if (form.symptomes) lines.push(`Symptomes : ${form.symptomes}`);
  if (form.pathologies) lines.push(`Pathologies : ${form.pathologies}`);
  if (form.allergies) lines.push(`Allergies/intolérances : ${form.allergies}`);
  if (form.activite) lines.push(`Activité : ${form.activite}`);
  if (form.sommeil) lines.push(`Sommeil : ${form.sommeil}`);
  if (form.stress) lines.push(`Stress : ${form.stress}`);
  if (form.digestion) lines.push(`Digestion : ${form.digestion}`);

  // ─── Résultats analyses (Phase R : structure étendue) ───────
  // On envoie le détail brut + les notes Anissa pour chaque analyse,
  // PUIS la synthèse globale. L'IA dispose donc de la donnée + l'interprétation.
  const rd = journey.results_data;
  if (rd) {
    const fromPlan = Array.isArray(rd.from_plan) ? rd.from_plan.filter((r) => r.value || r.synthesis) : [];
    const external = Array.isArray(rd.external) ? rd.external.filter((r) => r.name && (r.value || r.synthesis)) : [];

    if (fromPlan.length > 0) {
      lines.push(`\n--- Résultats des analyses prescrites ---`);
      fromPlan.forEach((r) => {
        lines.push(`\n[${r.test_name || r.test_code}]`);
        if (r.value) lines.push(`Valeurs : ${r.value}`);
        if (r.synthesis) lines.push(`Notes Anissa : ${r.synthesis}`);
      });
    }

    if (external.length > 0) {
      lines.push(`\n--- Analyses externes (déjà détenues par la cliente) ---`);
      external.forEach((r) => {
        lines.push(`\n[${r.name}]`);
        if (r.value) lines.push(`Valeurs : ${r.value}`);
        if (r.synthesis) lines.push(`Notes Anissa : ${r.synthesis}`);
      });
    }

    if (rd.global_synthesis && rd.global_synthesis.trim()) {
      lines.push(`\n--- Synthèse globale Anissa (priorité analytique) ---\n${rd.global_synthesis.trim()}`);
    }
  } else if (journey.results_synthesis) {
    // Fallback pour les clientes pré-Phase R (juste un texte synthese)
    lines.push(`\n--- Synthèse résultats analyses ---\n${journey.results_synthesis}`);
  }

  // ─── Directives Anissa (priorité maximale) ──────────────────
  if (directives && directives.trim()) {
    lines.push(`\n--- Directives Anissa (priorité maximale) ---\n${directives.trim()}`);
  }

  lines.push(`\nGénère le plan nutritionnel personnalisé complet (sections 1 à 7) avec menus variés, listes de courses par semaine, et alternatives naturelles. Tiens compte des résultats analyses ci-dessus pour cibler les déficits et axes prioritaires.`);
  return lines.join('\n');
}

