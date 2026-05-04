import { useState, useEffect, useRef, useMemo } from 'react';
import { getClient, getNutritionConsultations, savePlanVersion, getPlanVersions, saveClient, saveDraft, loadDraft, clearDraft, softDeleteConsultation } from './store';
// V94.26 : helpers de scoring extraits depuis ce fichier (refactor Phase 1.A)
import { scorePlanQuality, shouldAutoCorrect, buildCorrectionPrompt, validatePlanForPDF, cleanPlanForPDF } from './services/nutritionScoring';
// V94.27 : helpers clinical profile extraits depuis ce fichier (refactor Phase 1.B)
import { formatDate, detectSymptomsFromForm, buildPreRdvSummary, buildLabSectionForPlan, buildClinicalSummary, suggestStatus, buildRecommendedBloodTests } from './services/clinicalProfile';
// V94.28 : learning signal store extrait (Phase 1.C)
import { buildLearningSignal, saveLearningSignal, getLearningInsights } from './services/learningStore';
// V94.29 : plan formatters extraits (Phase 1.D)
import { structurePlanSections } from './services/planFormatters';
// V79 : Copilot IA — routing + insertion des quickWins dans le plan
import { routeQuickWin, insertWinIntoPlan, sectionLabel, failureMessage } from './services/planCopilot';
// V80 : detection du mode one-shot vs followup depuis client.packType
import { getNutritionPlanMode, planModeLabel } from './services/nutritionPlanMode';
// V81 : modale de confirmation reutilisable (remplace window.confirm natif)
import { useConfirmDialog, ConfirmDialog } from './components/ConfirmDialog';
// V82 : mini-TOC flottant pour naviguer dans le plan
import NutritionPlanTOC from './components/NutritionPlanTOC';
// V96.20 : cockpit guide-Anissa (4 macro-etapes Preparer/Generer/Affiner/Livrer)
import PlanCockpit from './components/PlanCockpit';
import { supabase, isCloudEnabled } from './supabaseClient';
import { FORMULES } from './formSteps';
// V92.1 : NutritionTemplates supprime — feature non utilisee
import NutritionEditor from './NutritionEditor';
import FicheFrigoPreview from './FicheFrigoPreview';
import MedicalSummary from './MedicalSummary';
import FollowUpStep, { buildFollowupSummary } from './FollowUpStep';
// V76 : extractFridgeDataFromSections / extractMeals / extractSupplements retires (utilises seulement dans la modale Apercu PDF supprimee)
// V92.1 : exportCoverPDF retire (Word gere sa cover). Autres exports conserves pour rétrocompat.
// V94.1 : ⚠️ jsPDF est legacy / fallback only — Word V92+ est le path principal pour le plan
// alimentaire (peaufinage Anissa + PDF natif Word 1 clic). jsPDF reste utilise pour :
//   - exportFicheFrigoPDF : modal Fiche Frigo (V92.8 — design pixel-perfect a plastifier)
//   - exportClientPackPDF : bouton Dossier complet
//   - exportConsultationPDF : page History (re-telecharger ancien plan)
//   - buildConsultationPdfBlob : import dormant (V94 nettoyage modal Finaliser)
import { exportConsultationPDF, exportFicheFrigoPDF, exportClientPackPDF, buildConsultationPdfBlob } from './nutritionPdf';
// V91.0 : detectSectionType depuis le canonical (remplace classifySection local)
import { detectSectionType } from './services/nutritionParsers';
// V92.0 : export Word natif (Anissa peaufine dans Word puis exporte PDF)
import { exportPlanToWord } from './services/exportToWord';
// V97.0 : centralisation des appels Claude (anciennement 5 fetches inline)
import { callClaude } from './services/anthropic';
import ClientAppPreviewModal from './ClientAppPreviewModal';
import ClientFeedbacksPanel from './ClientFeedbacksPanel';
import ClientAppSettingsCard from './ClientAppSettingsCard';
// V94.41 → V94.48 : hub complet app cliente (vue d'ensemble, lettre, recettes,
// messages, ressources, signaux). Centralise tout ce qui touche a l'experience
// digitale, separe du peaufinage du plan textuel.
import ClientAppPanel from './ClientAppPanel';
// V94.42/V94.47 : RecipesTab + IntroLetterTab sont importes par ClientAppPanel
// directement (sous-onglets internes). Plus d'import direct ici.
import { buildSuggestions, getScoreColor, getScoreLabel } from './services/planAnalysis';
import { analyzeFullPlan, postProcess, stripPlanLeakage } from './services/aiClient';
// V96.31 — optimizeSection / optimizeAllSections retires (Mode Expert supprime).
// aiPlanOptimizer.js conserve adaptPlanFromReview / adaptPlanForReturn utilises
// par CycleReviewPanel.jsx + App.jsx (handleAdaptPlan / handleReturnPlan).
import { ANISSA_IDENTITY_CORE, ADJUSTMENT_RULE } from './services/prompts/nutrition/identity.fr';
// V86.6 : prompts EN isoles pour clientes Benfitcoach anglophones.
import {
  buildSystemPromptEn,
  buildSupplementsSystemPromptEn,
  SUPPLEMENTS_INSTRUCTION_EN,
  AUDIT_PROMPT_EN,
} from './services/prompts/nutrition/en';
// V96.10 : prompts FR maintenant dans services/prompts/nutrition/fr.js
// (Phase 3.A du refactor composer terminee — arbo finale). Etape 3.B a venir :
// modules par profil clinique (femmeCycle, menopause, pathologies, grossesse,
// vege) + composer qui les assemble selon clinicalProfile(client).
import {
  buildSystemPromptFr,
  buildSystemPromptFrV2,
  buildSupplementsSystemPromptFr,
  SUPPLEMENTS_INSTRUCTION_FR,
  AUDIT_PROMPT_FR,
} from './services/prompts/nutrition/fr';
import { getClientNutritionLocale } from './services/nutritionLocale';
import { GENE_CATALOG, buildGeneticSectionForPrompt, getActiveGeneticAdjustments } from './services/geneticInterpretation';
import { SmartTextarea } from './KeywordHints';
import ContraIndicationAlert, { detectContraIndications } from './ContraIndicationAlert';
import { getEnrichedMGDRecommendations } from './mgdAnalysisMatrix';
// V94.27 : analyzeAnamnese maintenant utilise via clinicalProfile.js (buildRecommendedBloodTests)
import { analyzeLabResults } from './labInterpretationEngine';
import { buildMGDCorrelation, formatCorrelationForPrompt } from './mgd/mgdCorrelation';

// ─── PROMPT DISPATCHERS (FR/EN routing) ───
// V96.10 : prompts FR + EN dans services/prompts/nutrition/{fr,en}.js
// (Phase 3.A finie). Ce fichier ne garde que les dispatchers de routing FR/EN,
// qui passeront dans un composer dedie a la Phase 3.B avec les modules profil.

// V96.13 : 4e param `useComposer` (default false). Quand true ET cliente FR,
// route vers buildSystemPromptFrV2 qui peut injecter des modules profil
// (femmeCycle, perimenopause, menopause, diabete, digestifChronique,
// clostridiumDifficile). Retourne TOUJOURS un objet { prompt, profile, blocked }
// pour que le caller puisse afficher l'info profil ET bloquer la generation
// si profil non supporte (grossesse / allaitement).
function buildSystemPrompt(form, opts = {}, client = null, useComposer = false) {
  if (client && getClientNutritionLocale(client) === 'EN') {
    return { prompt: buildSystemPromptEn(form, opts), profile: null, blocked: false };
  }
  if (useComposer) {
    return buildSystemPromptFrV2(form, opts, { useComposer: true });
  }
  return { prompt: buildSystemPromptFr(form, opts), profile: null, blocked: false };
}

function buildSupplementsSystemPrompt(client = null) {
  if (client && getClientNutritionLocale(client) === 'EN') {
    return buildSupplementsSystemPromptEn();
  }
  return buildSupplementsSystemPromptFr();
}

// ─── WEEKLY FEEDBACK CONFIG (UI, conserve ici) ───

const INITIAL_WEEKLY_FEEDBACK = {
  energy: '',
  digestion: '',
  hunger: '',
  adherence: '',
  performance: '',
  cravings: '',
  notes: '',
};

// ─── PLAN QUALITY SCORING ───

// V94.26 : scorePlanQuality extraite vers services/nutritionScoring.js

// V53 : Score display unifie — UX simplifiee (1 seul bloc)
// Affiche un resume (OK / a ameliorer) avec details on-demand + audit IA integre
function PlanQualityScore({ score, autoCorrected, aiAnalysis, analyzing, aiAnalysisError, onAnalyze, planSignatureCurrent, analysesError, onInsertQuickWin, onRevisitWin, insertedWinsMap }) {
  // Hooks must be unconditional — move them before the early return
  const [showDetails, setShowDetails] = useState(false);
  if (!score) return null;

  const getColor = (val, max = 10) => {
    const pct = val / max;
    if (pct >= 0.8) return '#2a9d5c';
    if (pct >= 0.6) return '#e8a040';
    return '#d45c4c';
  };

  // Compter les problemes a afficher
  const issuesCount = (score.hardFails?.length || 0) + (score.penalties?.length || 0);
  const isHealthy = !score.hasHardFail && score.normalized >= 8;
  const isWarning = !score.hasHardFail && score.normalized >= 6 && score.normalized < 8;

  const axes = [
    { key: 'coherence', label: 'Coherence', desc: 'Allergies, macros, contradictions, ton' },
    { key: 'simplicity', label: 'Simplicite', desc: 'Mots, lignes, nb supplements' },
    { key: 'applicability', label: 'Applicabilite', desc: 'Quantites, structure, sections, fiche frigo' },
    { key: 'constraints', label: 'Contraintes', desc: 'Pathologies, sport, profil client' },
  ];

  // Stale detection pour audit IA
  const isStale = aiAnalysis?.planSignature && aiAnalysis.planSignature !== planSignatureCurrent;

  // Couleur du bandeau principal
  const bannerColor = isHealthy
    ? { bg: 'rgba(42,157,92,.08)', border: 'rgba(42,157,92,.3)', text: '#5fbd82' }
    : isWarning
    ? { bg: 'rgba(232,160,64,.08)', border: 'rgba(232,160,64,.3)', text: '#e8a040' }
    : { bg: 'rgba(212,92,76,.08)', border: 'rgba(212,92,76,.3)', text: '#e57c6c' };

  return (
    <div style={{
      background: bannerColor.bg,
      border: `1px solid ${bannerColor.border}`,
      borderRadius: 12, padding: '12px 16px', marginBottom: 16,
    }}>
      {/* BANDEAU RESUME */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.1rem' }}>
            {isHealthy ? '✅' : isWarning ? '⚠️' : '🚫'}
          </span>
          <div>
            <div style={{ fontSize: '.85rem', fontWeight: 700, color: bannerColor.text }}>
              {isHealthy ? 'Plan pret a envoyer'
                : score.hasHardFail ? 'Echec critique — revoir le plan'
                : `Plan a ameliorer — ${issuesCount} point${issuesCount > 1 ? 's' : ''} a corriger`}
            </div>
            <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
              {autoCorrected && '✨ Auto-corrige · '}
              Qualite {score.normalized}/10
              {aiAnalysis?.analyzedAt && !isStale && ` · Audit IA : ${(aiAnalysis.score / 10).toFixed(1)}/10`}
              {aiAnalysis && isStale && ' · ⚠ Audit IA obsolete'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {!isHealthy && (
            <button
              type="button"
              onClick={() => setShowDetails(s => !s)}
              style={{
                padding: '5px 12px', borderRadius: 7,
                border: '1px solid rgba(255,255,255,.15)',
                background: 'rgba(255,255,255,.04)',
                color: 'rgba(255,255,255,.65)', cursor: 'pointer',
                fontSize: '.72rem', fontWeight: 600,
              }}
            >
              {showDetails ? 'Masquer' : 'Voir details'}
            </button>
          )}
          <button
            type="button"
            disabled={analyzing}
            onClick={onAnalyze}
            style={{
              padding: '5px 12px', borderRadius: 7,
              border: '1px solid rgba(124,92,191,.35)',
              background: 'rgba(124,92,191,.12)',
              color: '#b89ef0', cursor: analyzing ? 'wait' : 'pointer',
              fontSize: '.72rem', fontWeight: 600,
              opacity: analyzing ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            {analyzing ? '✨ Analyse...' : aiAnalysis ? '🔁 Re-analyser IA' : '🔬 Analyser avec IA'}
          </button>
        </div>
      </div>

      {/* DETAILS RULES-BASED (toggle) */}
      {showDetails && !isHealthy && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,.08)',
        }}>
          <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#e8a040', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.3px' }}>
            🔧 Ajustements necessaires
          </div>

          {score.hasHardFail && (
            <div style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(212,92,76,.08)', border: '1px solid rgba(212,92,76,.2)', borderRadius: 7, fontSize: '.75rem', color: '#e57c6c' }}>
              <strong>Echec critique :</strong> {score.hardFails.join(' · ')}
            </div>
          )}

          {score.penalties.length > 0 && (
            <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.6)', lineHeight: 1.5, marginBottom: 10 }}>
              {score.penalties.map((p, i) => (
                <div key={i}>• {p}</div>
              ))}
            </div>
          )}

          {/* Mini-grid des 4 axes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginTop: 8 }}>
            {axes.map(({ key, label }) => (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', fontSize: '.7rem',
                padding: '4px 8px', borderRadius: 5,
                background: 'rgba(255,255,255,.03)',
              }}>
                <span style={{ color: 'rgba(255,255,255,.6)' }}>{label}</span>
                <span style={{ color: getColor(score[key]), fontWeight: 700 }}>{score[key]}/10</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AUDIT IA (affiche si analyse disponible) */}
      {aiAnalysisError && !aiAnalysis && (
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: 'rgba(248,113,113,.08)',
          border: '1px solid rgba(248,113,113,.25)',
          borderRadius: 7, fontSize: '.75rem', color: '#f87171',
        }}>
          ⚠️ {aiAnalysisError}
        </div>
      )}

      {aiAnalysis && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#b89ef0', textTransform: 'uppercase', letterSpacing: '.3px' }}>
              🔬 Audit IA
            </span>
            <span style={{
              fontSize: '.82rem', fontWeight: 700,
              color: aiAnalysis.score >= 80 ? '#5fbd82' : aiAnalysis.score >= 60 ? '#e8a040' : '#e57c6c',
            }}>
              {(aiAnalysis.score / 10).toFixed(1)}/10
            </span>
            {isStale && (
              <span style={{
                fontSize: '.6rem', fontWeight: 700,
                padding: '2px 7px', borderRadius: 10,
                background: 'rgba(232,160,64,.18)',
                color: '#e8a040',
              }}>
                ⚠ OBSOLETE
              </span>
            )}
          </div>

          {aiAnalysis.verdict && (
            <div style={{ fontSize: '.75rem', fontStyle: 'italic', color: 'rgba(255,255,255,.6)', marginBottom: 8 }}>
              « {aiAnalysis.verdict} »
            </div>
          )}

          {aiAnalysis.strengths?.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: '.65rem', fontWeight: 700, color: '#5fbd82', marginBottom: 2 }}>✔ POINTS FORTS</div>
              {aiAnalysis.strengths.slice(0, 3).map((s, i) => (
                <div key={i} style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.55)', marginLeft: 8, lineHeight: 1.35 }}>• {s}</div>
              ))}
            </div>
          )}

          {aiAnalysis.issues?.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: '.65rem', fontWeight: 700, color: '#e8a040', marginBottom: 2 }}>⚠ A AMELIORER</div>
              {aiAnalysis.issues.slice(0, 4).map((issue, i) => (
                <div key={i} style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.55)', marginLeft: 8, lineHeight: 1.35 }}>• {issue}</div>
              ))}
            </div>
          )}

          {aiAnalysis.quickWins?.length > 0 && (
            <div>
              <div style={{ fontSize: '.65rem', fontWeight: 700, color: '#b89ef0', marginBottom: 4 }}>💡 CORRECTIONS RAPIDES</div>
              {aiAnalysis.quickWins.slice(0, 5).map((win, i) => {
                const routed = routeQuickWin(win);
                const target = routed ? sectionLabel(routed) : null;
                const inserted = insertedWinsMap && insertedWinsMap[win]; // V79.3
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', gap: 8, alignItems: 'flex-start',
                      fontSize: '.72rem', color: 'rgba(255,255,255,.65)',
                      marginLeft: 4, marginBottom: 6, lineHeight: 1.4,
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      • {win}
                      {target && (
                        <span style={{
                          fontSize: '.62rem', color: inserted ? '#5fbd82' : '#b89ef0',
                          marginLeft: 6, letterSpacing: '.5px',
                          background: inserted ? 'rgba(95,189,130,.12)' : 'rgba(184,158,240,.1)',
                          padding: '1px 6px', borderRadius: 4,
                          whiteSpace: 'nowrap',
                        }}>
                          → {target}
                        </span>
                      )}
                    </span>
                    {inserted && onRevisitWin ? (
                      <button
                        type="button"
                        onClick={() => onRevisitWin(win)}
                        title={`Voir dans ${sectionLabel(inserted)}`}
                        style={{
                          flexShrink: 0,
                          padding: '3px 10px', borderRadius: 6,
                          border: '1px solid rgba(95,189,130,.4)',
                          background: 'rgba(95,189,130,.12)',
                          color: '#5fbd82',
                          fontSize: '.68rem', fontWeight: 600,
                          cursor: 'pointer', transition: 'all .15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(95,189,130,.22)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(95,189,130,.12)'}
                      >
                        ✓ Revoir
                      </button>
                    ) : onInsertQuickWin && (
                      <button
                        type="button"
                        onClick={() => onInsertQuickWin(win)}
                        disabled={!routed}
                        title={routed ? `Insérer dans ${target}` : 'Aucune section cible détectée'}
                        style={{
                          flexShrink: 0,
                          padding: '3px 10px', borderRadius: 6,
                          border: '1px solid ' + (routed ? 'rgba(184,158,240,.4)' : 'rgba(255,255,255,.1)'),
                          background: routed ? 'rgba(184,158,240,.12)' : 'rgba(255,255,255,.03)',
                          color: routed ? '#c4aff2' : 'rgba(255,255,255,.25)',
                          fontSize: '.68rem', fontWeight: 600,
                          cursor: routed ? 'pointer' : 'not-allowed',
                          transition: 'all .15s',
                        }}
                        onMouseEnter={e => { if (routed) e.currentTarget.style.background = 'rgba(184,158,240,.22)'; }}
                        onMouseLeave={e => { if (routed) e.currentTarget.style.background = 'rgba(184,158,240,.12)'; }}
                      >
                        ↳ Insérer
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// V94.26 : shouldAutoCorrect + buildCorrectionPrompt extraits vers services/nutritionScoring.js

// V94.28 : LEARNING_LOG_KEY + buildLearningSignal + saveLearningSignal + getLearningInsights extraits vers services/learningStore.js

// V94.26 : validatePlanForPDF + cleanPlanForPDF extraites vers services/nutritionScoring.js

// V94.29 : SUPPLEMENT_NAME_RE + isLikelySupplementName + structurePlanSections extraits vers services/planFormatters.js

// V91.0 : classifySection (FR-style, 16 types) supprimee.
// detectSectionType (canonical, services/nutritionParsers.js) prend le relais.
// Le PDF switch attend les types EN-style (profile/protocol/coach/...) et tombait
// auparavant en default sur les types FR (analyse/principes/protocoles/...).
// Resultat : sections desormais correctement typees → rendu specialise au lieu
// du fallback generique.

// V76 : NutritionPdfBody + renderSectionContent + renderLine supprimes.
// Ces helpers rendaient l'apercu HTML du PDF dans la modale Apercu PDF (retiree).
// L'editeur premium (NutritionEditor + nutritionEditorParsers) remplit deja ce role.

// ─── QUALITY DASHBOARD ───

function NutritionQualityDashboard() {
  const insights = getLearningInsights();
  if (!insights || insights.total === 0) {
    return (
      <div style={{ background: '#F5F2EC', borderRadius: 10, padding: '16px 20px', marginTop: 12, fontSize: '.82rem', color: '#4A4A42' }}>
        Aucune donnee de generation disponible.
      </div>
    );
  }

  const { total, avgScoreInitial, avgScoreFinal, autoCorrectionRate, initialHardFailRate, finalHardFailRate, topPenalties, profilePatterns } = insights;

  const getColor = (val, good, bad) => val >= good ? '#2a9d5c' : val >= bad ? '#e8a040' : '#d45c4c';

  const MetricCard = ({ label, value, suffix, good, bad }) => (
    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: good != null ? getColor(typeof value === 'number' ? value : 0, good, bad) : '#1A2E1F' }}>
        {value}{suffix || ''}
      </div>
      <div style={{ fontSize: '.7rem', color: '#8a8a7a', marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ background: '#F5F2EC', borderRadius: 10, padding: '20px 24px', marginTop: 12, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <strong style={{ fontSize: '.9rem', color: '#1A2E1F' }}>Historique qualite IA (toutes generations)</strong>
        <span style={{ fontSize: '.7rem', color: '#8a8a7a' }}>{total} generation{total > 1 ? 's' : ''}</span>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <MetricCard label="Score initial moyen" value={avgScoreInitial} suffix="/10" good={7} bad={5} />
        <MetricCard label="Score final moyen" value={avgScoreFinal} suffix="/10" good={7} bad={5} />
        <MetricCard label="Taux auto-correction" value={autoCorrectionRate} suffix="%" good={80} bad={100} />
        <MetricCard label="Hard fail initial" value={initialHardFailRate} suffix="%" good={0} bad={10} />
      </div>

      {/* Hard fail resolution */}
      {initialHardFailRate > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '.78rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#4A4A42' }}>Hard fails resolus par auto-correction</span>
            <span style={{ fontWeight: 700, color: finalHardFailRate < initialHardFailRate ? '#2a9d5c' : '#d45c4c' }}>
              {initialHardFailRate}% → {finalHardFailRate}%
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(26,46,31,.08)', borderRadius: 4 }}>
            <div style={{ height: '100%', width: `${100 - finalHardFailRate}%`, background: '#2a9d5c', borderRadius: 4 }} />
          </div>
        </div>
      )}

      {/* Top penalties */}
      {topPenalties.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '.78rem', fontWeight: 600, color: '#1A2E1F', marginBottom: 6 }}>Top problemes detectes</div>
          {topPenalties.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(26,46,31,.06)', fontSize: '.76rem' }}>
              <span style={{ color: '#4A4A42', flex: 1 }}>{p.penalty}</span>
              <span style={{ color: '#8a8a7a', marginLeft: 8, flexShrink: 0 }}>{p.count}x ({p.pct}%)</span>
            </div>
          ))}
        </div>
      )}

      {/* Profile patterns */}
      {Object.keys(profilePatterns).length > 0 && (
        <div>
          <div style={{ fontSize: '.78rem', fontWeight: 600, color: '#1A2E1F', marginBottom: 6 }}>Profils les plus corriges</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(profilePatterns).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
              <span key={key} style={{ background: '#fff', border: '1px solid rgba(26,46,31,.1)', borderRadius: 100, padding: '4px 12px', fontSize: '.72rem', color: '#4A4A42' }}>
                {key} ({count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MGD ANALYSIS PDF ───

// Map form fields to MGD symptom keys
// V94.27 : detectSymptomsFromForm + buildPreRdvSummary extraits vers services/clinicalProfile.js

function validateAnalysesPDF(symptoms, recommendations) {
  const errors = [];
  if (!symptoms || symptoms.length === 0) {
    errors.push('Aucun symptome detecte — impossible de recommander des analyses');
  }
  if (!recommendations || (recommendations.essential.length === 0 && recommendations.relevant.length === 0)) {
    errors.push('Aucune analyse recommandee');
  }
  return { valid: errors.length === 0, errors };
}

async function exportAnalysesPDF(recommendations, symptoms, clientName, dateStr) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 22;
  const cw = pw - margin * 2;
  let y = 20;

  // Background
  doc.setFillColor(245, 242, 236);
  doc.rect(0, 0, pw, 297, 'F');

  // Header
  doc.setFontSize(8);
  doc.setTextColor(138, 138, 122);
  doc.text(clientName, margin, y);
  doc.text('Analyses biologiques recommandees', pw / 2, y, { align: 'center' });
  doc.text(dateStr, pw - margin, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(26, 46, 31);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pw - margin, y);
  y += 10;

  // Intro
  doc.setFontSize(9);
  doc.setTextColor(74, 74, 66);
  const introLines = doc.splitTextToSize('Ces analyses permettent d\'objectiver certains desequilibres potentiels et de mieux personnaliser votre accompagnement nutritionnel. A discuter et valider avec votre medecin ou professionnel de sante.', cw);
  for (const line of introLines) { doc.text(line, margin, y); y += 4.5; }
  y += 6;

  // Context
  if (symptoms.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 46, 31);
    doc.text('Contexte : ', margin, y);
    const ctxX = margin + doc.getTextWidth('Contexte : ');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(74, 74, 66);
    doc.text(symptoms.map(s => s.replace(/_/g, ' ')).join(', '), ctxX, y);
    y += 8;
  }

  // Render section
  const renderSection = (title, items, dotColor) => {
    if (!items || items.length === 0) return;

    // Check page break
    if (y > 255) { doc.addPage(); doc.setFillColor(245, 242, 236); doc.rect(0, 0, pw, 297, 'F'); y = 20; }

    // Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 46, 31);
    doc.setFillColor(...dotColor);
    doc.circle(margin + 2, y - 1.5, 1.5, 'F');
    doc.text(title.toUpperCase(), margin + 7, y);
    y += 2;
    doc.setDrawColor(26, 46, 31);
    doc.setLineWidth(0.5);
    doc.line(margin + 7, y, margin + 7 + doc.getTextWidth(title.toUpperCase()), y);
    y += 6;

    // Items
    for (const item of items) {
      if (y > 270) { doc.addPage(); doc.setFillColor(245, 242, 236); doc.rect(0, 0, pw, 297, 'F'); y = 20; }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 46, 31);
      doc.text(item.label, margin + 4, y);

      // Category tag
      if (item.category && item.category !== 'Analyse fonctionnelle') {
        const labelW = doc.getTextWidth(item.label);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(138, 138, 122);
        doc.text(item.category, margin + 4 + labelW + 4, y);
      }
      y += 4;

      // Rationale
      if (item.rationale.length > 0) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(138, 138, 122);
        doc.text(item.rationale.slice(0, 3).join(', '), margin + 4, y);
        y += 4;
      }
      y += 1;
    }
    y += 4;
  };

  renderSection('Analyses essentielles', recommendations.essential, [26, 46, 31]);
  renderSection('Analyses pertinentes', recommendations.relevant, [232, 160, 64]);
  renderSection('Analyses optionnelles', recommendations.optional, [138, 138, 122]);

  // Practical tips
  if (y > 250) { doc.addPage(); doc.setFillColor(245, 242, 236); doc.rect(0, 0, pw, 297, 'F'); y = 20; }
  doc.setDrawColor(26, 46, 31);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin, y + 22);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 46, 31);
  doc.text('Conseils pratiques', margin + 4, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(74, 74, 66);
  const tips = [
    'A jeun pour les prises de sang (12h si bilan lipidique)',
    'Eviter le sport intense la veille',
    'Apporter cette liste au laboratoire ou a votre medecin',
    'Certains examens dependent du contexte — a individualiser',
  ];
  tips.forEach((tip, i) => { doc.text('- ' + tip, margin + 4, y + 9 + i * 4); });

  // Footer
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(138, 138, 122);
  const totalAnalyses = recommendations.essential.length + recommendations.relevant.length + recommendations.optional.length;
  doc.text('Anissa Deroubaix Nutrition', margin, ph - 10);
  doc.text(`${totalAnalyses} analyses recommandees`, pw - margin, ph - 10, { align: 'right' });

  doc.save(`analyses-${clientName.toLowerCase().replace(/\s+/g, '-')}-${dateStr.replace(/\//g, '-')}.pdf`);
}

function AnalysisPdfBody({ recommendations, symptoms, clientName, date }) {
  if (!recommendations) return null;

  const { essential, relevant, optional } = recommendations;
  const hasContent = essential.length > 0 || relevant.length > 0;
  if (!hasContent) return null;

  const pageHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(26,46,31,.12)', paddingBottom: 8, marginBottom: 16, fontSize: '.7rem', color: '#8a8a7a' };
  const sectionTitle = { color: '#1A2E1F', fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '2px solid #1A2E1F', paddingBottom: 5, marginBottom: 10 };

  const AnalysisItem = ({ item }) => (
    <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(26,46,31,.05)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ color: '#1A2E1F', fontWeight: 600 }}>{item.label}</span>
        {item.category && item.category !== 'Analyse fonctionnelle' && (
          <span style={{ fontSize: '.68rem', color: '#fff', background: 'rgba(26,46,31,.55)', borderRadius: 100, padding: '1px 8px', flexShrink: 0 }}>{item.category}</span>
        )}
      </div>
      {item.rationale.length > 0 && (
        <div style={{ fontSize: '.75rem', color: '#8a8a7a', marginTop: 2 }}>{item.rationale.slice(0, 3).join(', ')}</div>
      )}
    </div>
  );

  const SectionBlock = ({ title, items, color }) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <h4 style={sectionTitle}>{title}</h4>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '8px 14px' }}>
          {items.map((item, i) => <AnalysisItem key={i} item={item} />)}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: '#F5F2EC', color: '#1A2E1F', borderRadius: 10, padding: '24px 28px', marginTop: 12, fontSize: '.83rem', lineHeight: 1.65, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={pageHeader}>
        <span>{clientName}</span>
        <span>Analyses biologiques recommandees</span>
        <span>{date}</span>
      </div>

      {/* Intro */}
      <div style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', marginBottom: 18, fontSize: '.8rem', color: '#4A4A42', lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>Ces analyses permettent d'objectiver certains desequilibres potentiels et de mieux personnaliser votre accompagnement nutritionnel.</p>
        <p style={{ margin: '6px 0 0', fontStyle: 'italic', fontSize: '.76rem', color: '#8a8a7a' }}>A discuter et valider avec votre medecin ou professionnel de sante.</p>
      </div>

      {/* Context */}
      {symptoms.length > 0 && (
        <div style={{ marginBottom: 16, fontSize: '.78rem', color: '#4A4A42' }}>
          <strong style={{ color: '#1A2E1F' }}>Contexte : </strong>
          {symptoms.map(s => s.replace(/_/g, ' ')).join(', ')}
        </div>
      )}

      {/* Sections */}
      <SectionBlock title="Analyses essentielles" items={essential} color="#1A2E1F" />
      <SectionBlock title="Analyses pertinentes" items={relevant} color="#e8a040" />
      <SectionBlock title="Analyses optionnelles" items={optional} color="#8a8a7a" />

      {/* Practical tips */}
      <div style={{ background: '#fff', borderLeft: '3px solid #1A2E1F', borderRadius: '0 8px 8px 0', padding: '10px 16px', marginTop: 18, fontSize: '.78rem', color: '#4A4A42' }}>
        <strong style={{ display: 'block', marginBottom: 4, color: '#1A2E1F', fontSize: '.8rem' }}>Conseils pratiques</strong>
        <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}><span style={{ color: '#2a9d5c' }}>-</span> A jeun pour les prises de sang (12h si bilan lipidique)</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}><span style={{ color: '#2a9d5c' }}>-</span> Eviter le sport intense la veille</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}><span style={{ color: '#2a9d5c' }}>-</span> Apporter cette liste au laboratoire ou a votre medecin</div>
        <div style={{ display: 'flex', gap: 4 }}><span style={{ color: '#2a9d5c' }}>-</span> Certains examens dependent du contexte — a individualiser</div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(26,46,31,.1)', paddingTop: 8, marginTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: '#8a8a7a' }}>
        <span>Apercu analyses recommandees</span>
        <span>{essential.length + relevant.length + optional.length} analyse{essential.length + relevant.length + optional.length > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// V47 : Unités SI suisses (mmol/L, µmol/L, nmol/L) — format des labos MGD/Unilabs/Synlab
const LAB_MARKERS_UI = [
  // ─── BASE ───
  { key: 'ferritine', label: 'Ferritine', unit: 'µg/L', group: 'fer' },
  { key: 'fer_serique', label: 'Fer serique', unit: 'µmol/L', group: 'fer' },
  { key: 'vitamine_d', label: 'Vitamine D (25-OH)', unit: 'nmol/L', group: 'vitamines' },
  { key: 'vitamine_b12', label: 'Vitamine B12', unit: 'pmol/L', group: 'vitamines' },
  { key: 'folates', label: 'Folates (B9)', unit: 'nmol/L', group: 'vitamines' },
  { key: 'glucose_jeun', label: 'Glucose a jeun', unit: 'mmol/L', group: 'glycemie' },
  { key: 'insuline_jeun', label: 'Insuline a jeun', unit: 'mU/L', group: 'glycemie' },
  { key: 'hba1c', label: 'HbA1c', unit: '%', group: 'glycemie' },
  { key: 'tsh', label: 'TSH', unit: 'mUI/L', group: 'thyroide' },
  { key: 't3_libre', label: 'T3 libre', unit: 'pmol/L', group: 'thyroide' },
  { key: 't4_libre', label: 'T4 libre', unit: 'pmol/L', group: 'thyroide' },
  { key: 'crp_us', label: 'CRP ultrasensible', unit: 'mg/L', group: 'inflammation' },
  { key: 'magnesium', label: 'Magnesium serique', unit: 'mmol/L', group: 'mineraux' },
  { key: 'zinc', label: 'Zinc', unit: 'µmol/L', group: 'mineraux' },
  // ─── V45 : MARQUEURS ETENDUS ───
  { key: 'cholesterol_total', label: 'Cholesterol total', unit: 'mmol/L', group: 'lipides' },
  { key: 'hdl', label: 'HDL', unit: 'mmol/L', group: 'lipides' },
  { key: 'ldl', label: 'LDL', unit: 'mmol/L', group: 'lipides' },
  { key: 'triglycerides', label: 'Triglycerides', unit: 'mmol/L', group: 'lipides' },
  { key: 'homocysteine', label: 'Homocysteine', unit: 'µmol/L', group: 'inflammation' },
  { key: 'hemoglobine', label: 'Hemoglobine', unit: 'g/L', group: 'hemogramme' },
  { key: 'hematocrite', label: 'Hematocrite', unit: '%', group: 'hemogramme' },
  { key: 't3_reverse', label: 'T3 reverse', unit: 'pmol/L', group: 'thyroide' },
  { key: 'anti_tpo', label: 'Anti-TPO', unit: 'UI/mL', group: 'thyroide' },
  { key: 'anti_tg', label: 'Anti-Tg', unit: 'UI/mL', group: 'thyroide' },
  { key: 'iode_urinaire', label: 'Iode urinaire', unit: 'µg/L', group: 'thyroide' },
  { key: 'cuivre', label: 'Cuivre', unit: 'µmol/L', group: 'mineraux' },
  { key: 'selenium', label: 'Selenium', unit: 'µmol/L', group: 'mineraux' },
  { key: 'magnesium_erythro', label: 'Mg erythrocytaire', unit: 'mmol/L', group: 'mineraux' },
  { key: 'zonuline', label: 'Zonuline', unit: 'ng/mL', group: 'intestinal' },
  { key: 'calprotectine', label: 'Calprotectine', unit: 'µg/g', group: 'intestinal' },
];

// ─── V45 : QUICK FILLS (bilans pre-configures) ───
// Chaque bilan = shortlist des marqueurs attendus. Cliquer sur un bilan filtre l'UI
// pour n'afficher QUE ces marqueurs (le reste reste accessible via "Tout afficher").
const LAB_QUICK_FILLS = [
  {
    id: 'thyroide',
    label: 'Thyroide complet',
    icon: '🦋',
    markers: ['tsh', 't3_libre', 't4_libre', 't3_reverse', 'anti_tpo', 'anti_tg', 'iode_urinaire', 'selenium', 'zinc', 'vitamine_d', 'ferritine'],
  },
  {
    id: 'sopk',
    label: 'SOPK / insulinoresistance',
    icon: '🍩',
    markers: ['glucose_jeun', 'insuline_jeun', 'hba1c', 'tsh', 'vitamine_d', 'ferritine', 'crp_us'],
  },
  {
    id: 'surpoids',
    label: 'Surpoids / metabolique',
    icon: '⚖️',
    markers: ['glucose_jeun', 'insuline_jeun', 'hba1c', 'cholesterol_total', 'hdl', 'ldl', 'triglycerides', 'tsh', 'crp_us', 'ferritine'],
  },
  {
    id: 'hormonal_femme',
    label: 'Hormonal femme',
    icon: '🌸',
    markers: ['tsh', 't3_libre', 't4_libre', 'ferritine', 'vitamine_d', 'magnesium', 'crp_us'],
  },
  {
    id: 'stress_oxydant',
    label: 'Stress oxydant / nutrition',
    icon: '🧘',
    markers: ['vitamine_d', 'vitamine_b12', 'folates', 'magnesium_erythro', 'zinc', 'selenium', 'cuivre', 'homocysteine', 'crp_us'],
  },
  {
    id: 'intestinal',
    label: 'Intestinal',
    icon: '🌱',
    markers: ['zonuline', 'calprotectine', 'crp_us', 'vitamine_d', 'ferritine', 'vitamine_b12'],
  },
];

// V94.27 : buildLabSectionForPlan extrait vers services/clinicalProfile.js

// ─── CLINICAL SUMMARY ───

// V94.27 : buildClinicalSummary extrait vers services/clinicalProfile.js

// ─── CLIENT PIPELINE STATUSES ───

const PIPELINE_STATUSES = [
  { key: 'questionnaire_envoye', label: 'Questionnaire envoye', color: '#94a3b8' },
  { key: 'questionnaire_recu', label: 'Questionnaire recu', color: '#60a5fa' },
  { key: 'rdv_effectue', label: 'RDV effectue', color: '#a78bfa' },
  { key: 'attente_analyses', label: 'Attente analyses', color: '#fbbf24' },
  { key: 'dossier_complet', label: 'Dossier complet', color: '#4ade80' },
  { key: 'plan_en_cours', label: 'Plan en cours', color: '#f97316' },
  { key: 'a_valider', label: 'A valider', color: '#f87171' },
  { key: 'envoye', label: 'Envoye', color: '#22d3ee' },
];

// V94.27 : suggestStatus extrait vers services/clinicalProfile.js

const INITIAL_CONSULTATION = {
  observations: '',
  blood_test_done: false,
  dna_test_done: false,
  mgd_recommendation: 'none',
  mgd_recommended_tests_text: '',
  nutritional_observations: '',
  nutrition_plan: '',
  supplements: '',
  recipes: '',
  notes_for_coach: '',
  private_notes: '',
  fiche_frigo_json: null,
  lab_results: {},
  genetic_results: {},
  status: 'questionnaire_recu',
};

const INITIAL_FOLLOWUP = {
  etat_global: '',
  energie: '',
  sommeil: '',
  digestion: '',
  stress: '',
  douleurs: '',
  adherence_plan: '',
  changements_succes: '',
  difficultes: '',
  supplements_pris: '',
  supplements_raison: '',
  poids_actuel: '',
  tour_taille: '',
  tour_hanche: '',
  tour_bras: '',
  tour_cuisse: '',
  masse_grasse: '',
  nouveau_bilan: '',
  nouveau_adn: '',
  observations_progression: '',
  points_ameliorer: '',
  objectifs_prochains: '',
};

// V94.27 : formatDate + buildRecommendedBloodTests extraits vers services/clinicalProfile.js

export default function NutritionConsultation({ clientId, apiKey, onSave, onCancel, initialConsultation }) {
  const [client, setClient] = useState(() => getClient(clientId));
  const form = client?.form || {};
  const formule = FORMULES[client?.formule] || {};

  // Fetch latest client data from Supabase on mount (questionnaire may have been filled since local cache)
  useEffect(() => {
    if (!isCloudEnabled || !clientId) return;
    supabase
      .from('clients')
      .select('form, prenom, updated_at')
      .eq('id', clientId)
      .single()
      .then(({ data, error }) => {
        if (error || !data?.form) return;
        const local = getClient(clientId);
        const cloudDate = new Date(data.updated_at || 0);
        const localDate = new Date(local?.updatedAt || 0);
        // Only update if cloud is newer (questionnaire was submitted after local creation)
        if (cloudDate > localDate) {
          const merged = { ...local, form: { ...(local?.form || {}), ...data.form }, updatedAt: data.updated_at };
          saveClient(merged);
          setClient(merged);
        }
      });
  }, [clientId]);

  // Detect returning client
  const existingConsultations = getNutritionConsultations(clientId);
  const isFollowup = !initialConsultation && existingConsultations.length > 0;
  const previousConsultation = isFollowup ? existingConsultations[0] : null;
  // Week number: prefer persisted value, fallback to nutrition followup count
  const followupWeek = (() => {
    if (initialConsultation?.followupWeek) return initialConsultation.followupWeek;
    if (!isFollowup) return 0;
    // Count only followup consultations (exclude the initial plan)
    const followupCount = existingConsultations.filter(c => c.isFollowup).length;
    // Current consultation is the next followup (+1), capped at 4
    return Math.min(followupCount + 1, 4);
  })();

  // Steps differ based on followup status
  const stepLabels = isFollowup
    ? ['Resume client', 'Suivi & Progression', 'Plan nutrition', 'Notes internes']
    : ['Resume client', 'Plan nutrition', 'Notes internes'];

  const totalSteps = stepLabels.length;

  // Le cockpit (step "plan") est le point d'entree par defaut — les autres
  // steps (resume client, suivi, notes) restent accessibles via les pills en haut.
  const [step, setStep] = useState(() => (isFollowup ? 3 : 2));
  const [consultation, setConsultation] = useState(() => {
    if (initialConsultation) {
      return {
        observations: initialConsultation.observations || '',
        blood_test_done: initialConsultation.bloodTestDone || initialConsultation.blood_test_done || false,
        dna_test_done: initialConsultation.dnaTestDone || initialConsultation.dna_test_done || false,
        mgd_recommendation: initialConsultation.mgdRecommendation
          || initialConsultation.mgd_recommendation
          || (initialConsultation.bloodTestDone || initialConsultation.blood_test_done
              ? (initialConsultation.dnaTestDone || initialConsultation.dna_test_done
                  ? 'advanced' : 'blood')
              : 'none'),
        mgd_recommended_tests_text: initialConsultation.mgdRecommendedTestsText
          || initialConsultation.mgd_recommended_tests_text || '',
        nutritional_observations: initialConsultation.nutritionalObservations || initialConsultation.nutritional_observations || '',
        nutrition_plan: initialConsultation.nutritionPlan || initialConsultation.nutrition_plan || '',
        supplements: initialConsultation.supplements || '',
        recipes: initialConsultation.recipes || '',
        notes_for_coach: initialConsultation.notesForCoach || initialConsultation.notes_for_coach || '',
        private_notes: initialConsultation.privateNotes || initialConsultation.private_notes || '',
        fiche_frigo_json: initialConsultation.ficheFrigoJson || initialConsultation.fiche_frigo_json || null,
        lab_results: initialConsultation.labResults || initialConsultation.lab_results || {},
        genetic_results: initialConsultation.geneticResults || initialConsultation.genetic_results || {},
        // V94.61 : composantes app cliente (lettre IA + recettes IA).
        // Manquaient au state init → meme si persistees (V94.59), elles
        // etaient droppees au mount → onglet Lettre/Recettes vide au reload.
        intro_letter: initialConsultation.intro_letter || null,
        meal_recipes: initialConsultation.meal_recipes || null,
        // Garder l'id de la consultation pour pouvoir update au save
        id: initialConsultation.id,
      };
    }
    // Pre-fill observations from questionnaire data
    const c = { ...INITIAL_CONSULTATION };
    const f = client?.form || {};

    // Build observations from profile data
    const profileParts = [
      f.genre && `Genre : ${f.genre}`,
      f.age && `Age : ${f.age} ans`,
      f.poids && `Poids : ${f.poids} kg`,
      f.taille && `Taille : ${f.taille} cm`,
      f.profession && `Profession : ${f.profession}`,
      f.heuresSommeil && `Sommeil : ${f.heuresSommeil}/5`,
      f.niveauStressActuel && `Stress : ${f.niveauStressActuel}/5`,
      f.energieJournee && `Energie : ${f.energieJournee}/5`,
    ].filter(Boolean);
    if (profileParts.length > 0) c.observations = profileParts.join('\n');

    // Build nutritional observations from diet/health data
    const nutriParts = [
      f.nbRepas && `Repas/jour : ${f.nbRepas}`,
      f.hydratation && `Hydratation : ${f.hydratation}`,
      f.alimentsEvites && `Aliments evites : ${f.alimentsEvites}`,
      f.frequenceBallonnements && `Digestion : ${f.frequenceBallonnements}/5`,
      f.pathologies && `Pathologies : ${f.pathologies}`,
      f.traitements && `Traitements : ${f.traitements}`,
      f.allergies && `Allergies : ${f.allergies}`,
    ].filter(Boolean);
    if (nutriParts.length > 0) c.nutritional_observations = nutriParts.join('\n');

    return c;
  });
  const [followupData, setFollowupData] = useState(() => {
    if (initialConsultation?.followupData) return { ...INITIAL_FOLLOWUP, ...initialConsultation.followupData };
    return { ...INITIAL_FOLLOWUP };
  });
  const [weeklyFeedback, setWeeklyFeedback] = useState(() => {
    if (initialConsultation?.weeklyFeedback) return { ...INITIAL_WEEKLY_FEEDBACK, ...initialConsultation.weeklyFeedback };
    return { ...INITIAL_WEEKLY_FEEDBACK };
  });
  const [consultationId] = useState(initialConsultation?.id || null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [autoCorrected, setAutoCorrected] = useState(false);
  const [pdfError, setPdfError] = useState('');
  // V76 : showPdfPreview retire avec la modale Apercu PDF
  const [showAnalysesPreview, setShowAnalysesPreview] = useState(false);
  const [analysesError, setAnalysesError] = useState('');
  // V92.1 : showTemplates supprime — feature Templates retiree
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  // V96.32 — Menu Exporter qui regroupe Word + Relecture + Resume medecin
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [mgdOpen, setMgdOpen] = useState(false);
  // V78 : soft delete consultation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // V79 : copilot — backup du plan avant derniere insertion pour undo
  const [lastInsertBackup, setLastInsertBackup] = useState(null);
  // { prevPlan, prevSupplements, prevRecipes, win, type, expiresAt }
  // V79.1 : type de section a faire flasher (persistent sur re-render via React state)
  const [flashSectionType, setFlashSectionType] = useState(null);
  // V81 : modale de confirmation reutilisable
  const confirmDialog = useConfirmDialog();
  // V83 : mode relecture — l'editeur passe en read-only pour simuler la lecture du PDF
  const [isReviewMode, setIsReviewMode] = useState(false);
  // V88 / V92.2 / V94 : couche finalisation humaine (rollback safety net).
  // finalText = version editee manuellement par Anissa, stockee separement du plan IA.
  // Le PDF prime finalText si isFinal=true. Modal Finaliser supprimee V92.3 et code
  // orphelin (handlers, effects, ~210 lignes) nettoye V94. Anissa peaufine maintenant
  // directement dans Word apres export. Ces states restent dormants pour ne pas casser
  // les anciennes consultations finalisees + rollback rapide si revert necessaire.
  const [finalText, setFinalText] = useState('');
  const [isFinal, setIsFinal] = useState(false);
  const [finalVersions, setFinalVersions] = useState(
    Array.isArray(initialConsultation?.finalVersions) ? initialConsultation.finalVersions : []
  );
  // V79.3 : map { winText: sectionType } des quickWins deja inserees
  // → permet de re-afficher "✓ Revoir" au lieu de "Inserer" et d'eviter les doublons.
  const [insertedWinsMap, setInsertedWinsMap] = useState({});

  // Memoize MGD correlation computations (expensive, re-run only when lab data or form changes)
  const hasLabData = useMemo(() => {
    const labData = consultation.lab_results || {};
    return Object.values(labData).some(v => v !== '' && v != null);
  }, [consultation.lab_results]);

  const labAnalysisMemo = useMemo(
    () => hasLabData ? analyzeLabResults(consultation.lab_results || {}) : null,
    [consultation.lab_results, hasLabData]
  );

  // V79 : auto-hide du banner undo apres la fenetre de 20s
  useEffect(() => {
    if (!lastInsertBackup) return;
    const msLeft = Math.max(0, lastInsertBackup.expiresAt - Date.now());
    const timer = setTimeout(() => setLastInsertBackup(null), msLeft);
    return () => clearTimeout(timer);
  }, [lastInsertBackup]);

  // V79.1 : auto-clear du flash Copilot apres 2.5s
  useEffect(() => {
    if (!flashSectionType) return;
    const t = setTimeout(() => setFlashSectionType(null), 2500);
    return () => clearTimeout(t);
  }, [flashSectionType]);

  const mgdCorrelationMemo = useMemo(() => {
    if (!hasLabData || !labAnalysisMemo?.signals?.length) return null;
    const symptoms = detectSymptomsFromForm(form);
    return buildMGDCorrelation(symptoms, labAnalysisMemo.signals);
  }, [consultation.lab_results, form, hasLabData, labAnalysisMemo]);

  const [pendingAlerts, setPendingAlerts] = useState(null);
  const editorGetDataRef = useRef(null);
  const [planVersions, setPlanVersions] = useState(() => getPlanVersions(clientId));
  const [showVersions, setShowVersions] = useState(false);
  // V45 : Quick fill actif (id du bilan selectionne, ou null pour "tout afficher")
  const [activeLabQuickFill, setActiveLabQuickFill] = useState(null);

  // ─── Cockpit (single editor view) ───
  // V76 : previewTab supprime — Apercu PDF modal retiree, l'editeur est l'apercu.
  // V94.60 : si Anissa a clique '📱 Espace app cliente' dans le menu Plus
  // du dashboard, on ouvre direct sur l'onglet App. Flag one-shot, consume au mount.
  const [editorTab, setEditorTab] = useState(() => {
    try {
      const flag = localStorage.getItem('bfc_open_consultation_tab');
      if (flag === 'app') {
        localStorage.removeItem('bfc_open_consultation_tab');
        return 'app';
      }
    } catch { /* */ }
    return 'plan';
  }); // 'plan' | 'frigo' | 'app' (V96.33 : 's1s4' + 'supp' retires)
  const [showFrigoModal, setShowFrigoModal] = useState(false);
  const [showMedicalSummary, setShowMedicalSummary] = useState(false);
  // V92.1 : showCoverForm + coverFields supprimes — Word V92.0 prime
  const [showClientAppPreview, setShowClientAppPreview] = useState(false);
  // V96.13 : toggle composer beta (FR uniquement). Persiste en localStorage par
  // utilisateur. OFF par defaut → comportement legacy strictement preserve.
  // Quand ON → buildSystemPromptFrV2 injecte les modules profil clinique.
  const [composerBeta, setComposerBeta] = useState(() => {
    try { return localStorage.getItem('bfc_composer_beta_fr') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('bfc_composer_beta_fr', composerBeta ? 'true' : 'false'); } catch { /* */ }
  }, [composerBeta]);
  // Profil detecte au dernier appel (affichage UI feedback). Reset a chaque generation.
  const [lastDetectedProfile, setLastDetectedProfile] = useState(null);
  // V96.19 — Directives IA additionnelles par cliente (override texte libre).
  // Anissa peut ecrire des consignes specifiques (refus aliment, contexte
  // clinique nuance, ton particulier) qui sont injectees dans buildUserMessage
  // avec priorite maximale. Persiste dans consultation.aiDirectives.
  const [aiDirectives, setAiDirectives] = useState(
    initialConsultation?.aiDirectives
    || initialConsultation?.ai_directives
    || ''
  );
  const [aiDirectivesExpanded, setAiDirectivesExpanded] = useState(false);
  // ─── Draft state (source de verite unique cote parent) ──────────────
  // L'editeur est controle via un reseed explicite (editorSeed) et pousse
  // ses modifications en continu via onDraftChange (debounced cote editeur).
  // L'apercu lit directement ces drafts → re-renders React natifs, pas de ref polling.
  const initialPlan = initialConsultation?.nutritionPlan || initialConsultation?.nutrition_plan || '';
  const initialSupp = initialConsultation?.supplements || '';
  const initialRec = initialConsultation?.recipes || '';
  const [planDraft, setPlanDraft] = useState(initialPlan);
  const [supplementsDraft, setSupplementsDraft] = useState(initialSupp);
  const [recipesDraft, setRecipesDraft] = useState(initialRec);
  // editorSeed : incremente UNIQUEMENT pour forcer un remount de NutritionEditor
  // (apres generation IA, template, ou restauration de version). Jamais en reponse
  // a une edition utilisateur — c'est ce qui evitait la perte de texte.
  const [editorSeed, setEditorSeed] = useState(0);

  const [saveToast, setSaveToast] = useState('');
  const [liveScore, setLiveScore] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const scoreDebounceRef = useRef(null);
  // V51 : aiAnalysis persiste dans la consultation (survivre nav + reload)
  const [aiAnalysis, setAiAnalysis] = useState(() => {
    return initialConsultation?.aiAnalysis || initialConsultation?.ai_analysis || null;
  });
  const [analyzingPlan, setAnalyzingPlan] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState('');
  const [improvingAll, setImprovingAll] = useState(false);
  const [globalProposal, setGlobalProposal] = useState(null);
  // V96.31 — Mode Expert retire (state expertMode + sectionResults +
  // currentOptimizingIdx + acceptedSections supprimes). Composer beta + audit IA
  // composer-aware (V96.23+) couvrent maintenant l'optimisation : detection des
  // manques par module + corrections rapides cliquables. Mode Expert dupliquait
  // ce travail sans connaitre les modules profil.
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved');
  // 'saved' | 'unsaved' | 'saving'
  const autoSaveTimerRef = useRef(null);
  const isDirtyRef = useRef(false);
  // V76 : previewBodyRef retire avec la modale Apercu PDF

  // Restore draft on mount if newer than saved consultation
  useEffect(() => {
    const draft = loadDraft(clientId, consultationId);
    if (!draft) return;
    const consultationDate = new Date(initialConsultation?.createdAt || 0).getTime();
    if (draft.savedAt > consultationDate) {
      reseedEditor(draft.plan, draft.supplements, draft.recipes);
      setAutoSaveStatus('unsaved');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reseed : remplace les drafts + remount l'editeur. A appeler APRES toute
  // ecriture "autoritaire" du plan (AI gen, template, restore version).
  const reseedEditor = (plan, supplements, recipes) => {
    setPlanDraft(plan || '');
    setSupplementsDraft(supplements || '');
    setRecipesDraft(recipes || '');
    setEditorSeed(s => s + 1);
  };

  // Callback push-based depuis NutritionEditor — maintient les drafts a jour.
  const handleDraftChange = (plan, supplements, recipes) => {
    setPlanDraft(plan);
    setSupplementsDraft(supplements);
    setRecipesDraft(recipes);
    isDirtyRef.current = true;
    setAutoSaveStatus('unsaved');
    // Debounce 1s
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveStatus('saving');
      saveDraft(clientId, consultationId, { plan, supplements, recipes });
      setAutoSaveStatus('unsaved');
    }, 1000);
  };

  // Flush draft to localStorage on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (isDirtyRef.current) {
        const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
        saveDraft(clientId, consultationId, {
          plan: edited?.plan ?? planDraft,
          supplements: edited?.supplements ?? supplementsDraft,
          recipes: edited?.recipes ?? recipesDraft,
        });
      }
    };
  }, [clientId, consultationId, planDraft, supplementsDraft, recipesDraft]);

  // Warning before page unload if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Close dropdown menus on outside click
  useEffect(() => {
    const close = () => { setShowPdfMenu(false); setShowMoreMenu(false); setShowExportMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Flush des drafts -> etat persiste consultation.*
  // Ne provoque PAS de reseed de l'editeur (drafts === consultation apres ca).
  const flushEditorDraft = () => {
    setConsultation(prev => {
      if (prev.nutrition_plan === planDraft && prev.supplements === supplementsDraft && prev.recipes === recipesDraft) {
        return prev;
      }
      return {
        ...prev,
        nutrition_plan: planDraft,
        supplements: supplementsDraft,
        recipes: recipesDraft,
      };
    });
    return true;
  };

  const showSaveToast = (msg) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(''), 1800);
  };

  // Live score + suggestions (debounced)
  useEffect(() => {
    if (!planDraft && !supplementsDraft) return;
    if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
    scoreDebounceRef.current = setTimeout(() => {
      const score = scorePlanQuality(
        planDraft,
        supplementsDraft,
        { ...form, _weeklyFeedback: weeklyFeedback },
        { isFollowup, followupWeek }
      );
      setLiveScore(score);
      setSuggestions(buildSuggestions(score, null));
    }, 1500);
    return () => clearTimeout(scoreDebounceRef.current);
  }, [planDraft, supplementsDraft, form, isFollowup, followupWeek, weeklyFeedback]);

  const handleImproveFromAnalysis = async (instruction, targetHint) => {
    setAiAnalysis(null);
    await new Promise(r => setTimeout(r, 150));
    showSaveToast(`\u2728 IA en cours \u2014 ${instruction}`);
    try {
      const { improveSection } = await import('./services/aiClient');
      const result = await improveSection(
        form,
        targetHint || 'Plan complet',
        planDraft,
        'adapt'
      );
      if (result) {
        setGlobalProposal({ text: result, instruction });
      }
    } catch (err) {
      showSaveToast('Erreur IA \u2014 r\u00e9essayez');
    }
  };

  const handleImproveAll = async () => {
    setImprovingAll(true);
    setAiAnalysis(null);
    try {
      const { improveSection } = await import('./services/aiClient');
      const result = await improveSection(
        form,
        'Plan nutritionnel complet',
        planDraft,
        'improve'
      );
      if (result) setGlobalProposal({ text: result, instruction: 'Plan am\u00e9lior\u00e9' });
    } catch (err) {
      showSaveToast('Erreur IA \u2014 r\u00e9essayez');
    } finally {
      setImprovingAll(false);
    }
  };

  const updateField = (field, value) => {
    setConsultation(prev => ({ ...prev, [field]: value }));
  };

  // V88.3 : renvoie le texte qui ira REELLEMENT dans le PDF.
  // Meme logique que doExportPdf : prime finalText si la finalisation est active.
  const getEffectivePlanText = () => {
    if (isFinal && finalText && finalText.trim()) return finalText.trim();
    if (planDraft && planDraft.trim()) return planDraft.trim();
    return consultation?.nutrition_plan || '';
  };

  // Map step index to content type based on followup
  const getStepType = (s) => {
    if (isFollowup) {
      const map = { 1: 'summary', 2: 'followup', 3: 'plan', 4: 'notes' };
      return map[s];
    }
    const map = { 1: 'summary', 2: 'plan', 3: 'notes' };
    return map[s];
  };

  const currentStepType = getStepType(step);

  const buildUserMessage = () => {
    const nr = 'Non renseigne';

    const parts = [
      `Voici les donnees completes du client (13 etapes d'anamnese) :`,
      ``,
      `--- ETAPE 1 : IDENTITE ---`,
      `- Nom : ${[form.prenom, form.nom].filter(Boolean).join(' ') || nr}`,
      `- Age : ${form.age ? `${form.age} ans` : nr}`,
      `- Genre : ${form.genre || nr}`,
      `- Poids : ${form.poids ? `${form.poids} kg` : nr}`,
      `- Taille : ${form.taille ? `${form.taille} cm` : nr}`,
      form.tourTaille ? `- Tour de taille : ${form.tourTaille} cm` : '',
      form.tourHanche ? `- Tour de hanche : ${form.tourHanche} cm` : '',
      form.tourPoitrine ? `- Tour de poitrine : ${form.tourPoitrine} cm` : '',
      form.tourBras ? `- Tour de bras : ${form.tourBras} cm` : '',
      form.tourCuisse ? `- Tour de cuisse : ${form.tourCuisse} cm` : '',
      form.masseGrasse ? `- Masse grasse : ${form.masseGrasse} %` : '',
      form.masseMusculaire ? `- Masse musculaire : ${form.masseMusculaire} %` : '',
      `- Profession : ${form.profession || nr}`,
      `- Email : ${form.email || nr}`,
      `- Telephone : ${form.telephone || nr}`,
      `- Formule : ${formule.nom || (client?.categorie === 'nutrition' ? 'Client nutrition' : nr)}`,
      ``,
      `--- ETAPE 2 : ANTECEDENTS MEDICAUX ---`,
      `- Pathologies : ${form.pathologies || nr}`,
      `- Operations : ${form.operations || nr}`,
      `- Traitements / medicaments : ${form.traitements || nr}`,
      `- Antecedents familiaux : ${form.antecedentsFamiliaux || nr}`,
      `- Allergies : ${form.allergies || 'Aucune'}`,
      ``,
      `--- ETAPE 3 : ALIMENTATION ---`,
      `- Nombre de repas/jour : ${form.nbRepas || nr}`,
      `- Hydratation : ${form.hydratation || nr}`,
      `- Aliments evites / intolerances : ${form.alimentsEvites || nr}`,
      `- Regimes suivis : ${form.regimesSuivis || nr}`,
      `- Mastication / grignotages : ${form.mastication || nr}`,
      ``,
      `--- ETAPE 4 : SANTE ---`,
      `- Blessures : ${form.blessures || 'Aucune'}`,
      `- Douleurs actuelles : ${form.douleursActuelles || nr}`,
      `- Contraception : ${form.contraception || nr}`,
      `- Cycle : ${form.cycleDuree || nr}`,
      `- SPM : ${form.spm || nr}`,
      `- Douleurs menstruelles : ${form.douleursMenstruelles || nr}`,
      `- Projet grossesse : ${form.projetGrossesse || nr}`,
      ``,
      `--- ETAPE 5 : SPORT & PERFORMANCE ---`,
      `- Type de sport : ${form.typeSport || nr}`,
      `- Frequence : ${form.frequenceSport || nr}`,
      `- Objectif sportif : ${form.objectifSport || nr}`,
      `- Recuperation : ${form.recuperation || nr}`,
      `- Supplements actuels : ${form.supplements || nr}`,
      `- Digestif a l'effort : ${form.digestifEffort || nr}`,
      ``,
      `--- ETAPE 6 : METABOLISME & ENERGIE ---`,
      `- Energie au cours de la journee : ${form.energieJournee || nr}`,
      `- Fringales / envies de sucre : ${form.fringalesSucre || nr}`,
      `- Variations de glycemie : ${form.variationsGlycemie || nr}`,
      `- Reaction apres repas riche en glucides : ${Array.isArray(form.reactionGlucides) ? (form.reactionGlucides.length ? form.reactionGlucides.join(', ') : nr) : (form.reactionGlucides || nr)}`,
      ``,
      `--- ETAPE 7 : DIGESTION & MICROBIOTE ---`,
      `- Frequence ballonnements : ${form.frequenceBallonnements || nr}`,
      `- Type de transit : ${form.transitType || nr}`,
      `- Aliments problematiques : ${form.alimentsProblematiques || nr}`,
      `- Consommation reguliere : ${(form.consommationReguliere || []).length > 0 ? form.consommationReguliere.join(', ') : nr}`,
      ``,
      `--- ETAPE 8 : INFLAMMATION & IMMUNITE ---`,
      `- Douleurs articulaires / inflammations : ${form.douleursInflammations || nr}`,
      `- Frequence maladies : ${form.frequenceMaladies || nr}`,
      `- Troubles de peau : ${form.troublesPeau || nr}`,
      ``,
      `--- ETAPE 9 : STRESS & SYSTEME NERVEUX ---`,
      `- Niveau de stress actuel : ${form.niveauStressActuel ? `${form.niveauStressActuel}/10` : nr}`,
      `- Difficultes d'endormissement : ${form.difficultesEndormissement || nr}`,
      `- Reveils nocturnes : ${form.reveilsNocturnes || nr}`,
      `- Etat au reveil : ${form.etatReveil || nr}`,
      ``,
      `--- ETAPE 10 : MODE DE VIE & BIOHACKING ---`,
      `- Temps a l'exterieur (lumiere naturelle) : ${form.tempsExterieur || nr}`,
      `- Heures de sommeil en moyenne : ${form.heuresSommeil ? `${form.heuresSommeil}h` : nr}`,
      `- Exposition ecrans le soir : ${form.expositionEcransSoir || nr}`,
      `- Type de profession : ${form.professionType || nr}`,
      `- Alcool : ${form.alcool || nr}`,
      `- Tabac : ${form.tabac || nr}`,
      ``,
      `--- ETAPE 11 : GENETIQUE & DONNEES ---`,
      `- Analyses biologiques recentes : ${form.analysesBiologiques || nr}`,
      `- Test ADN nutrigenetique : ${form.testADN || nr}`,
      `- Tests genetiques connus (MTHFR, APOE, etc.) : ${form.testsGenetiques || nr}`,
      `- Pret pour analyses avancees : ${form.pretAnalysesAvancees || nr}`,
      ``,
      `--- ETAPE 12 : OBJECTIFS & ENGAGEMENT ---`,
      `- Objectif principal : ${form.objectifPrincipalNutrition || nr}`,
      `- Duree du probleme : ${form.dureeProbleme || nr}`,
      `- Deja essaye : ${form.dejaEssaye || nr}`,
      `- Pret pour protocole personnalise : ${form.pretProtocole || nr}`,
      ``,
      `--- OBSERVATIONS DE LA NUTRITIONNISTE ---`,
      `- Observations generales : ${consultation.observations || nr}`,
      `- Bilan sanguin effectue : ${consultation.blood_test_done ? 'Oui' : 'Non'}`,
      `- Analyse ADN effectuee : ${consultation.dna_test_done ? 'Oui' : 'Non'}`,
      `- Observations nutritionnelles : ${consultation.nutritional_observations || nr}`,
    ];

    // Add followup data for returning clients
    if (isFollowup && previousConsultation) {
      parts.push('');
      parts.push(`--- SUIVI SEMAINE ${followupWeek}/4 ---`);
      parts.push(buildFollowupSummary(followupData, previousConsultation, form));

      // Weekly feedback (structured)
      const wf = weeklyFeedback;
      const feedbackLines = [
        wf.energy && `Energie : ${wf.energy}`,
        wf.digestion && `Digestion : ${wf.digestion}`,
        wf.hunger && `Faim/Satiete : ${wf.hunger}`,
        wf.adherence && `Adherence : ${wf.adherence}`,
        wf.performance && `Performance : ${wf.performance}`,
        wf.cravings && `Fringales/Envies : ${wf.cravings}`,
        wf.notes && `Notes : ${wf.notes}`,
      ].filter(Boolean);
      if (feedbackLines.length > 0) {
        parts.push('');
        parts.push('--- FEEDBACK HEBDOMADAIRE CLIENT ---');
        parts.push(feedbackLines.join('\n'));
      }

      // Add previous plan summary
      if (previousConsultation.nutritionPlan) {
        const planLines = previousConsultation.nutritionPlan.split('\n').slice(0, 30);
        parts.push('');
        parts.push('--- PLAN INITIAL A AJUSTER ---');
        parts.push(planLines.join('\n'));
        parts.push('...(plan complet non inclus pour brievete)');
      }
      if (previousConsultation.supplements) {
        parts.push('');
        parts.push('--- SUPPLEMENTS PRECEDEMMENT RECOMMANDES ---');
        parts.push(previousConsultation.supplements.split('\n').slice(0, 15).join('\n'));
      }
    }

    // Add lab results interpretation if available
    const labData = consultation.lab_results || {};
    const hasLabData = Object.values(labData).some(v => v !== '' && v != null);
    const labAnalysis = hasLabData ? analyzeLabResults(labData) : null;
    if (hasLabData) {
      const labSection = buildLabSectionForPlan(labData);
      if (labSection) parts.push(labSection);
    }

    // Inject MGD recommended tests text if present
    const mgdTestsText = consultation.mgd_recommended_tests_text?.trim();
    if (mgdTestsText) {
      parts.push('');
      parts.push('--- ANALYSES RECOMMANDÉES (MGD) ---');
      parts.push(mgdTestsText);
    }

    // Inject MGD correlations if lab data exists
    if (hasLabData && labAnalysis?.signals?.length > 0) {
      const mgdSymptomsForCorr = detectSymptomsFromForm(form);
      const correlation = buildMGDCorrelation(mgdSymptomsForCorr, labAnalysis.signals);
      const corrText = formatCorrelationForPrompt(correlation);
      if (corrText) {
        parts.push('');
        parts.push(corrText);
      }
    }

    // V46 : Inject genetic tests (nutrigenetics) if any variant is recorded
    const geneticSection = buildGeneticSectionForPrompt(consultation.genetic_results);
    if (geneticSection) {
      parts.push(geneticSection);
    }

    // Inject emotional shock context if present
    if (form.emotional_shock === 'Oui') {
      parts.push('');
      parts.push('CONTEXTE ÉMOTIONNEL : Choc émotionnel déclaré.');
      if (form.emotional_shock_details?.trim()) {
        parts.push(`Détails : ${form.emotional_shock_details.trim()}`);
      }
      parts.push('Tenir compte de l\'axe stress/cortisol dans le plan. Privilégier aliments adaptogènes et anti-inflammatoires.');
    }

    // Pre-RDV summary (priorities + axes, also shown in UI)
    const preRdv = buildPreRdvSummary(form);
    if (preRdv.hasData) {
      parts.push('');
      parts.push('--- SYNTHESE PRE-RDV (priorites detectees) ---');
      if (preRdv.objectif) parts.push(`Objectif : ${preRdv.objectif}`);
      if (preRdv.priorities.length > 0) parts.push(`Priorites : ${preRdv.priorities.join(' > ')}`);
      if (preRdv.axes.length > 0) parts.push(`Axes de travail : ${preRdv.axes.join(', ')}`);
      if (preRdv.vigilance.length > 0) parts.push(`Vigilance : ${preRdv.vigilance.join(', ')}`);
    }

    // Clinical summary (orientation for AI)
    const mgdSymptoms = detectSymptomsFromForm(form);
    const mgdRec = consultation.mgd_recommendation || 'none';
    const mgdRecLabel = mgdRec === 'advanced'
      ? 'Bilan avancé recommandé (sanguin + ADN)'
      : mgdRec === 'blood'
      ? 'Bilan sanguin recommandé'
      : 'Aucun test biologique recommandé';
    parts.push('');
    parts.push(buildClinicalSummary(form, {
      mgdSymptoms,
      labAnalysis: labAnalysis?.signals?.length > 0 ? labAnalysis : null,
      isFollowup,
      followupWeek,
    }));
    parts.push(`Recommandation biologique Anissa : ${mgdRecLabel}`);

    parts.push('');
    parts.push(`Genere un plan nutrition personnalise COURT et PREMIUM. Format compact : synthese, regles, 2 trames de journees types (semaine 1), rotations et substitutions (semaines 2-4), fiche frigo, ajustements entrainement, suivi. PAS de menus detailles jour par jour. Lisible en 3 minutes.`);
    if (hasLabData) {
      parts.push('IMPORTANT : Intégrer impérativement les adaptations biologiques dans le plan :');
      parts.push('- Adapter les aliments aux signaux détectés');
      parts.push('- Inclure les suppléments pertinents avec dosages');
      parts.push('- Mentionner les priorités nutritionnelles issues des résultats');
    }

    // V96.19 — DIRECTIVES IA ADDITIONNELLES (override par cliente).
    // Anissa peut injecter des consignes specifiques pour CETTE cliente
    // (refus aliment, intolerance non standard, contexte clinique nuance,
    // ajustement de ton, contrainte budgetaire, etc.). Place en QUEUE pour
    // que ces consignes soient les dernieres lues par Claude (poids maximal).
    const directives = (aiDirectives || '').trim();
    if (directives) {
      parts.push('');
      parts.push('--- DIRECTIVES SPECIFIQUES ANISSA POUR CETTE CLIENTE (PRIORITE MAXIMALE) ---');
      parts.push(directives);
      parts.push('Ces directives prevalent sur les regles generales en cas de conflit. Les respecter scrupuleusement.');
    }

    return parts.join('\n');
  };

  const handleGenerate = async () => {
    // Validation des champs critiques (securite client)
    const missing = [];
    if (!form.allergies || !form.allergies.toString().trim()) missing.push('allergies / intolerances');
    const hasMeds = (form.traitements && form.traitements.toString().trim()) || (form.medicaments && form.medicaments.toString().trim());
    const hasPath = form.pathologies && form.pathologies.toString().trim();
    if (!hasMeds && !hasPath) missing.push('medicaments / pathologies');
    if (missing.length > 0) {
      // V81 : modale propre au lieu de window.confirm
      const ok = await confirmDialog.ask({
        title: 'Champs critiques manquants',
        message: `Champs non renseignés : ${missing.join(' et ')}.\n\nGénérer sans ces informations peut être dangereux (interactions, contre-indications).\n\nContinuer quand même ?`,
        danger: true,
        confirmLabel: 'Générer quand même',
      });
      if (!ok) return;
    }

    if (consultation.nutrition_plan) {
      // V81 : regeneration = destructif (ecrase le plan + modifications non sauvegardees)
      const ok = await confirmDialog.ask({
        title: 'Régénérer le plan ?',
        message: 'Le plan actuel sera remplacé. Les modifications non sauvegardées seront perdues.',
        danger: true,
        confirmLabel: 'Régénérer',
      });
      if (!ok) return;
    }

    // Detection des contre-indications avant generation
    const alerts = detectContraIndications({
      ...form,
      observations: consultation.observations,
      nutritional_observations: consultation.nutritional_observations,
    });
    if (alerts.length > 0) {
      setPendingAlerts(alerts);
      return;
    }

    await doGenerate();
  };

  const doGenerate = async () => {
    setPendingAlerts(null);
    setGenerating(true);
    setGenError('');

    // Versioning : sauvegarder l'ancien plan avant de le remplacer
    if (consultation.nutrition_plan) {
      savePlanVersion(clientId, {
        nutritionPlan: consultation.nutrition_plan,
        supplements: consultation.supplements,
        recipes: consultation.recipes,
        ficheFrigoJson: consultation.fiche_frigo_json || null,
        label: 'Avant regeneration',
      });
      setPlanVersions(getPlanVersions(clientId));
    }

    try {
      const userMessage = buildUserMessage();

      // V96.13 : 4e param `composerBeta` route vers le composer profil-aware
      // si ON et cliente FR. Retourne { prompt, profile, blocked }. Si blocked
      // (ex: grossesse / allaitement non encore couvert), on stoppe net et
      // on alerte Anissa pour qu'elle desactive le composer ou attende le module.
      const promptResult = buildSystemPrompt(form, {
        isFollowup,
        clientFormule: client?.formule || '',
        followupWeek,
        planMode: getNutritionPlanMode(client), // V80 : oneshot vs followup
      }, client, composerBeta); // V86.6 : 3e param routing FR/EN. V96.13 : 4e composer beta.

      if (promptResult.blocked) {
        const reason = promptResult.profile?.blockReason || 'profil non supporte';
        // eslint-disable-next-line no-alert
        alert(`Composer beta : profil "${reason}" pas encore supporte. Decoche "Composer beta" pour generer ce plan via le path classique, ou attends qu'on ajoute le module dedie.`);
        setGenerating(false);
        return;
      }
      setLastDetectedProfile(promptResult.profile); // null si path legacy ou EN

      // V97.0 : passe par callClaude (raw=true pour garder l'objet data complet,
      // utilise plus bas dans le 3e appel "Fiche Frigo" via planData.content)
      const planData = await callClaude({
        system: promptResult.prompt,
        user: userMessage + '\n\nGenere le plan nutrition personnalise complet (sections 1 a 7) avec menus varies, listes de courses par semaine, et alternatives naturelles. Ne genere PAS la section supplements separement.',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 16000,
        raw: true,
      });
      // V55 : postProcess nettoie emojis, letter-spacing, markdown tables, arrows cassees
      let planText = postProcess(planData.content?.[0]?.text || '');

      // V96.16 — auto-retry fiche frigo SUPPRIME : la fiche frigo est construite
      // independamment du plan textuel via l'onglet dedie + fridgeDataBuilder
      // (extraction multi-source + edition manuelle Anissa via fiche_frigo_json).
      // Inutile de forcer Claude a ecrire une "section 5" dans le plan markdown.

      // Appel 2 : Supplements (conditionnel — seulement si client ouvert aux complements)
      // V86.9 : pour les clientes Benfitcoach EN, on utilise les prompts supplements EN
      // dedies (buildSupplementsSystemPromptEn + SUPPLEMENTS_INSTRUCTION_EN). Sinon, FR.
      const consultationLocale = getClientNutritionLocale(client);
      let suppText = '';
      const wantsSupplements = form.pretProtocole === 'Oui' || form.pretProtocole === 'Peut-etre';
      if (wantsSupplements) {
        const suppSystemPrompt = consultationLocale === 'EN'
          ? buildSupplementsSystemPromptEn()
          : buildSupplementsSystemPrompt();
        const suppInstruction = consultationLocale === 'EN'
          ? SUPPLEMENTS_INSTRUCTION_EN
          : SUPPLEMENTS_INSTRUCTION_FR;
        // V97.0 : passe par callClaude. On swallow toute erreur ici pour garder
        // le comportement legacy (suppText = '' si l'appel echoue, pas de throw).
        try {
          const suppRaw = await callClaude({
            system: suppSystemPrompt, // V48/V55 : prompt dedie STRICT
            user: userMessage + '\n\n' + suppInstruction,
            model: 'claude-sonnet-4-20250514',
            maxTokens: 4000,
            trim: false,
          });
          // V55 : double securite - strip leakage + postProcess
          suppText = postProcess(stripPlanLeakage(suppRaw || ''));
        } catch { /* silent : laisse suppText = '' */ }
      }
      updateField('supplements', suppText);
      setAutoCorrected(false);

      // Appel 3 : Audit de coherence (appel separe)
      let finalPlan = planText;
      let auditResult = '';
      const auditClientProfile = `PROFIL CLIENT :\n- Allergies : ${form.allergies || 'Aucune'}\n- Intolerances : ${form.alimentsEvites || 'Aucune'}\n- Pathologies : ${form.pathologies || 'Aucune'}\n- Traitements : ${form.traitements || 'Aucun'}`;
      const scoreFormData = { ...form, _weeklyFeedback: weeklyFeedback };

      // Helper: run audit on a plan
      // V97.0 : passe par callClaude. trim:false pour garder le contenu brut.
      const runAudit = async (planToAudit) => {
        try {
          return await callClaude({
            system: consultationLocale === 'EN' ? AUDIT_PROMPT_EN : AUDIT_PROMPT_FR,
            user: `${auditClientProfile}\n\nPLAN GENERE :\n${planToAudit}\n\nSUPPLEMENTS :\n${suppText || 'Aucun'}`,
            model: 'claude-sonnet-4-20250514',
            maxTokens: 4000,
            trim: false,
          });
        } catch { return ''; /* silent : audit best-effort */ }
      };

      // V49 : Audit garde en INTERNE uniquement — jamais dans le plan client (PDF)
      // Initial audit — utilise pour scoring et correction, mais pas injecte dans finalPlan
      auditResult = await runAudit(planText);

      // Score the plan (sans audit injecte — on score uniquement le plan)
      const initialScore = scorePlanQuality(planText, suppText, scoreFormData, { isFollowup, followupWeek });

      // Auto-correction: single attempt if score is too low or hard fail
      if (shouldAutoCorrect(initialScore)) {
        try {
          // V97.0 : passe par callClaude. trim:false pour preserver le format exact.
          const correctedRaw = await callClaude({
            // V49 : passer planText (sans audit injecte) pour eviter que Claude reprenne le texte d'audit
            system: buildCorrectionPrompt(planText, initialScore, form, auditResult),
            user: 'Corrige le plan ci-dessus selon les problemes detectes. Renvoie UNIQUEMENT le plan corrige, sans mentionner les problemes identifies, sans section "AUDIT", sans commentaires meta. Garde le meme format et la meme structure que l\'original.',
            model: 'claude-sonnet-4-20250514',
            maxTokens: 16000,
            trim: false,
          });

          if (correctedRaw) {
            // V62 : appliquer postProcess aussi au plan corrige (nettoyage emojis, fleches, letter-spacing)
            const correctedPlan = postProcess(correctedRaw);

            if (correctedPlan) {
              // Re-audit the corrected version (pour scoring uniquement)
              const correctedAuditResult = await runAudit(correctedPlan);
              const correctedFinal = correctedPlan; // V49 : pas d'injection audit

              // Re-score the corrected version
              const correctedScore = scorePlanQuality(correctedFinal, suppText, scoreFormData, { isFollowup, followupWeek });

              // Strict selection: never accept if new hard fail introduced
              if (!correctedScore.hasHardFail) {
                const fixedHardFail = initialScore.hasHardFail;
                const improvedWithoutRegression =
                  correctedScore.normalized > initialScore.normalized &&
                  correctedScore.coherence >= initialScore.coherence &&
                  correctedScore.constraints >= initialScore.constraints;

                if (fixedHardFail || improvedWithoutRegression) {
                  finalPlan = correctedFinal;
                  setAutoCorrected(true);
                }
              }
            }
          }
        } catch { /* correction failed silently — keep initial */ }
      }

      updateField('nutrition_plan', finalPlan);
      // Reseed l'editeur avec le nouveau plan genere (remount propre).
      reseedEditor(finalPlan, suppText, consultation.recipes);

      // Learning signal: log quality data for prompt improvement
      const wasAutoCorrected = finalPlan !== planText;
      const finalScore = scorePlanQuality(finalPlan, suppText, scoreFormData, { isFollowup, followupWeek });
      saveLearningSignal(buildLearningSignal(
        { ...form, _clientFormule: client?.formule || '' },
        { isFollowup, followupWeek, initialScore, finalScore, autoCorrected: wasAutoCorrected }
      ));

      // 3eme appel : Fiche Frigo structuree (JSON)
      try {
        const ficheInstruction = `A partir du plan nutrition et des supplements ci-dessous, genere UNIQUEMENT un objet JSON valide (sans texte autour, sans bloc markdown) avec cette structure exacte :

{
  "repas": {
    "petit_dejeuner": ["option 1", "option 2", "option 3"],
    "dejeuner": ["option 1", "option 2", "option 3"],
    "diner": ["option 1", "option 2", "option 3"],
    "collation": "suggestion de collation"
  },
  "a_privilegier": ["aliment 1", "aliment 2", "aliment 3"],
  "a_limiter": ["aliment 1", "aliment 2"],
  "hydratation": "ex: 2L/jour + tisanes",
  "supplements": {
    "matin_a_jeun": ["Fer 30mg + Vit C 500mg"],
    "petit_dejeuner": ["Vitamine D3 2000UI + K2"],
    "midi": ["Omega-3 2g"],
    "soir": ["Zinc 30mg"],
    "coucher": ["Magnesium 300mg"]
  }
}

Respecte EXACTEMENT ces noms de cles (snake_case). Chaque liste peut etre vide mais doit exister. Les options de repas doivent etre courtes et concretes (1-2 lignes max). Reponds UNIQUEMENT avec le JSON, sans backticks, sans texte autour.

--- PLAN NUTRITION ---
${planData.content?.[0]?.text || ''}

--- SUPPLEMENTS ---
${suppText}`;

        // V97.0 : passe par callClaude. Garde le parsing manuel (strip ``` + first/last brace)
        // car il a sa propre logique tolerante avant JSON.parse.
        const ficheRawText = await callClaude({
          system: 'Tu es un assistant qui structure des donnees nutritionnelles au format JSON strict.',
          user: ficheInstruction,
          model: 'claude-sonnet-4-20250514',
          maxTokens: 3000,
        });

        if (ficheRawText) {
          let raw = ficheRawText;
          // Strip ```json ... ``` fences si presents
          raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          // Extraire le premier objet JSON si du texte parasite
          const firstBrace = raw.indexOf('{');
          const lastBrace = raw.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            raw = raw.slice(firstBrace, lastBrace + 1);
          }
          try {
            const parsed = JSON.parse(raw);
            updateField('fiche_frigo_json', parsed);
          } catch (e) {
            console.warn('Fiche frigo JSON invalide, fallback regex active', e);
          }
        }
      } catch (ficheErr) {
        console.warn('Fiche frigo generation echouee (non bloquant)', ficheErr);
        showSaveToast('Fiche frigo non générée — le plan est sauvegardé sans elle');
      }

    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // V92.1 : handleTemplateSelect supprime (feature Templates retiree)

  // V94.57 : ref vers le dernier handleSave (resout closure stale dans
  // les setTimeout/callbacks qui declenchent la persistance globale).
  const handleSaveRef = useRef(null);

  const handleSave = () => {
    if (!consultation.mgd_recommendation) {
      showSaveToast('Sélectionne une recommandation biologique avant de sauvegarder');
      return;
    }

    // Safety : lire le DOM via ref au cas ou un keystroke est passe apres
    // le dernier debounce. Sinon, utiliser les drafts React (source habituelle).
    const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
    const planToSave = edited?.plan ?? planDraft;
    const suppToSave = edited?.supplements ?? supplementsDraft;
    const recipesToSave = edited?.recipes ?? recipesDraft;

    const mgdRec = consultation.mgd_recommendation || 'none';
    const bloodTestDone = mgdRec === 'blood' || mgdRec === 'advanced';
    const dnaTestDone = mgdRec === 'advanced';

    setConsultation(prev => ({
      ...prev,
      nutrition_plan: planToSave,
      supplements: suppToSave,
      recipes: recipesToSave,
    }));
    onSave({
      id: consultationId || undefined,
      clientId,
      consultantName: 'Anissa',
      date: initialConsultation?.date || new Date().toISOString(),
      observations: consultation.observations,
      bloodTestDone,
      dnaTestDone,
      mgdRecommendation: mgdRec,
      mgdRecommendedTestsText: consultation.mgd_recommended_tests_text || '',
      nutritionalObservations: consultation.nutritional_observations,
      nutritionPlan: planToSave,
      supplements: suppToSave,
      recipes: recipesToSave,
      notesForCoach: consultation.notes_for_coach,
      privateNotes: consultation.private_notes,
      ficheFrigoJson: consultation.fiche_frigo_json || null,
      labResults: consultation.lab_results || {},
      geneticResults: consultation.genetic_results || {},
      aiAnalysis: aiAnalysis || null,
      aiDirectives: aiDirectives || '', // V96.19 — override texte libre par cliente
      isFollowup,
      followupData: isFollowup ? {
        ...followupData,
        // Store previous values for PDF comparison
        _prevPoids: previousConsultation?.followupData?.poids_actuel || form.poids || null,
        _prevTourTaille: previousConsultation?.followupData?.tour_taille || form.tourTaille || null,
        _prevTourHanche: previousConsultation?.followupData?.tour_hanche || form.tourHanche || null,
        _prevTourBras: previousConsultation?.followupData?.tour_bras || form.tourBras || null,
        _prevTourCuisse: previousConsultation?.followupData?.tour_cuisse || form.tourCuisse || null,
        _prevMasseGrasse: previousConsultation?.followupData?.masse_grasse || form.masseGrasse || null,
      } : null,
      weeklyFeedback: isFollowup ? weeklyFeedback : null,
      followupWeek: isFollowup ? followupWeek : null,
      previousConsultationId: previousConsultation?.id || null,
      // V87.5 : tracabilite locale. Permet de filtrer les consultations EN
      // en prod (debug, support client, audit, stats usage).
      // Stocke dans le champ JSON followupData pour eviter de toucher au
      // schema DB. Accessible ensuite via consultation.followupData?._planLocale.
      planLocale: getClientNutritionLocale(client),
      // V88 : couche finalisation humaine. Propage au store.
      finalText: finalText || null,
      isFinal: isFinal,
      finalUpdatedAt: isFinal ? (consultation.finalUpdatedAt || new Date().toISOString()) : null,
      // V88.12 : historique versions finales
      finalVersions: finalVersions,
      // V94.57 : composantes app cliente persistees aussi (sinon perdues
      // au reload). Lettre d'intro IA + recettes detaillees IA + tone_*
      // ne sont pas dans le NutritionEditor mais doivent voyager avec
      // la consultation.
      intro_letter: consultation.intro_letter || null,
      meal_recipes: consultation.meal_recipes || null,
    });
    clearDraft(clientId, consultationId);
    isDirtyRef.current = false;
    setAutoSaveStatus('saved');
  };
  // V94.57 : sync le ref a chaque render pour pointer vers le handleSave
  // courant (qui ferme sur le state actuel de consultation).
  handleSaveRef.current = handleSave;

  return (
    <div className="nutrition-consultation">
      {/* V92.1 : modale NutritionTemplates supprimee — feature non utilisee en pratique */}

      {pendingAlerts && (
        <ContraIndicationAlert
          alerts={pendingAlerts}
          onCancel={() => setPendingAlerts(null)}
          onConfirm={() => { doGenerate(); }}
        />
      )}

      {showVersions && (
        <div className="ci-backdrop" role="dialog" aria-modal="true">
          <div className="ci-modal" style={{ borderTopColor: '#7c5cbf' }}>
            <div className="ci-header">
              <span className="ci-icon">🕐</span>
              <h3>Historique des versions du plan</h3>
            </div>
            <div style={{
              fontSize: '.7rem', color: 'rgba(255,255,255,.3)',
              fontStyle: 'italic', marginBottom: 8,
            }}>
              Sauvegardées localement · Non synchronisées entre appareils
            </div>
            <p className="ci-intro">
              {planVersions.length} version{planVersions.length > 1 ? 's' : ''} sauvegardee{planVersions.length > 1 ? 's' : ''} localement
              (max {3}). Tu peux restaurer une ancienne version en cas de besoin.
            </p>
            <ul className="ci-list">
              {planVersions.map((v) => (
                <li key={v.id}>
                  <strong>{v.label || 'Version sauvegardee'}</strong>
                  <div className="ci-desc">
                    {formatDate(v.savedAt)} · {(v.nutritionPlan || '').length} car.
                    {v.supplements ? ` · ${(v.supplements || '').length} car. supp.` : ''}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '.8rem' }}
                      onClick={async () => {
                        if (consultation.nutrition_plan) {
                          // V81 : modale propre (restauration = destructif)
                          const ok = await confirmDialog.ask({
                            title: 'Restaurer cette version ?',
                            message: 'Le plan actuel sera remplacé par cette version archivée. Le plan actuel sera sauvegardé avant restauration.',
                            danger: true,
                            confirmLabel: 'Restaurer',
                          });
                          if (!ok) return;
                          // Sauver l'actuel avant de restaurer
                          savePlanVersion(clientId, {
                            nutritionPlan: consultation.nutrition_plan,
                            supplements: consultation.supplements,
                            recipes: consultation.recipes,
                            ficheFrigoJson: consultation.fiche_frigo_json || null,
                            label: 'Avant restauration',
                          });
                        }
                        setConsultation(prev => ({
                          ...prev,
                          nutrition_plan: v.nutritionPlan || '',
                          supplements: v.supplements || '',
                          recipes: v.recipes || '',
                          fiche_frigo_json: v.ficheFrigoJson || null,
                        }));
                        reseedEditor(v.nutritionPlan || '', v.supplements || '', v.recipes || '');
                        setPlanVersions(getPlanVersions(clientId));
                        setShowVersions(false);
                      }}
                    >
                      Restaurer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="ci-actions">
              <button className="btn btn-secondary" onClick={() => setShowVersions(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* V84 : Header unifié (client + mode + statut + stepper) en 2 lignes compactes.
          Remplace nutrition-header + pipeline status bar + nutrition-steps — meme logique metier. */}
      {(() => {
        const current = consultation.status || 'questionnaire_recu';
        const statusInfo = PIPELINE_STATUSES.find(s => s.key === current) || PIPELINE_STATUSES[0];
        const suggested = suggestStatus(consultation);
        const suggestedInfo = suggested && suggested !== current ? PIPELINE_STATUSES.find(s => s.key === suggested) : null;
        const planMode = getNutritionPlanMode(client);
        const isOneShot = planMode === 'oneshot';
        return (
          <div className="nutrition-header-v2">
            {/* Ligne 1 : nom client + badges + statut */}
            <div className="nutrition-header-v2__top">
              <h2 className="nutrition-header-v2__client-name">{form.prenom || 'Client'}</h2>
              <div className="nutrition-header-v2__badges">
                <span
                  className="nhv2-badge"
                  data-variant={isOneShot ? 'gold' : 'green'}
                  title={isOneShot
                    ? 'Consultation unique — plan autonome pour 4 semaines'
                    : 'Accompagnement continu — plan évolutif'}
                >
                  {isOneShot ? 'Bilan individuel' : 'Suivi'}
                </span>
                {autoSaveStatus === 'unsaved' && (
                  <span className="nhv2-badge" data-variant="warn" title="Des modifications n'ont pas encore été enregistrées">
                    <span className="nhv2-dot" /> Non sauvegardé
                  </span>
                )}
                {autoSaveStatus === 'saving' && (
                  <span className="nhv2-badge" data-variant="warn-soft">⟳ Sauvegarde…</span>
                )}
              </div>
              <div className="nutrition-header-v2__spacer" />
              <div className="nutrition-header-v2__status">
                <span className="nhv2-status-label">Statut</span>
                <select
                  value={current}
                  onChange={(e) => updateField('status', e.target.value)}
                  style={{
                    background: statusInfo.color + '22',
                    border: `1px solid ${statusInfo.color}55`,
                    color: statusInfo.color,
                  }}
                  className="nhv2-status-select"
                >
                  {PIPELINE_STATUSES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                {suggestedInfo && (
                  <button
                    type="button"
                    onClick={() => updateField('status', suggested)}
                    className="nhv2-status-suggest"
                    style={{
                      background: suggestedInfo.color + '18',
                      border: `1px solid ${suggestedInfo.color}44`,
                      color: suggestedInfo.color,
                    }}
                  >
                    → {suggestedInfo.label}
                  </button>
                )}
              </div>
            </div>

            {/* Ligne 2 : stepper compact pills */}
            <div className="nutrition-header-v2__stepper">
              {stepLabels.map((label, i) => {
                const n = i + 1;
                const isActive = step === n;
                const isDone = step > n;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`nutrition-step-pill${isActive ? ' nutrition-step-pill--active' : ''}${isDone ? ' nutrition-step-pill--done' : ''}`}
                    onClick={() => setStep(n)}
                  >
                    <span className="nutrition-step-pill__num">{n}</span>
                    <span className="nutrition-step-pill__label">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Followup banner (sous le header V84) */}
      {isFollowup && previousConsultation && (
        <div className="followup-banner">
          Consultation de suivi — Semaine {followupWeek}/4 — Derniere consultation : {formatDate(previousConsultation.date)}
        </div>
      )}

      {/* Step: Client summary (read-only) */}
      {currentStepType === 'summary' && (
        <div className="nutrition-form-section">
          {/* Pre-RDV clinical summary */}
          {(() => {
            const summary = buildPreRdvSummary(form);
            if (!summary.hasData) return null;
            return (
              <div style={{ background: 'rgba(26,46,31,.15)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                <h4 style={{ fontSize: '.85rem', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Synthese pre-RDV</h4>
                {summary.objectif && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px' }}>Objectif</span>
                    <div style={{ fontSize: '.88rem', color: '#f0f0e8', fontWeight: 600, marginTop: 2 }}>{summary.objectif}</div>
                  </div>
                )}
                {summary.priorities.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px' }}>Priorites detectees</span>
                    <div style={{ marginTop: 4 }}>
                      {summary.priorities.map((p, i) => (
                        <div key={i} style={{ fontSize: '.83rem', color: '#f87171', display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span style={{ color: '#f87171', fontWeight: 700 }}>{i + 1}.</span> {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {summary.vigilance.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px' }}>Points de vigilance</span>
                    <div style={{ marginTop: 4 }}>
                      {summary.vigilance.map((v, i) => (
                        <div key={i} style={{ fontSize: '.83rem', color: '#fbbf24', display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span>&#9888;</span> {v}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {summary.axes.length > 0 && (
                  <div>
                    <span style={{ fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px' }}>Axes de travail</span>
                    <div style={{ marginTop: 4 }}>
                      {summary.axes.map((a, i) => (
                        <div key={i} style={{ fontSize: '.83rem', color: '#4ade80', display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span>&#8594;</span> {a}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <h3>Resume du client</h3>
          <p className="nutrition-readonly-notice">Donnees du profil (lecture seule)</p>
          <div className="nutrition-summary-grid">
            <div className="nutrition-summary-item">
              <label>Prenom</label>
              <div>{form.prenom || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Nom</label>
              <div>{form.nom || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Age</label>
              <div>{form.age ? `${form.age} ans` : 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Genre</label>
              <div>{form.genre || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Poids</label>
              <div>{form.poids ? `${form.poids} kg` : 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Taille</label>
              <div>{form.taille ? `${form.taille} cm` : 'Non renseigne'}</div>
            </div>
            {(form.tourTaille || form.tourHanche || form.masseGrasse) && (
              <div className="nutrition-summary-item full">
                <label>Mesures corporelles</label>
                <div>{
                  [
                    form.tourTaille ? `Taille: ${form.tourTaille}cm` : '',
                    form.tourHanche ? `Hanche: ${form.tourHanche}cm` : '',
                    form.tourPoitrine ? `Poitrine: ${form.tourPoitrine}cm` : '',
                    form.tourBras ? `Bras: ${form.tourBras}cm` : '',
                    form.tourCuisse ? `Cuisse: ${form.tourCuisse}cm` : '',
                    form.masseGrasse ? `MG: ${form.masseGrasse}%` : '',
                    form.masseMusculaire ? `MM: ${form.masseMusculaire}%` : '',
                  ].filter(Boolean).join(' | ')
                }</div>
              </div>
            )}
            <div className="nutrition-summary-item">
              <label>Formule</label>
              <div>{formule.nom || (client?.categorie === 'nutrition' ? 'Client nutrition' : 'Non renseigne')}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Email</label>
              <div>{form.email || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Telephone</label>
              <div>{form.telephone || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item full">
              <label>Objectifs</label>
              <textarea
                className="nutrition-summary-textarea"
                value={consultation.objectifs_display || [
                  form.objectifPrincipalNutrition,
                  form.objectifPrincipal,
                  form.objectifSecondaire,
                  form.objectif,
                  (form.symptomesObjectifs || []).join(', '),
                  form.motivationProfonde ? `Motivation : ${form.motivationProfonde}` : '',
                  form.pourquoiMaintenant ? `Pourquoi maintenant : ${form.pourquoiMaintenant}` : '',
                ].filter(Boolean).join(' | ') || ''}
                onChange={(e) => updateField('objectifs_display', e.target.value)}
                placeholder="Objectifs du client..."
                rows={2}
                style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 10px', color: '#d4c9a8', fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
            <div className="nutrition-summary-item full">
              <label>Habitudes alimentaires</label>
              <div>{
                [
                  form.objectifNutrition ? `Objectif : ${form.objectifNutrition}` : '',
                  form.preferencesAlimentaires ? `Preferences : ${form.preferencesAlimentaires}` : '',
                  form.nbRepas ? `${form.nbRepas} repas/jour` : '',
                  form.niveauCuisine ? `Cuisine : ${form.niveauCuisine}` : '',
                  form.frequenceRestaurant ? `Restaurant : ${form.frequenceRestaurant}` : '',
                  form.hydratation ? `Hydratation : ${form.hydratation}` : '',
                  form.digestion ? `Digestion : ${form.digestion}` : '',
                  form.alimentsEvites ? `Aliments evites : ${form.alimentsEvites}` : '',
                ].filter(Boolean).join(' | ') || 'Non renseigne'
              }</div>
            </div>
            <div className="nutrition-summary-item full">
              <label>Allergies / Intolerances</label>
              <div>{form.allergies || form.alimentsEvites || 'Aucune'}</div>
            </div>
            <div className="nutrition-summary-item full">
              <label>Activite sportive</label>
              <div>{
                [
                  form.niveau ? `Niveau : ${form.niveau}` : '',
                  form.frequence ? `${form.frequence}x/sem` : '',
                  form.duree || '',
                  form.lieu || '',
                  form.typeSport || '',
                  form.frequenceSport ? `${form.frequenceSport}x/sem` : '',
                  form.activitePhysique || '',
                ].filter(Boolean).join(' | ') || 'Non renseigne'
              }</div>
            </div>
          </div>

          <div style={{
            marginTop: 20,
            border: '1px solid rgba(197,176,122,.2)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            <button
              type="button"
              onClick={() => setMgdOpen(o => !o)}
              style={{
                width: '100%', padding: '14px 16px',
                background: mgdOpen
                  ? 'rgba(197,176,122,.1)' : 'rgba(197,176,122,.04)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 10,
                transition: 'background .2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '.85rem', fontWeight: 700, color: '#c5b07a' }}>
                  🧬 Analyse biologique (MGD)
                </span>
                {consultation.mgd_recommendation && consultation.mgd_recommendation !== 'none' && (
                  <span style={{
                    fontSize: '.68rem', padding: '2px 7px', borderRadius: 10,
                    background: 'rgba(197,176,122,.15)',
                    color: '#c5b07a', border: '1px solid rgba(197,176,122,.3)',
                  }}>
                    {consultation.mgd_recommendation === 'advanced' ? 'Bilan avancé' : 'Bilan sanguin'}
                  </span>
                )}
              </div>
              <span style={{ color: '#c5b07a', fontSize: '.8rem', transition: 'transform .2s',
                transform: mgdOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>
                ▾
              </span>
            </button>

            {mgdOpen && (
              <div style={{ padding: '16px', borderTop: '1px solid rgba(197,176,122,.1)' }}>
          {(() => {
            const symp = detectSymptomsFromForm(form);
            if (!symp.length) return null;
            const sympLabels = {
              fatigue: 'Fatigue', digestion: 'Digestion', bloating: 'Ballonnements',
              stress: 'Stress', sleep: 'Sommeil', cravings: 'Fringales sucre',
              inflammation: 'Inflammation', skin_hair: 'Peau / Cheveux',
              weight_gain: 'Surpoids', metabolic: 'Métabolisme',
              female_hormones: 'Hormones féminines', pms_cycle: 'SPM / Cycle',
              thyroid: 'Thyroïde', performance: 'Performance',
            };
            return (
              <div style={{
                marginTop: 20,
                padding: '12px 16px',
                background: 'rgba(106,191,138,.06)',
                border: '1px solid rgba(106,191,138,.2)',
                borderLeft: '3px solid rgba(106,191,138,.5)',
                borderRadius: 10,
              }}>
                <div style={{
                  fontSize: '.68rem', fontWeight: 700,
                  color: 'rgba(106,191,138,.6)',
                  textTransform: 'uppercase', letterSpacing: '.4px',
                  marginBottom: 8,
                }}>
                  Symptômes détectés — suggestions automatiques
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {symp.map(s => (
                    <span key={s} style={{
                      padding: '2px 8px', borderRadius: 20,
                      background: 'rgba(106,191,138,.1)',
                      border: '1px solid rgba(106,191,138,.2)',
                      fontSize: '.72rem', color: '#8abf9a',
                    }}>
                      {sympLabels[s] || s}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.25)', marginTop: 6 }}>
                  Ces suggestions sont basées sur le profil client. La décision finale reste la vôtre.
                </div>
              </div>
            );
          })()}

          <div style={{
            marginTop: 12,
            padding: '16px',
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: '.75rem', fontWeight: 700,
              color: '#c5b07a',
              textTransform: 'uppercase', letterSpacing: '.5px',
              marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              ⚕️ Recommandation bilan MGD
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  value: 'none',
                  label: 'Aucun test pour le moment',
                  desc: '',
                  color: 'rgba(255,255,255,.3)',
                },
                {
                  value: 'blood',
                  label: 'Bilan sanguin recommandé',
                  desc: 'Oméga-3 · Glycémie / Insuline · CRP · Vitamine D',
                  color: '#8abf9a',
                },
                {
                  value: 'advanced',
                  label: 'Bilan avancé recommandé',
                  desc: 'Bilan sanguin complet + Test ADN nutritionnel',
                  color: '#c5b07a',
                },
              ].map(opt => {
                const selected = consultation.mgd_recommendation === opt.value;
                return (
                  <label
                    key={opt.value}
                    onClick={() => updateField('mgd_recommendation', opt.value)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      background: selected ? 'rgba(255,255,255,.05)' : 'none',
                      border: selected
                        ? `1px solid ${opt.color}`
                        : '1px solid rgba(255,255,255,.05)',
                      transition: 'all .15s',
                    }}
                  >
                    {/* Radio visuel */}
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: `2px solid ${selected ? opt.color : 'rgba(255,255,255,.2)'}`,
                      background: selected ? opt.color : 'none',
                      flexShrink: 0, marginTop: 2,
                      transition: 'all .15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && (
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#1a2e1f',
                        }} />
                      )}
                    </div>
                    <div>
                      <div style={{
                        fontSize: '.83rem', fontWeight: 600,
                        color: selected ? opt.color : 'rgba(255,255,255,.5)',
                        transition: 'color .15s',
                      }}>
                        {opt.label}
                      </div>
                      {opt.desc && (
                        <div style={{
                          fontSize: '.72rem',
                          color: selected ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.2)',
                          marginTop: 2,
                        }}>
                          {opt.desc}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Lab results input (shown when blood test is done) */}
          {(consultation.mgd_recommendation === 'blood' || consultation.mgd_recommendation === 'advanced') && (
            <div style={{
              marginTop: 16,
              padding: '16px',
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
            }}>
              <div style={{
                fontSize: '.75rem', fontWeight: 700,
                color: '#c5b07a',
                textTransform: 'uppercase', letterSpacing: '.5px',
                marginBottom: 12,
              }}>
                🔬 Résultats biologiques
              </div>
              <p style={{ fontSize: '.75rem', color: '#6b5f48', marginBottom: 10 }}>
                Saisis les valeurs disponibles. Les champs vides sont ignorés.
              </p>

              {/* V45 : Quick Fills — bilans pre-configures */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '.7rem', color: '#6b5f48', marginRight: 4 }}>
                    Bilan type :
                  </span>
                  {LAB_QUICK_FILLS.map(qf => {
                    const isActive = activeLabQuickFill === qf.id;
                    return (
                      <button
                        key={qf.id}
                        type="button"
                        onClick={() => setActiveLabQuickFill(isActive ? null : qf.id)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '.72rem',
                          fontWeight: isActive ? 700 : 500,
                          borderRadius: 20,
                          border: `1px solid ${isActive ? 'rgba(197,176,122,.5)' : 'rgba(255,255,255,.12)'}`,
                          background: isActive ? 'rgba(197,176,122,.14)' : 'rgba(255,255,255,.03)',
                          color: isActive ? '#d4c9a8' : 'rgba(255,255,255,.65)',
                          cursor: 'pointer',
                          transition: 'all .15s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {qf.icon} {qf.label}
                      </button>
                    );
                  })}
                  {activeLabQuickFill && (
                    <button
                      type="button"
                      onClick={() => setActiveLabQuickFill(null)}
                      style={{
                        padding: '6px 10px',
                        fontSize: '.7rem',
                        fontWeight: 500,
                        borderRadius: 20,
                        border: '1px solid rgba(255,255,255,.12)',
                        background: 'transparent',
                        color: 'rgba(255,255,255,.45)',
                        cursor: 'pointer',
                        marginLeft: 4,
                      }}
                    >
                      ✕ Tout afficher
                    </button>
                  )}
                </div>
                {activeLabQuickFill && (() => {
                  const qf = LAB_QUICK_FILLS.find(q => q.id === activeLabQuickFill);
                  return (
                    <div style={{ marginTop: 8, fontSize: '.68rem', color: '#6b5f48' }}>
                      {qf.markers.length} marqueurs attendus pour ce bilan. Les autres restent disponibles via "Tout afficher".
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {(activeLabQuickFill
                  ? LAB_MARKERS_UI.filter(m => LAB_QUICK_FILLS.find(q => q.id === activeLabQuickFill)?.markers.includes(m.key))
                  : LAB_MARKERS_UI
                ).map(({ key, label, unit }) => (
                  <div key={key} className="field" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '.72rem' }}>
                      {label} <span style={{ textTransform: 'none' }}>({unit})</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={consultation.lab_results?.[key] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setConsultation(prev => ({
                          ...prev,
                          lab_results: { ...prev.lab_results, [key]: val === '' ? '' : Number(val) },
                        }));
                      }}
                      placeholder="-"
                      style={{ fontSize: '.8rem', padding: '6px 8px' }}
                    />
                  </div>
                ))}
              </div>

              {/* Live interpretation preview */}
              {(() => {
                if (!hasLabData) return null;
                const analysis = labAnalysisMemo;
                if (!analysis || analysis.signals.length === 0) return (
                  <div style={{ marginTop: 10, fontSize: '.78rem', color: '#2a9d5c' }}>Tous les marqueurs saisis sont dans les normes fonctionnelles.</div>
                );
                return (
                  <div style={{ marginTop: 10, background: 'rgba(124,92,191,.06)', borderRadius: 8, padding: '10px 14px', fontSize: '.78rem' }}>
                    <strong style={{ display: 'block', marginBottom: 6, color: '#d4c9a8' }}>Signaux detectes ({analysis.signals.length})</strong>
                    {analysis.adjustments.slice(0, 6).map((adj, i) => (
                      <div key={i} style={{ marginBottom: 6 }}>
                        <span style={{ color: '#d4c9a8', fontWeight: 600 }}>{adj.label}</span>
                        <span style={{ color: '#6b5f48', marginLeft: 6 }}>— {adj.dietary[0]}</span>
                        {adj.caution && <div style={{ color: '#d45c4c', fontSize: '.72rem', marginTop: 2 }}>{adj.caution}</div>}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Corrélations symptômes ↔ biologie */}
              {(() => {
                const correlation = mgdCorrelationMemo;
                if (!correlation) return null;
                if (!correlation.hasCorrelations && !correlation.uncorrelatedSignals.length) return null;

                return (
                  <div style={{
                    marginTop: 12,
                    padding: '12px 14px',
                    background: correlation.hasCritical
                      ? 'rgba(248,113,113,.06)' : 'rgba(197,176,122,.05)',
                    border: `1px solid ${correlation.hasCritical
                      ? 'rgba(248,113,113,.2)' : 'rgba(197,176,122,.15)'}`,
                    borderRadius: 10,
                  }}>
                    <div style={{
                      fontSize: '.72rem', fontWeight: 700,
                      color: correlation.hasCritical ? '#f87171' : '#c5b07a',
                      textTransform: 'uppercase', letterSpacing: '.4px',
                      marginBottom: 10,
                    }}>
                      🔗 Corrélations symptômes ↔ biologie
                    </div>

                    {/* Résumé clinique — en haut, lecture rapide */}
                    {correlation.clinicalSummary && (
                      <div style={{
                        marginBottom: 12, padding: '10px 12px',
                        background: correlation.hasCritical
                          ? 'rgba(248,113,113,.1)' : 'rgba(197,176,122,.08)',
                        borderRadius: 8,
                        borderLeft: `3px solid ${correlation.hasCritical ? '#f87171' : '#c5b07a'}`,
                      }}>
                        <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#f0f0e8', marginBottom: 3 }}>
                          {correlation.hasCritical ? '⚠️' : '📋'} {correlation.clinicalSummary.mainIssue}
                        </div>
                        <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.5)' }}>
                          Confirmé par : {correlation.clinicalSummary.confirmedBy}
                        </div>
                        {correlation.clinicalSummary.topAction && (
                          <div style={{ fontSize: '.75rem', color: '#8abf9a', marginTop: 4, fontStyle: 'italic' }}>
                            → {correlation.clinicalSummary.topAction.slice(0, 80)}
                            {correlation.clinicalSummary.topAction.length > 80 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Corrélations priorisées */}
                    {correlation.correlations.map((c, i) => {
                      const priorityColors = {
                        high:   { bg: 'rgba(248,113,113,.06)', border: 'rgba(248,113,113,.3)', badge: '#f87171', label: 'Priorité haute' },
                        medium: { bg: 'rgba(251,191,36,.05)',  border: 'rgba(251,191,36,.25)', badge: '#fbbf24', label: 'Priorité moyenne' },
                        watch:  { bg: 'rgba(255,255,255,.03)', border: 'rgba(255,255,255,.08)', badge: '#94a3b8', label: 'Surveillance' },
                      };
                      const pc = priorityColors[c.priority] || priorityColors.watch;
                      return (
                        <div key={i} style={{
                          marginBottom: 6, padding: '7px 10px',
                          background: pc.bg, borderRadius: 7,
                          border: `1px solid ${pc.border}`,
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                        }}>
                          <span style={{
                            fontSize: '.6rem', fontWeight: 700, padding: '2px 6px',
                            borderRadius: 10, background: pc.border, color: pc.badge,
                            whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1,
                          }}>
                            {pc.label}
                          </span>
                          <div>
                            <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#e0d8c0' }}>
                              {c.symptomLabel}
                            </div>
                            <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.35)', marginTop: 1 }}>
                              {c.confirmedBy.map(b => b.label).join(' · ')}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Actions prioritaires */}
                    {correlation.alerts.length > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 10,
                        borderTop: '1px solid rgba(255,255,255,.06)' }}>
                        <div style={{ fontSize: '.68rem', fontWeight: 700,
                          color: '#f87171', textTransform: 'uppercase',
                          letterSpacing: '.3px', marginBottom: 8 }}>
                          ⚡ Actions prioritaires
                        </div>
                        {correlation.alerts.slice(0, 3).map((a, i) => (
                          <div key={i} style={{
                            fontSize: '.75rem', color: '#b0c4a8',
                            paddingLeft: 10,
                            borderLeft: '2px solid rgba(248,113,113,.3)',
                            marginBottom: 6, lineHeight: 1.5,
                          }}>
                            <strong style={{ color: '#f87171' }}>{a.label}</strong>
                            <span style={{ color: 'rgba(255,255,255,.35)', marginLeft: 6 }}>
                              — {a.action}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CTA — Régénérer avec MGD */}
                    {correlation.hasCorrelations && (
                      <button
                        type="button"
                        onClick={() => {
                          setStep(2);
                          setTimeout(() => {
                            handleGenerate();
                          }, 150);
                        }}
                        style={{
                          width: '100%', marginTop: 12, padding: '9px',
                          borderRadius: 8, border: '1px solid rgba(106,191,138,.25)',
                          background: 'rgba(106,191,138,.08)', color: '#8abf9a',
                          cursor: 'pointer', fontSize: '.8rem', fontWeight: 600,
                          transition: 'all .15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background='rgba(106,191,138,.18)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='rgba(106,191,138,.08)'; }}
                      >
                        ✨ Régénérer le plan avec les priorités MGD
                      </button>
                    )}

                    {/* Signaux sans symptôme déclaré */}
                    {correlation.uncorrelatedSignals.length > 0 && (
                      <div style={{
                        marginTop: 8, fontSize: '.7rem',
                        color: 'rgba(255,255,255,.25)', fontStyle: 'italic',
                      }}>
                        Signaux détectés sans symptôme déclaré — à explorer au prochain RDV.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Analyses recommandées MGD */}
              <div style={{
                marginTop: 16,
                padding: '16px',
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 12,
              }}>
                <div style={{
                  fontSize: '.75rem', fontWeight: 700,
                  color: '#c5b07a', textTransform: 'uppercase',
                  letterSpacing: '.5px', marginBottom: 12,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span>📝 Analyses recommandées (MGD)</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const generated = buildRecommendedBloodTests(form);
                        setConsultation(prev => ({
                          ...prev,
                          mgd_recommended_tests_text: generated,
                        }));
                      }}
                      style={{
                        padding: '3px 10px', borderRadius: 6,
                        border: '1px solid rgba(197,176,122,.3)',
                        background: 'rgba(197,176,122,.1)',
                        color: '#c5b07a', cursor: 'pointer',
                        fontSize: '.72rem', fontWeight: 600,
                      }}
                    >
                      ✨ Générer
                    </button>
                    {/* V50 : Export PDF directement dans la section MGD */}
                    <button
                      type="button"
                      onClick={() => {
                        setAnalysesError('');
                        const symp = detectSymptomsFromForm(form);
                        const recs = getEnrichedMGDRecommendations(symp);
                        const val = validateAnalysesPDF(symp, recs);
                        if (!val.valid) {
                          setAnalysesError('Export bloque : ' + val.errors.join(' | '));
                          return;
                        }
                        exportAnalysesPDF(recs, symp, clientName, formatDate(today));
                      }}
                      style={{
                        padding: '3px 10px', borderRadius: 6,
                        border: '1px solid rgba(106,191,138,.3)',
                        background: 'rgba(106,191,138,.1)',
                        color: '#8abf9a', cursor: 'pointer',
                        fontSize: '.72rem', fontWeight: 600,
                      }}
                    >
                      📄 Export prescription labo
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsultation(prev => ({
                        ...prev,
                        mgd_recommended_tests_text: '',
                      }))}
                      style={{
                        padding: '3px 10px', borderRadius: 6,
                        border: '1px solid rgba(255,255,255,.08)',
                        background: 'none',
                        color: 'rgba(255,255,255,.3)', cursor: 'pointer',
                        fontSize: '.72rem',
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
                {analysesError && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 6, color: '#f87171', fontSize: '.75rem' }}>
                    {analysesError}
                  </div>
                )}
                <textarea
                  value={consultation.mgd_recommended_tests_text || ''}
                  onChange={e => setConsultation(prev => ({
                    ...prev,
                    mgd_recommended_tests_text: e.target.value,
                  }))}
                  placeholder="Clique sur Générer pour obtenir les analyses recommandées, ou saisis manuellement..."
                  style={{
                    width: '100%', minHeight: 100,
                    background: 'rgba(0,0,0,.2)',
                    border: '1px solid rgba(255,255,255,.08)',
                    borderRadius: 8, padding: '10px 12px',
                    color: '#d4c9a8', fontSize: '.82rem',
                    lineHeight: 1.7, fontFamily: 'inherit',
                    resize: 'vertical', outline: 'none',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(197,176,122,.4)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,.08)'; }}
                />
                <div style={{
                  fontSize: '.7rem', color: 'rgba(255,255,255,.2)',
                  marginTop: 6,
                }}>
                  Basé sur le profil client. Modifiable librement.
                </div>
              </div>
            </div>
          )}

          {/* V46 : Tests génétiques (ADN) — visible si dna_test_done ou advanced */}
          {(consultation.dna_test_done || consultation.mgd_recommendation === 'advanced') && (
            <div style={{
              marginTop: 16,
              padding: '16px',
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
            }}>
              <div style={{
                fontSize: '.75rem', fontWeight: 700,
                color: '#c5b07a',
                textTransform: 'uppercase', letterSpacing: '.5px',
                marginBottom: 12,
              }}>
                🧬 Tests génétiques (ADN)
              </div>
              <p style={{ fontSize: '.75rem', color: '#6b5f48', marginBottom: 12 }}>
                Renseignez les variants disponibles. Les tests non renseignés sont ignorés.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {GENE_CATALOG.map(gene => (
                  <div key={gene.id} className="field" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '.72rem', display: 'block' }}>
                      {gene.label}
                      <span style={{ color: '#6b5f48', fontWeight: 400, fontSize: '.65rem', marginLeft: 6 }}>
                        — {gene.description}
                      </span>
                    </label>
                    <select
                      value={consultation.genetic_results?.[gene.id] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setConsultation(prev => ({
                          ...prev,
                          genetic_results: { ...(prev.genetic_results || {}), [gene.id]: val },
                        }));
                      }}
                      style={{ fontSize: '.8rem', padding: '6px 8px', width: '100%' }}
                    >
                      {gene.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Live preview des ajustements actifs */}
              {(() => {
                const active = getActiveGeneticAdjustments(consultation.genetic_results);
                if (active.length === 0) return (
                  <div style={{ marginTop: 12, fontSize: '.75rem', color: '#6b5f48', fontStyle: 'italic' }}>
                    Aucun variant significatif renseigné pour le moment.
                  </div>
                );
                return (
                  <div style={{ marginTop: 12, background: 'rgba(124,92,191,.06)', borderRadius: 8, padding: '10px 14px', fontSize: '.78rem' }}>
                    <strong style={{ display: 'block', marginBottom: 6, color: '#d4c9a8' }}>
                      🧬 Variants actifs ({active.length}) — seront intégrés au plan
                    </strong>
                    {active.map((adj, i) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <div style={{ color: '#d4c9a8', fontWeight: 600, fontSize: '.75rem' }}>{adj.label}</div>
                        {adj.note && (
                          <div style={{ color: '#6b5f48', fontSize: '.7rem', marginTop: 2 }}>{adj.note}</div>
                        )}
                        {adj.recos && adj.recos.length > 0 && (
                          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '.7rem', marginTop: 3 }}>
                            → {adj.recos[0]}
                            {adj.recos.length > 1 && <span style={{ color: '#6b5f48' }}> (+{adj.recos.length - 1} autres)</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step: Follow-up (only for returning clients) */}
      {currentStepType === 'followup' && (
        <>
          <div className="nutrition-form-section" style={{ marginBottom: 16 }}>
            <h3>Suivi semaine {followupWeek}/4</h3>
            <p style={{ fontSize: '.85rem', color: '#8a8a7a', marginBottom: 12 }}>
              {followupWeek === 1 && 'Evaluation de la tolerance et de l\'adherence au plan initial.'}
              {followupWeek === 2 && 'Premiers ajustements energie, faim et digestion.'}
              {followupWeek === 3 && 'Optimisation des portions, timing et recuperation.'}
              {followupWeek === 4 && 'Consolidation des acquis et preparation a l\'autonomie.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { key: 'energy', label: 'Energie' },
                { key: 'digestion', label: 'Digestion' },
                { key: 'hunger', label: 'Faim / Satiete' },
                { key: 'adherence', label: 'Adherence au plan' },
                { key: 'performance', label: 'Performance' },
                { key: 'cravings', label: 'Fringales / Envies' },
              ].map(({ key, label }) => (
                <div key={key} className="field">
                  <label>{label}</label>
                  <select
                    value={weeklyFeedback[key]}
                    onChange={e => setWeeklyFeedback(prev => ({ ...prev, [key]: e.target.value }))}
                  >
                    <option value="">--</option>
                    <option value="Nettement ameliore">Nettement ameliore</option>
                    <option value="Legerement ameliore">Legerement ameliore</option>
                    <option value="Identique">Identique</option>
                    <option value="Degrade">Degrade</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="field full-width" style={{ marginTop: 10 }}>
              <label>Notes client cette semaine</label>
              <textarea
                value={weeklyFeedback.notes}
                onChange={e => setWeeklyFeedback(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                placeholder="Observations, difficultes, questions..."
              />
            </div>
          </div>
          <FollowUpStep
            followupData={followupData}
            onChange={setFollowupData}
            previousConsultation={previousConsultation}
            clientForm={form}
          />
        </>
      )}

      {/* Observations step removed — data auto-populated from client questionnaire and used in AI prompt */}

      {/* Step: Nutrition Plan — cockpit clinique SaaS */}
      {currentStepType === 'plan' && (() => {
        const hasPlan = !!(planDraft || consultation.nutrition_plan);
        const clientName = form.prenom || client?.prenom || 'Client';
        const today = new Date().toISOString();

        // Source de verite unique : les drafts React (push-based depuis l'editeur).
        // Pour les exports, on fait une lecture ref finale en cas de keystroke non debounced.
        const readEdited = () => {
          const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
          return {
            plan: edited?.plan ?? planDraft,
            supplements: edited?.supplements ?? supplementsDraft,
            recipes: edited?.recipes ?? recipesDraft,
          };
        };

        const doExportPdf = async () => {
          if (import.meta.env.DEV) console.log('[PDF] doExportPdf CALLED');
          setPdfError('');
          const edited = readEdited();
          // V88 : prime finalText si present (couche humaine au-dessus du plan IA).
          // Sinon, fallback sur le plan IA edite par l'utilisateur.
          const plan = (isFinal && finalText) ? finalText : edited.plan;
          const supplements = edited.supplements;
          const recipes = edited.recipes;
          if (isFinal && finalText) {
            if (import.meta.env.DEV) console.log('[PDF] using FINAL version (length:', finalText.length, ')');
          }
          if (import.meta.env.DEV) console.log('[PDF] plan length:', plan?.length, 'supplements length:', supplements?.length);
          const currentScore = scorePlanQuality(plan, supplements, { ...form, _weeklyFeedback: weeklyFeedback }, { isFollowup, followupWeek });
          const fullText = (plan || '') + '\n' + (supplements || '');
          const validation = validatePlanForPDF(fullText, currentScore, { isFollowup });
          if (import.meta.env.DEV) console.log('[PDF] validation:', validation);
          if (!validation.valid) {
            if (import.meta.env.DEV) console.log('[PDF] BLOCKED by validation:', validation.errors);
            setPdfError('Export bloque : ' + validation.errors.join(' | '));
            return;
          }
          const sections = structurePlanSections(plan, supplements, { isFollowup, locale: getClientNutritionLocale(client) });
          if (import.meta.env.DEV) console.log('[PDF DEBUG] sections:', sections.length, sections.map(s => ({ title: s.title, type: s.type, contentLen: s.content?.length })));
          try {
            await exportConsultationPDF({
              observations: consultation.observations,
              nutritionalObservations: consultation.nutritional_observations,
              bloodTestDone: consultation.blood_test_done,
              dnaTestDone: consultation.dna_test_done,
              nutritionPlan: cleanPlanForPDF(plan),
              supplements: cleanPlanForPDF(supplements),
              recipes,
              notesForCoach: consultation.notes_for_coach,
              date: new Date().toISOString(),
              isFollowup,
              followupData: isFollowup ? followupData : null,
              sections,
            }, client);
            showSaveToast('PDF exporte');
          } catch (err) {
            console.error('PDF export failed', err);
            setPdfError('Export PDF echoue : ' + (err?.message || 'erreur inconnue'));
          }
        };

        const doExportPack = async () => {
          setPdfError('');
          const edited = readEdited();
          // V88 : prime finalText si version finale active
          const plan = (isFinal && finalText) ? finalText : edited.plan;
          const supplements = edited.supplements;
          const recipes = edited.recipes;
          const currentScore = scorePlanQuality(plan, supplements, { ...form, _weeklyFeedback: weeklyFeedback }, { isFollowup, followupWeek });
          const fullText = (plan || '') + '\n' + (supplements || '');
          const validation = validatePlanForPDF(fullText, currentScore, { isFollowup });
          if (!validation.valid) {
            setPdfError('Export dossier bloque : ' + validation.errors.join(' | '));
            return;
          }
          const sections = structurePlanSections(plan, supplements, { isFollowup, locale: getClientNutritionLocale(client) });
          const labDataForPdf = consultation.lab_results || {};
          const hasLabForPdf = Object.values(labDataForPdf).some(v => v !== '' && v != null);
          const correlationForPdf = hasLabForPdf
            ? buildMGDCorrelation(
                detectSymptomsFromForm(form),
                analyzeLabResults(labDataForPdf).signals || []
              )
            : null;
          try {
            await exportClientPackPDF({
              nutritionPlan: cleanPlanForPDF(plan),
              supplements: cleanPlanForPDF(supplements),
              recipes,
              date: new Date().toISOString(),
              isFollowup,
              sections,
              mgdRecommendation: consultation.mgd_recommendation || 'none',
              bloodTestDone: consultation.mgd_recommendation === 'blood' || consultation.mgd_recommendation === 'advanced',
              dnaTestDone: consultation.mgd_recommendation === 'advanced',
            }, client, {
              sections,
              coverFields: {
                prenom: form.prenom || client?.prenom || '',
                objectif: form.objectifPrincipalNutrition || form.objectifPrincipal || '',
              }, // V92.1 : forme inline preservee pour exportClientPackPDF (compat)
              mgdCorrelation: correlationForPdf,
            });
            showSaveToast('Dossier client exporte');
          } catch (err) {
            console.error('Pack export failed', err);
            setPdfError('Export dossier echoue : ' + (err?.message || 'erreur inconnue'));
          }
        };

        // V92.1 : doExportCover supprime — Word V92.0 gere sa propre cover

        const renderEditorTab = () => {
          if (editorTab === 'plan') {
            if (hasPlan) {
              return (
                <>
                  {/* Ressenti 7 jours de la cliente — lecture seule. Visible
                      en haut pour qu'Anissa l'ait sous les yeux avant de
                      modifier le plan. Auto-collapse si pas de feedbacks. */}
                  <ClientFeedbacksPanel client={client} consultation={consultation} />

                  {/* V94.49 : ClientAppSettingsCard deplace dans l'onglet
                      'App cliente' > 'Vue d'ensemble' pour eliminer le doublon
                      visuel ('📱 App cliente' + '⚙ Reglages app cliente'
                      coexistaient sur l'onglet 'plan'). */}

                  <NutritionEditor
                    key={`editor-${editorSeed}`}
                    planText={planDraft}
                    supplementsText={supplementsDraft}
                    recipesText={recipesDraft}
                    form={form}
                    client={client}
                    getEditedDataRef={editorGetDataRef}
                    onDraftChange={handleDraftChange}
                    hideActions
                    flashSectionType={flashSectionType}
                    readOnly={isReviewMode}
                    onSave={(plan, supplements, recipes) => {
                      setConsultation(prev => ({ ...prev, nutrition_plan: plan, supplements, recipes }));
                      setPlanDraft(plan);
                      setSupplementsDraft(supplements);
                      setRecipesDraft(recipes);
                    }}
                    onExportPDF={() => doExportPdf()}
                    onExportPack={() => doExportPack()}
                  />
                </>
              );
            }
            return (
              <div style={{ padding: 24, textAlign: 'center', color: '#8a8a7a', background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.1)', borderRadius: 12 }}>
                <p style={{ marginBottom: 12, fontSize: '.9rem' }}>Aucun plan genere pour l'instant.</p>
                <p style={{ fontSize: '.8rem' }}>Utilise le bouton <strong>Regenerer</strong> en haut, ou un template, pour creer le plan initial.</p>
              </div>
            );
          }
          if (editorTab === 'frigo') {
            const fj = consultation.fiche_frigo_json;
            return (
              <div style={{ padding: 16 }}>
                <p style={{ fontSize: '.82rem', color: '#8a8a7a', marginBottom: 12 }}>
                  Edite et reorganise la fiche frigo (3 vues : apercu, edition, vue client).
                </p>
                <button
                  type="button"
                  className="btn btn-anissa-primary"
                  onClick={() => setShowFrigoModal(true)}
                  disabled={!hasPlan}
                  style={{ padding: '10px 18px', borderRadius: 10 }}
                >
                  Ouvrir l'editeur fiche frigo
                </button>
                {fj ? (
                  <div style={{ marginTop: 16, background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 12px', fontSize: '.78rem', color: '#c0b890', lineHeight: 1.55 }}>
                    <strong style={{ display: 'block', marginBottom: 6, color: '#d4c9a8' }}>Fiche structuree disponible</strong>
                    <div>Petit-dej : {(fj.repas?.petit_dejeuner || []).length} option(s)</div>
                    <div>Dejeuner : {(fj.repas?.dejeuner || []).length} option(s)</div>
                    <div>Diner : {(fj.repas?.diner || []).length} option(s)</div>
                    <div>A privilegier : {(fj.a_privilegier || []).length} / A limiter : {(fj.a_limiter || []).length}</div>
                  </div>
                ) : hasPlan ? (
                  <div style={{ marginTop: 12, fontSize: '.78rem', color: '#8a7a5a' }}>
                    Pas de JSON structure — la fiche frigo sera construite depuis le plan texte.
                  </div>
                ) : null}
              </div>
            );
          }
          // V96.33 : blocs editorTab === 's1s4' et 'supp' supprimes — onglets retires
          // (Anissa peaufine plan + supplements directement dans Word apres export V92.0).
          // Les states/donnees consultation.supplements et consultation.recipes restent
          // intacts et sont injectes dans le Word + la generation IA.
          // V94.41 → V94.48 : Hub app cliente complet — vue d'ensemble + Lettre IA
          // + Recettes IA + Messages + Ressources + Signaux. Separe du peaufinage
          // plan textuel pour clarifier les 2 mindsets (plan vs publication digitale).
          if (editorTab === 'app') {
            return (
              <div style={{ padding: 12 }}>
                <ClientAppPanel
                  client={client}
                  consultation={consultation}
                  form={form}
                  hasPlan={hasPlan}
                  onUpdateConsultation={(patch) => {
                    setConsultation((prev) => ({ ...prev, ...patch }));
                  }}
                  onOpenPreview={() => setShowClientAppPreview(true)}
                  // V94.57 : permet aux sous-onglets (Lettre/Recettes) de
                  // declencher la persistance globale apres save local.
                  // setTimeout + handleSaveRef.current : on attend le re-render
                  // post-setState, puis on appelle la version la plus recente
                  // de handleSave (avec le state mis a jour).
                  onPersistGlobally={() => {
                    setTimeout(() => handleSaveRef.current?.(), 0);
                  }}
                />
              </div>
            );
          }
          return null;
        };

        // V76 : renderPreviewTab retire — l'editeur est deja un apercu premium fidele.

        const Tab = ({ active, onClick, children }) => (
          <button
            type="button"
            onClick={onClick}
            className="nc-tab"
            style={{
              background: active ? 'rgba(106,191,138,.18)' : 'transparent',
              border: `1px solid ${active ? 'rgba(106,191,138,.4)' : 'rgba(255,255,255,.08)'}`,
              color: active ? '#9dd4b0' : '#8a8a7a',
              fontSize: '.78rem',
              fontWeight: 600,
              letterSpacing: '.02em',
              padding: '7px 14px',
              borderRadius: 999,
              cursor: 'pointer',
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            }}
          >{children}</button>
        );

        return (
          <div className="nc-cockpit" style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'auto', minHeight: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
            {/* ─── HEADER ACTIONS ─── */}
            <div className="nc-cockpit-header" style={{ position: 'sticky', top: 0, zIndex: 5, background: 'rgba(12,18,15,.92)', backdropFilter: 'blur(10px)', border: '1px solid rgba(106,191,138,.15)', borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Meta line */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* V83.1 : mini logo Anissa dans le cockpit sticky — reste visible au scroll */}
                  <img
                    src="/logo-anissa.png"
                    alt="Anissa Nutrition"
                    style={{ height: 28, width: 'auto', flexShrink: 0, opacity: .9 }}
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span style={{ fontSize: '.72rem', color: '#8abf9a', textTransform: 'uppercase', letterSpacing: '.2em', fontWeight: 600 }}>Plan nutrition</span>
                  <span style={{ fontSize: '.82rem', color: '#d4c9a8', fontWeight: 500 }}>{clientName}</span>
                  {/* V80 : badge mode (one-shot vs suivi) — discret, lu depuis client.packType */}
                  {(() => {
                    const planMode = getNutritionPlanMode(client);
                    const isOneShot = planMode === 'oneshot';
                    return (
                      <span
                        title={isOneShot
                          ? 'Consultation unique — plan autonome pour 4 semaines'
                          : 'Accompagnement continu — plan évolutif'}
                        style={{
                          fontSize: '.7rem',
                          background: isOneShot ? 'rgba(196,160,80,.16)' : 'rgba(106,191,138,.16)',
                          color: isOneShot ? '#d4b568' : '#8abf9a',
                          padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                        }}
                      >
                        {isOneShot ? 'Bilan individuel' : 'Suivi'}
                      </span>
                    );
                  })()}
                  {isFollowup && <span style={{ fontSize: '.7rem', background: 'rgba(124,92,191,.18)', color: '#b49ce0', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>Suivi S{followupWeek}/4</span>}
                  {/* V88 : badge Version finale visible si la consultation a une couche finalisation active */}
                  {isFinal && (
                    <span
                      title={consultation.finalUpdatedAt ? `Finalisee le ${new Date(consultation.finalUpdatedAt).toLocaleString('fr-CH')}` : 'Version finale active \u2014 le PDF utilise la version editee'}
                      style={{
                        fontSize: '.7rem',
                        background: 'rgba(196,160,80,.22)',
                        color: '#e0cda0',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontWeight: 700,
                        border: '1px solid rgba(196,160,80,.45)',
                      }}
                    >
                      {'\u270d\ufe0f'} Version finale
                    </span>
                  )}
                  {autoCorrected && <span style={{ fontSize: '.7rem', background: 'rgba(255,200,60,.15)', color: '#e8c560', padding: '2px 8px', borderRadius: 999 }}>Auto-corrige</span>}
                  {/* V81 : indicateur dirty state visible dans le header (remplace le petit texte bas droit) */}
                  {autoSaveStatus === 'unsaved' && (
                    <span
                      title="Des modifications n'ont pas encore été enregistrées"
                      style={{
                        fontSize: '.7rem',
                        background: 'rgba(232,160,64,.18)',
                        color: '#e8a040',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#e8a040',
                        animation: 'ncDirtyPulse 1.8s ease-in-out infinite',
                      }} />
                      Non sauvegardé
                    </span>
                  )}
                  {autoSaveStatus === 'saving' && (
                    <span style={{
                      fontSize: '.7rem', background: 'rgba(232,160,64,.1)',
                      color: '#c5a048', padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                    }}>
                      ⟳ Sauvegarde…
                    </span>
                  )}
                </div>
                {/* V96.20 — Cockpit Anissa : 4 macro-etapes (Preparer / Generer /
                    Affiner / Livrer) avec auto-detection des sous-checks. Visible
                    sauf en mode relecture. Aide Anissa a ne rien oublier. */}
                {!isReviewMode && (
                  <PlanCockpit
                    form={form}
                    consultation={consultation}
                    planDraft={planDraft}
                    supplementsDraft={supplementsDraft}
                    hasPlan={hasPlan}
                    liveScore={liveScore || (hasPlan ? scorePlanQuality(
                      planDraft,
                      supplementsDraft,
                      { ...form, _weeklyFeedback: weeklyFeedback },
                      { isFollowup, followupWeek }
                    ) : null)}
                    lastDetectedProfile={lastDetectedProfile}
                    aiDirectives={aiDirectives}
                    composerBeta={composerBeta}
                    isFollowup={isFollowup}
                    onJumpTab={(tab) => setEditorTab(tab)}
                  />
                )}
                {/* V83 : bloc qualite/AI analysis masque en mode relecture pour lisibilite */}
                {hasPlan && !isReviewMode && (
                  <div style={{ width: '100%' }}>
                    <PlanQualityScore
                      score={liveScore || scorePlanQuality(
                        planDraft,
                        supplementsDraft,
                        { ...form, _weeklyFeedback: weeklyFeedback },
                        { isFollowup, followupWeek }
                      )}
                      autoCorrected={autoCorrected}
                      aiAnalysis={aiAnalysis}
                      analyzing={analyzingPlan}
                      aiAnalysisError={aiAnalysisError}
                      planSignatureCurrent={(planDraft || '').length + '|' + (planDraft || '').slice(0, 200)}
                      insertedWinsMap={insertedWinsMap}
                      onRevisitWin={(win) => {
                        // V79.3 : Re-clic sur une quickWin deja inseree → on re-scroll + flash.
                        const type = insertedWinsMap[win];
                        if (!type) return;
                        setFlashSectionType(type);
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => {
                            const sel = `.ne-section[data-section-type="${type}"]`;
                            const el = document.querySelector(sel);
                            if (el) {
                              try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                              catch { el.scrollIntoView(); }
                            }
                          });
                        });
                      }}
                      onInsertQuickWin={(win) => {
                        // V79 : Copilot — insertion ciblee dans la section detectee
                        const result = insertWinIntoPlan(planDraft, win);
                        if (!result.ok) {
                          showSaveToast('⚠ ' + failureMessage(result.reason));
                          return;
                        }
                        // Backup pour undo
                        setLastInsertBackup({
                          prevPlan: planDraft,
                          prevSupplements: supplementsDraft,
                          prevRecipes: recipesDraft,
                          win,
                          type: result.type,
                          expiresAt: Date.now() + 20000, // fenetre undo : 20s
                        });
                        // V79.3 : marquer la win comme inseree
                        setInsertedWinsMap(prev => ({ ...prev, [win]: result.type }));
                        // Reseed editor avec le nouveau plan
                        reseedEditor(result.newPlan, supplementsDraft, recipesDraft);
                        showSaveToast(`✨ Inséré dans ${sectionLabel(result.type)}`);

                        // V79.1 : scroll vers la section + flash via React state (robuste aux re-renders)
                        setFlashSectionType(result.type);
                        // Scroll : attendre le remount (editorSeed++) avant de chercher le DOM
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => {
                            setTimeout(() => {
                              const sel = `.ne-section[data-section-type="${result.type}"]`;
                              const el = document.querySelector(sel);
                              if (!el) return;
                              try {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              } catch {
                                el.scrollIntoView();
                              }
                            }, 50);
                          });
                        });
                      }}
                      onAnalyze={async () => {
                        setAnalyzingPlan(true);
                        setAiAnalysisError('');
                        try {
                          // V88.14 : passer la locale pour que l'audit et les quickWins
                          // sortent dans la bonne langue (FR par defaut / EN pour Benfitcoach EN)
                          // V96.23 : passer aussi composerProfile + aiDirectives pour que
                          // l'audit verifie les MUST INCLUDE specifiques aux modules injectes
                          // et le respect des directives Anissa.
                          // V96.24 : calculer composerProfile en LIVE depuis le form au moment
                          // du clic (et non plus depuis lastDetectedProfile qui peut etre null
                          // si Anissa n'a pas regenere recemment). Cela garantit que la checklist
                          // MUST_INCLUDE est toujours active et previent les suggestions hors
                          // perimetre (ex: ajustement insuline T1).
                          let profileForAudit = lastDetectedProfile;
                          if (!profileForAudit && getClientNutritionLocale(client) !== 'EN') {
                            try {
                              const { detectClientProfile } = await import('./services/prompts/nutrition/profiles/_detector.fr');
                              profileForAudit = detectClientProfile(form);
                            } catch { /* fallback to null */ }
                          }
                          const result = await analyzeFullPlan(form, planDraft, supplementsDraft, {
                            locale: getClientNutritionLocale(client),
                            composerProfile: profileForAudit,
                            aiDirectives,
                          });
                          if (result) {
                            result.planSignature = (planDraft || '').length + '|' + (planDraft || '').slice(0, 200);
                            result.analyzedAt = new Date().toISOString();
                            setAiAnalysis(result);
                          } else {
                            setAiAnalysisError('L\'IA n\'a pas pu produire une analyse structuree. Relance ou verifie ta cle API.');
                          }
                        } catch (err) {
                          console.error('[AI analysis]', err.message);
                          setAiAnalysisError('Erreur reseau : ' + (err.message || 'inconnue'));
                        } finally {
                          setAnalyzingPlan(false);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Suggestions panel — V83 : masque en mode relecture */}
              {!isReviewMode && suggestions.length > 0 && (
                <div style={{
                  marginTop: 10,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,.02)',
                  border: '1px solid rgba(255,255,255,.06)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <div style={{
                    fontSize: '.68rem', fontWeight: 700, color: 'rgba(255,255,255,.3)',
                    textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2,
                  }}>
                    Suggestions
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {suggestions.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          showSaveToast(`Ouvre la section concern\u00e9e et clique \u2728 IA \u2192 ${
                            s.action === 'actionnable' ? 'Rendre actionnable' :
                            s.action === 'rewrite' ? 'Reformuler pro' :
                            s.action === 'simplify' ? 'Simplifier' :
                            s.action === 'adapt' ? 'Adapter au client' : 'Am\u00e9liorer'
                          }`);
                        }}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: '.75rem',
                          background: 'rgba(255,255,255,.04)',
                          border: '1px solid rgba(255,255,255,.1)',
                          color: '#b0c4a8', cursor: 'pointer', transition: 'all .15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(106,191,138,.1)';
                          e.currentTarget.style.borderColor = 'rgba(106,191,138,.3)';
                          e.currentTarget.style.color = '#8abf9a';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(255,255,255,.04)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)';
                          e.currentTarget.style.color = '#b0c4a8';
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 1 : Actions principales */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className={`btn btn-anissa-primary ${generating ? 'loading-pulse' : ''}`}
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ padding: '10px 18px', borderRadius: 10, fontSize: '.85rem', fontWeight: 600 }}
                >
                  {generating ? 'Generation...' : (hasPlan ? 'Regenerer' : 'Generer avec l\'IA')}
                </button>

                {/* V96.32 — Menu Exporter : regroupe Word + Mode relecture + Resume medecin.
                    Avant V96.32, Word et Relecture etaient dans le header editeur,
                    et Resume medecin etait dans le menu Plus. Consolidation pour clarte. */}
                <div style={{ position: 'relative', display: 'inline-block' }} onMouseDown={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-anissa-secondary"
                    onClick={() => setShowExportMenu(m => !m)}
                    disabled={!hasPlan}
                    style={{ padding: '10px 14px', borderRadius: 10, fontSize: '.78rem', opacity: hasPlan ? 1 : 0.4 }}
                    title="Exporter le plan (Word, mode relecture, resume medecin)"
                  >
                    {'\ud83d\udce4 Exporter \u25be'}
                  </button>
                  {showExportMenu && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, zIndex: 50,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 8, overflow: 'hidden', minWidth: 220, marginTop: 4,
                      boxShadow: '0 8px 24px rgba(0,0,0,.3)'
                    }}>
                      <button
                        type="button"
                        className="btn btn-anissa-secondary"
                        style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 0, border: 'none' }}
                        onClick={async () => {
                          setShowExportMenu(false);
                          try {
                            const planSource = planDraft || consultation.nutrition_plan || '';
                            await exportPlanToWord(client, consultation, planSource);
                          } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error('[exportPlanToWord]', e);
                            alert("Erreur lors de l'export Word : " + (e?.message || e));
                          }
                        }}
                      >
                        {'\ud83d\udcc4 Exporter en Word'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-anissa-secondary"
                        style={{
                          width: '100%', textAlign: 'left', padding: '10px 14px',
                          borderRadius: 0, border: 'none',
                          borderTop: '1px solid rgba(255,255,255,.06)',
                          background: isReviewMode ? 'rgba(196,160,80,.12)' : undefined,
                          color: isReviewMode ? '#e0cda0' : undefined,
                        }}
                        onClick={() => { setIsReviewMode(m => !m); setShowExportMenu(false); }}
                      >
                        {isReviewMode ? '\u2190 Quitter relecture' : '\ud83d\udc41 Mode relecture'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-anissa-secondary"
                        style={{
                          width: '100%', textAlign: 'left', padding: '10px 14px',
                          borderRadius: 0, border: 'none',
                          borderTop: '1px solid rgba(255,255,255,.06)',
                        }}
                        onClick={() => { setShowMedicalSummary(true); setShowExportMenu(false); }}
                      >
                        {'\ud83e\ude7a R\u00e9sum\u00e9 m\u00e9decin'}
                      </button>
                    </div>
                  )}
                </div>

                {/* V96.32 — Divider visuel entre zone actions (Generer + Exporter)
                    et zone parametres (Composer beta, Versions, Directives IA, Plus) */}
                <div
                  aria-hidden="true"
                  style={{
                    width: 1, alignSelf: 'stretch', minHeight: 28,
                    background: 'rgba(255,255,255,.1)', margin: '0 4px',
                  }}
                />

                {/* V96.13 : Toggle composer beta (FR uniquement). Discret, persiste
                    en localStorage. Affiche aussi le profil detecte lors de la
                    derniere generation (feedback Anissa). */}
                {getClientNutritionLocale(client) !== 'EN' && (
                  <label
                    title={
                      'Composer beta : injecte des modules profil clinique (femmeCycle, '
                      + 'perimenopause, menopause, diabete, digestif chronique, C. difficile). '
                      + 'OFF = generation classique. Bloquage automatique si grossesse/allaitement.'
                    }
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 12px', borderRadius: 10, fontSize: '.72rem',
                      cursor: 'pointer', userSelect: 'none',
                      background: composerBeta ? 'rgba(167,139,250,.15)' : 'rgba(255,255,255,.04)',
                      border: composerBeta
                        ? '1px solid rgba(167,139,250,.45)'
                        : '1px solid rgba(255,255,255,.08)',
                      color: composerBeta ? '#a78bfa' : 'rgba(255,255,255,.55)',
                      transition: 'all .15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={composerBeta}
                      onChange={e => setComposerBeta(e.target.checked)}
                      style={{ margin: 0, cursor: 'pointer', accentColor: '#a78bfa' }}
                    />
                    {'\ud83e\uddea Composer beta'}
                    {composerBeta && lastDetectedProfile?.all?.length > 0 && (
                      <span style={{
                        marginLeft: 4, padding: '2px 6px', borderRadius: 6,
                        background: 'rgba(167,139,250,.2)', fontSize: '.68rem',
                        color: '#c4b5fd',
                      }}>
                        {lastDetectedProfile.all.join(' + ')}
                      </span>
                    )}
                  </label>
                )}

                {/* V92.1 : bouton Templates supprime — feature non utilisee en pratique */}
                {/* V96.34 : bouton "Versions" deplace dans le menu Plus pour alleger Row 1 */}

                {/* V96.19 — Toggle Directives IA additionnelles (override par cliente).
                    Anissa peut ouvrir un champ libre pour ajouter des consignes specifiques
                    a CETTE cliente. Etat persiste dans la consultation. */}
                {/* V96.34 : couleur ambree (#e8a040) — bouton important qui pondere
                    la generation IA. Plus visible que l'ancien bleu, sans crier (pas
                    primary). Toujours visible meme inactif pour Anissa s'en souvienne. */}
                <button
                  type="button"
                  onClick={() => setAiDirectivesExpanded(v => !v)}
                  title="Ajoute des directives IA specifiques a cette cliente (refus aliment, contexte clinique nuance, ton particulier...)"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 12px', borderRadius: 10, fontSize: '.72rem',
                    cursor: 'pointer', userSelect: 'none',
                    background: aiDirectives ? 'rgba(232,160,64,.18)' : 'rgba(232,160,64,.06)',
                    border: aiDirectives
                      ? '1px solid rgba(232,160,64,.55)'
                      : '1px solid rgba(232,160,64,.25)',
                    color: aiDirectives ? '#f0b860' : '#c89a4a',
                    transition: 'all .15s',
                  }}
                >
                  {'\ud83d\udcac Directives IA'}
                  {aiDirectives && (
                    <span style={{
                      padding: '2px 6px', borderRadius: 6,
                      background: 'rgba(232,160,64,.28)', fontSize: '.65rem',
                      color: '#ffd082',
                    }}>
                      actives
                    </span>
                  )}
                </button>

                {/* Plus dropdown — V96.32 : visible si la consultation existe OU si versions disponibles.
                    V96.34 : "Versions" deplace ici depuis Row 1. */}
                {(initialConsultation?.id || planVersions.length > 0) && (
                <div style={{ position: 'relative', display: 'inline-block' }} onMouseDown={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-anissa-secondary"
                    onClick={() => setShowMoreMenu(m => !m)}
                    style={{ padding: '10px 14px', borderRadius: 10, fontSize: '.78rem' }}
                  >
                    Plus &#9662;
                  </button>
                  {showMoreMenu && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, zIndex: 50,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 8, overflow: 'hidden', minWidth: 220, marginTop: 4,
                      boxShadow: '0 8px 24px rgba(0,0,0,.3)'
                    }}>
                      {/* V96.31 — Mode Expert retire (couvert par Composer beta + audit IA composer-aware) */}
                      {/* V96.32 — "Resume medecin" deplace vers le menu Exporter (Row 1) */}
                      {/* V50 : "PDF analyses" déplacé vers la section MGD (section Analyses recommandées) */}
                      {/* V50 : "Analyse IA complète" déplacé vers bloc dédié après l'éditeur */}

                      {/* V96.34 : Historique des versions (deplace depuis Row 1) */}
                      {planVersions.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-anissa-secondary"
                          style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 0, border: 'none' }}
                          onClick={() => { setShowVersions(true); setShowMoreMenu(false); }}
                        >
                          {'\ud83d\udcda Versions du plan ('}{planVersions.length}{')'}
                        </button>
                      )}

                      {/* V78 : Soft delete consultation (visible seulement si deja sauvegardee = id existant) */}
                      {initialConsultation?.id && (
                        <button
                          type="button"
                          onClick={() => { setShowMoreMenu(false); setShowDeleteConfirm(true); }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '10px 16px', background: 'none', border: 'none',
                            borderTop: '1px solid rgba(255,255,255,.06)',
                            color: '#d4806c', cursor: 'pointer',
                            fontSize: '.85rem', fontWeight: 500,
                            transition: 'background .15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,92,76,.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          🗑 Supprimer la consultation
                        </button>
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>

              {/* V96.19 — Zone Directives IA additionnelles (collapsible).
                  S'affiche quand Anissa clique sur le bouton "Directives IA" en Row 1.
                  Persiste dans consultation.aiDirectives, injecte dans buildUserMessage
                  avec PRIORITE MAXIMALE pour la prochaine generation. */}
              {aiDirectivesExpanded && (
                <div style={{
                  marginTop: 12,
                  padding: 14,
                  borderRadius: 10,
                  background: 'rgba(232,160,64,.06)',
                  border: '1px solid rgba(232,160,64,.22)',
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    marginBottom: 8,
                  }}>
                    <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#f0b860' }}>
                      {'\ud83d\udcac Directives IA additionnelles pour cette cliente'}
                    </label>
                    <span style={{ fontSize: '.68rem', color: 'rgba(240,184,96,.6)' }}>
                      {(aiDirectives || '').length} caracteres
                    </span>
                  </div>
                  <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.5)', marginBottom: 8, lineHeight: 1.5 }}>
                    Consignes appliquees uniquement a cette cliente, en plus des modules profil. Exemples : <em>&quot;refuse poisson, contexte familial difficile&quot;</em>, <em>&quot;intolerance gluten confirmee biopsie&quot;</em>, <em>&quot;ton tres doux, antecedent TCA&quot;</em>, <em>&quot;budget tres serre, privilegier aliments low-cost&quot;</em>. Ces directives sont injectees en PRIORITE MAXIMALE dans le prompt de generation.
                  </div>
                  <textarea
                    value={aiDirectives}
                    onChange={e => setAiDirectives(e.target.value)}
                    placeholder="Ex : Cliente refuse tout poisson (degoute). Antecedent TCA il y a 5 ans, eviter mention calories. Budget serre."
                    rows={4}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      background: 'rgba(0,0,0,.25)', color: '#f0f0e8',
                      border: '1px solid rgba(232,160,64,.28)',
                      fontSize: '.82rem', fontFamily: 'inherit',
                      resize: 'vertical', minHeight: 90,
                      outline: 'none',
                    }}
                  />
                  {aiDirectives && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={() => setAiDirectives('')}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'rgba(255,200,200,.7)', fontSize: '.7rem',
                          padding: '4px 8px', borderRadius: 6,
                        }}
                      >
                        {'\u2715'} Effacer
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Row 2 : Save actions */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 2 }}>
                <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ padding: '7px 14px', borderRadius: 10, fontSize: '.78rem' }}>Fermer</button>
                <button type="button" className="btn btn-primary" onClick={handleSave} style={{ padding: '7px 14px', borderRadius: 10, fontSize: '.78rem' }}>Sauvegarder</button>
                <span style={{
                  fontSize: '0.75rem',
                  color: autoSaveStatus === 'saved' ? '#22c55e'
                       : autoSaveStatus === 'saving' ? '#f59e0b'
                       : '#94a3b8',
                  marginLeft: '0.5rem',
                  transition: 'color 0.3s',
                }}>
                  {autoSaveStatus === 'saved' && '\u2713 Sauvegard\u00e9'}
                  {autoSaveStatus === 'saving' && '\u27f3 Auto-save...'}
                  {autoSaveStatus === 'unsaved' && '\u25cf Non sauvegard\u00e9'}
                </span>
              </div>

              {genError && <div className="error-msg" style={{ marginTop: 4 }}>{genError}</div>}
              {pdfError && <div className="error-msg" style={{ marginTop: 4, background: 'rgba(212,92,76,.08)', padding: '8px 12px', borderRadius: 8, fontSize: '.78rem' }}>{pdfError}</div>}
              {analysesError && <div className="error-msg" style={{ marginTop: 4, background: 'rgba(212,92,76,.08)', padding: '8px 12px', borderRadius: 8, fontSize: '.78rem' }}>{analysesError}</div>}
            </div>

            {/* V96.31 — Bloc Mode Expert UI retire (couvert par Composer beta + audit IA composer-aware) */}

            {/* Global AI proposal panel */}
            {globalProposal && (
              <div style={{
                margin: '8px 0',
                padding: '14px 18px',
                background: 'rgba(26,58,42,.4)',
                border: '1px solid rgba(106,191,138,.25)',
                borderRadius: 12,
                animation: 'neSlideIn .2s ease',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:'.72rem', fontWeight:700, color:'rgba(106,191,138,.7)',
                    textTransform:'uppercase', letterSpacing:'.4px' }}>
                    {'\u2728'} Proposition IA {'\u2014'} {globalProposal.instruction}
                  </span>
                  <span style={{ fontSize:'.7rem', color:'rgba(255,255,255,.3)', marginLeft:'auto' }}>
                    Pr{'\u00e9'}visualisation {'\u2014'} non appliqu{'\u00e9'}
                  </span>
                </div>
                <div style={{
                  background:'rgba(0,0,0,.25)', borderRadius:8, padding:'12px 14px',
                  fontSize:'.8rem', lineHeight:1.65, color:'#d4c9a8',
                  whiteSpace:'pre-wrap', maxHeight:200, overflowY:'auto',
                  border:'1px solid rgba(255,255,255,.06)',
                }}>
                  {globalProposal.text.slice(0, 600)}{globalProposal.text.length > 600 ? '...' : ''}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <button
                    onClick={() => {
                      reseedEditor(globalProposal.text, supplementsDraft, recipesDraft);
                      setGlobalProposal(null);
                      showSaveToast('Plan mis \u00e0 jour');
                    }}
                    style={{
                      padding:'6px 16px', borderRadius:8, border:'none',
                      background:'rgba(106,191,138,.2)', color:'#8abf9a',
                      cursor:'pointer', fontSize:'.8rem', fontWeight:600,
                    }}>
                    {'\u2705'} Appliquer au plan
                  </button>
                  <button
                    onClick={() => setGlobalProposal(null)}
                    style={{
                      padding:'6px 16px', borderRadius:8,
                      border:'1px solid rgba(255,255,255,.08)',
                      background:'none', color:'rgba(255,255,255,.35)',
                      cursor:'pointer', fontSize:'.8rem',
                    }}>
                    {'\u274c'} Ignorer
                  </button>
                </div>
              </div>
            )}

            {/* V50 : Modale aiAnalysis remplacee par un bloc inline juste apres l'editeur */}

            {/* V82 : Mini-TOC flottant — visible uniquement quand il y a un plan, et desktop ≥ 1200px.
                Scanne les sections rendues par NutritionEditor via data-section-* attributes. */}
            {hasPlan && editorTab === 'plan' && (
              <NutritionPlanTOC refreshKey={editorSeed} />
            )}

            {/* ─── V70 : SINGLE EDITOR (plus de split view) — apercu PDF a la demande via modal ─── */}
            <div className="nc-cockpit-single" style={{ display: 'flex', flexDirection: 'column', flex: 'none', overflow: 'visible', minHeight: 600, padding: '12px 16px 16px' }}>
              <section className="nc-panel nc-panel--editor">
                <header className="nc-panel__header" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <span className="nc-panel__label">Editeur</span>
                  <Tab active={editorTab === 'plan'} onClick={() => setEditorTab('plan')}>Plan complet</Tab>
                  <Tab active={editorTab === 'frigo'} onClick={() => setEditorTab('frigo')}>Fiche frigo</Tab>
                  {/* V96.33 : onglets "Plan S1-S4" + "Supplements" supprimes — Anissa
                      peaufine tout dans Word apres export, ces vues n'etaient pas utilisees. */}
                  {/* V94.48 : Lettre + Recettes deplacees dans 'App cliente' comme
                      sous-onglets, pour separer mindset 'peaufinage plan textuel'
                      et 'contenu app digital'. Onglets racines = plan textuel pur. */}
                  <Tab active={editorTab === 'app'} onClick={() => setEditorTab('app')}>📱 App cliente</Tab>
                  <span style={{ flex: 1 }} />
                  {/* V76 : Apercu PDF retire — l'editeur est deja un apercu premium.
                      Cover accessible directement via un bouton dedie. */}
                  {/* V88.5 → V94.50 : bouton 'Apercu JSON' supprime du header.
                      Le bouton 'Publier dans l'app' est maintenant dans
                      l'onglet App cliente (Vue d'ensemble) avec un nom clair
                      qui parle a Anissa. */}
                  {/* V96.32 : boutons "Mode relecture" + "Word" deplaces vers le menu
                      "Exporter" en Row 1 (action row). Header editeur = onglets uniquement. */}
                  {/* V94.1 : bouton "Telecharger" PDF jsPDF supprime du header editeur.
                      Word V92+ est le path principal — Anissa peaufine dans Word puis
                      "Enregistrer sous PDF natif" en 1 clic. jsPDF reste utilise pour
                      Fiche Frigo (V92.8 modal), Pack client et Historique. */}
                </header>
                <div className="nc-panel__body">
                  {generating && (
                    <div className="loading" style={{ padding: '30px 20px' }}>
                      <div className="loading-spinner" />
                      <p>Claude analyse le profil et genere le plan nutrition...</p>
                    </div>
                  )}
                  {!generating && renderEditorTab()}
                </div>
              </section>
            </div>

            {/* V76 : Modale Apercu PDF retiree — l'editeur est deja un apercu premium fidele.
                Cover accessible directement via le bouton "🎨 Cover" du header editeur. */}

            {/* V53 : Audit IA maintenant integré dans PlanQualityScore (bloc unique en haut du cockpit) */}

            {/* Analyses preview (below split, full width) */}
            {showAnalysesPreview && (() => {
              const symp = detectSymptomsFromForm(form);
              const recs = getEnrichedMGDRecommendations(symp);
              return (
                <AnalysisPdfBody
                  recommendations={recs}
                  symptoms={symp}
                  clientName={clientName}
                  date={formatDate(today)}
                />
              );
            })()}

            {/* ─── Modales (remontees depuis l'editeur) ─── */}
            {showClientAppPreview && (() => {
              const { plan, supplements, recipes } = readEdited();
              const liveConsultation = {
                ...consultation,
                nutrition_plan: plan,
                supplements,
                recipes,
              };
              return (
                <ClientAppPreviewModal
                  client={client}
                  consultation={liveConsultation}
                  onClose={() => setShowClientAppPreview(false)}
                />
              );
            })()}

            {showFrigoModal && (() => {
              const { plan, supplements, recipes } = readEdited();
              return (
                <FicheFrigoPreview
                  consultation={{
                    nutritionPlan: plan,
                    supplements,
                    ficheFrigoJson: consultation.fiche_frigo_json || null,
                    date: today,
                  }}
                  sections={structurePlanSections(plan, supplements, { isFollowup, locale: getClientNutritionLocale(client) })}
                  client={client}
                  onClose={() => setShowFrigoModal(false)}
                />
              );
            })()}

            {showMedicalSummary && (() => {
              const { plan, supplements, recipes } = readEdited();
              return (
                <MedicalSummary
                  form={form}
                  consultation={{
                    plan, supplements, recipes,
                    bloodTestDone: consultation.blood_test_done,
                    dnaTestDone: consultation.dna_test_done,
                    nutritionPlan: plan,
                    nutritional_observations: consultation.nutritional_observations,
                    lab_results: consultation.lab_results,
                  }}
                  onClose={() => setShowMedicalSummary(false)}
                  // V94.22 : sauvegarde des edits dans la consultation pour persistance
                  savedData={consultation.medical_summary || null}
                  onSave={(data) => {
                    setConsultation(prev => ({
                      ...prev,
                      medical_summary: data,
                      medical_summary_updated_at: new Date().toISOString(),
                    }));
                    isDirtyRef.current = true;
                    setAutoSaveStatus('unsaved');
                    showSaveToast('Fiche médecin sauvegardée');
                  }}
                />
              );
            })()}

            {/* V92.1 : modale Cover supprimee — Word V92.0 gere sa propre cover */}

            {/* V78 : modale confirmation soft delete consultation */}
            {showDeleteConfirm && (
              <div
                onClick={() => setShowDeleteConfirm(false)}
                role="dialog"
                aria-modal="true"
                style={{
                  position: 'fixed', inset: 0, zIndex: 1000,
                  background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(3px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 20,
                }}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%', maxWidth: 440,
                    background: '#1e241f',
                    border: '1px solid rgba(212,92,76,.3)',
                    borderRadius: 14,
                    boxShadow: '0 20px 60px rgba(0,0,0,.5)',
                    overflow: 'hidden',
                  }}
                >
                  <header style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                    <h3 style={{ margin: 0, color: '#d4806c', fontSize: '1rem', fontWeight: 700 }}>
                      🗑 Supprimer cette consultation ?
                    </h3>
                  </header>
                  <div style={{ padding: '18px 22px', fontSize: '.85rem', color: '#d4c9a8', lineHeight: 1.55 }}>
                    Cette action est réversible mais la consultation ne sera plus visible.
                  </div>
                  <footer style={{
                    padding: '14px 22px 18px',
                    borderTop: '1px solid rgba(255,255,255,.06)',
                    display: 'flex', justifyContent: 'flex-end', gap: 8,
                  }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowDeleteConfirm(false)}
                      style={{ padding: '8px 16px', borderRadius: 10, fontSize: '.82rem' }}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const consultationId = initialConsultation?.id;
                        if (!consultationId) {
                          showSaveToast('ID de consultation invalide');
                          setShowDeleteConfirm(false);
                          return;
                        }
                        const ok = softDeleteConsultation(consultationId);
                        setShowDeleteConfirm(false);
                        if (ok) {
                          showSaveToast('Consultation supprimée');
                          // Redirection immediate vers la liste
                          setTimeout(() => { onCancel?.(); }, 700);
                        } else {
                          showSaveToast('Suppression échouée');
                        }
                      }}
                      style={{
                        padding: '8px 16px', borderRadius: 10, fontSize: '.82rem',
                        border: '1px solid rgba(212,92,76,.5)',
                        background: 'rgba(212,92,76,.15)', color: '#d4806c',
                        cursor: 'pointer', fontWeight: 600,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,92,76,.25)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(212,92,76,.15)'}
                    >
                      Supprimer
                    </button>
                  </footer>
                </div>
              </div>
            )}

            {/* V81 : modale de confirmation generique (regeneration / restore version / champs critiques) */}
            <ConfirmDialog state={confirmDialog.state} onClose={confirmDialog.close} />

            {saveToast && <div className="nc-save-toast">{saveToast}</div>}

            {/* V79 : banner undo apres insertion Copilot (fenetre de 20s) */}
            {lastInsertBackup && lastInsertBackup.expiresAt > Date.now() && (
              <div style={{
                position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                zIndex: 900,
                background: 'rgba(26,46,31,.96)',
                border: '1px solid rgba(184,158,240,.35)',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 8px 28px rgba(0,0,0,.5)',
                fontSize: '.78rem',
                animation: 'fadeIn .2s ease',
              }}>
                <span style={{ color: '#c4aff2' }}>
                  ✨ Inséré dans <strong>{sectionLabel(lastInsertBackup.type)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!lastInsertBackup) return;
                    reseedEditor(
                      lastInsertBackup.prevPlan,
                      lastInsertBackup.prevSupplements,
                      lastInsertBackup.prevRecipes
                    );
                    // V79.3 : retirer la win du map → le bouton redevient "Inserer"
                    const undoneWin = lastInsertBackup.win;
                    if (undoneWin) {
                      setInsertedWinsMap(prev => {
                        const next = { ...prev };
                        delete next[undoneWin];
                        return next;
                      });
                    }
                    setLastInsertBackup(null);
                    showSaveToast('↩ Insertion annulée');
                  }}
                  style={{
                    padding: '4px 12px', borderRadius: 6,
                    border: '1px solid rgba(184,158,240,.45)',
                    background: 'rgba(184,158,240,.15)',
                    color: '#c4aff2', cursor: 'pointer',
                    fontSize: '.74rem', fontWeight: 600,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,158,240,.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(184,158,240,.15)'}
                >
                  ↩ Annuler
                </button>
                <button
                  type="button"
                  onClick={() => setLastInsertBackup(null)}
                  title="Fermer"
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(255,255,255,.4)', cursor: 'pointer',
                    fontSize: '1rem', padding: 0, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        );
      })()}


      {/* Step: Notes for Benoit + Private notes */}
      {currentStepType === 'notes' && (
        <div className="nutrition-form-section">
          <h3>Notes internes</h3>
          <div className="field full-width">
            <label>Recommandations a transmettre au coach</label>
            <SmartTextarea
              value={consultation.notes_for_coach}
              onChange={(e) => updateField('notes_for_coach', e.target.value)}
              placeholder="Points d'attention pour le programme sportif, aliments a eviter avant/apres l'entrainement, signes a surveiller..."
              rows={8}
            />
          </div>

          <div className="field full-width private-field" style={{ marginTop: 24 }}>
            <label>
              <span className="private-lock">🔒</span> Notes privees
              <span className="private-badge">Visible uniquement par vous</span>
            </label>
            <SmartTextarea
              value={consultation.private_notes}
              onChange={(e) => updateField('private_notes', e.target.value)}
              placeholder="Notes confidentielles — visibles uniquement par Anissa..."
              rows={5}
            />
          </div>
        </div>
      )}

      {/* Bottom nav retiree — actions remontees dans le cockpit header (step plan)
          et dans la barre d'etapes en haut (autres steps) */}
      {currentStepType !== 'plan' && (
        <div className="nav-buttons" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onCancel}>Fermer</button>
          <button className="btn btn-primary" onClick={handleSave}>Sauvegarder la consultation</button>
          <span style={{
            fontSize: '0.75rem',
            color: autoSaveStatus === 'saved' ? '#22c55e'
                 : autoSaveStatus === 'saving' ? '#f59e0b'
                 : '#94a3b8',
            marginLeft: '0.5rem',
            transition: 'color 0.3s',
          }}>
            {autoSaveStatus === 'saved' && '\u2713 Sauvegard\u00e9'}
            {autoSaveStatus === 'saving' && '\u27f3 Auto-save...'}
            {autoSaveStatus === 'unsaved' && '\u25cf Non sauvegard\u00e9'}
          </span>
        </div>
      )}

      {/* V85.3 : FAB Sauvegarder flottant — visible sur l'etape plan quand il y a
          des modifications non sauvees. Evite de remonter en haut de page.
          V88.0.2 : masque en mode Finaliser (les boutons Enregistrer/Supprimer
          version finale sont deja presents en bas du textarea, evite le chevauchement). */}
      {currentStepType === 'plan' && autoSaveStatus === 'unsaved' && (
        <button
          type="button"
          onClick={handleSave}
          title="Sauvegarder maintenant (Ctrl+S)"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 900,
            padding: '12px 18px',
            borderRadius: 999,
            background: 'linear-gradient(135deg, #c4a050, #a88740)',
            color: '#1a2e1f',
            border: 'none',
            fontSize: '.82rem',
            fontWeight: 700,
            letterSpacing: '.04em',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(196,160,80,.35), 0 2px 6px rgba(0,0,0,.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'inherit',
            transition: 'transform .15s, box-shadow .15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(196,160,80,.45), 0 4px 10px rgba(0,0,0,.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(196,160,80,.35), 0 2px 6px rgba(0,0,0,.25)';
          }}
        >
          Sauvegarder
        </button>
      )}


      {/* V92.3 : modale Finaliser supprimee (~579 lignes) — Word V92.0 + Anissa peaufine dans Word */}
      {/* V92.1 : modale Preview PDF supprimee — Word V92.0 prime, plus de jsPDF specifique */}
    </div>
  );
}
