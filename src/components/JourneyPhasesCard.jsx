// ─── JourneyPhasesCard ──────────────────────────────────────────────────
// V97.17.3 — Cockpit Parcours therapeutique (5 phases microbiote).
//
// Pensé pour vivre dans SuiviCockpitTimeline sur la page Suivi etape 8
// (palette claire ivoire / vert sombre, cf charte journey.css).
//
// V97.17.3 changes :
//   - Vraie timeline HORIZONTALE des phases (au lieu de la liste verticale)
//   - "Changer le template" derriere panel "Options avancees" repli par defaut
//   - Confirmation explicite pour changement de template + force transition
//   - Re-styled cards
//
// Composant autonome : consomme consultation.protocol_phases et appelle
// onSavePhases(newProtocolPhases) en remontee. C'est le parent qui gere
// la persistance (store + cloudSync). Aucun side effect ici.
//
// 3 etats UI :
//   1. Pas configure → banner suggestion template + bouton "Initialiser"
//   2. Configure, aucune phase active → bouton "Demarrer le parcours"
//   3. Configure, phase active → hero + timeline horizontale + actions
//
// Cf spec : memory `spec_v2_parcours_home_permanente_2026_05_16.md`.

import { useMemo, useState } from "react";
import {
  ALL_TEMPLATES,
  suggestTemplateFromAnalyses,
  instanceFromTemplate,
  getActivePhase,
  getActivePhaseWeek,
  suggestNextPhase,
  transitionToNextPhase,
  startParcours,
} from "../services/protocolPhases";

export default function JourneyPhasesCard({ consultation, client, onSavePhases }) {
  const [saving, setSaving] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState(null);
  const [pendingForceTransition, setPendingForceTransition] = useState(false);

  const protocolPhases = consultation?.protocol_phases || null;

  const suggestion = useMemo(
    () => suggestTemplateFromAnalyses(client || {}),
    [client]
  );

  const activePhase = useMemo(() => getActivePhase(protocolPhases), [protocolPhases]);
  const weekInfo = useMemo(() => getActivePhaseWeek(protocolPhases), [protocolPhases]);
  const nextSuggestion = useMemo(
    () => suggestNextPhase(protocolPhases),
    [protocolPhases]
  );

  // ─── Handlers ─────────────────────────────────────────────────────────

  async function handleInitFromTemplate(templateId) {
    if (saving) return;
    // V97.17.5.1 — Garde-fou : template custom a phases: [] et casse l'UI
    // (frise vide, segments map sur [], page noire reported par Anissa).
    // Pour V1, on bloque l'init custom. A debloquer en V97.17.6 quand on
    // ajoutera l'edition de phases manuelles.
    if (templateId === 'custom') {
      window.alert(
        'Le parcours personnalise n\'est pas encore configurable directement.\n\n' +
        'Pour cette cliente, choisis un template existant (Microbiote 5 ou 3 phases, Nutrition simple 2 phases).\n\n' +
        'L\'edition manuelle des phases arrive dans une prochaine version.'
      );
      return;
    }
    setSaving(true);
    try {
      const next = instanceFromTemplate(templateId);
      await onSavePhases(next);
      setShowTemplatePicker(false);
      setShowAdvanced(false);
      setPendingTemplateId(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleStartParcours() {
    if (saving || !protocolPhases) return;
    setSaving(true);
    try {
      const next = startParcours(protocolPhases);
      await onSavePhases(next);
    } finally {
      setSaving(false);
    }
  }

  async function handleTransitionNext() {
    if (saving || !protocolPhases) return;
    setSaving(true);
    try {
      const next = transitionToNextPhase(protocolPhases);
      await onSavePhases(next);
      setPendingForceTransition(false);
    } finally {
      setSaving(false);
    }
  }

  // ─── État 1 : pas configuré OU configuré avec 0 phase (cas custom buggy) ──
  // V97.17.5.1 : guard contre `{ template: 'custom', phases: [] }` qui causait
  // une page noire (rendu de la frise sur tableau vide). Fallback sur l'etat
  // "non configure" + permet de re-choisir un template valide.
  const isEmptyPhases =
    protocolPhases && (!Array.isArray(protocolPhases.phases) || protocolPhases.phases.length === 0);

  if (!protocolPhases || isEmptyPhases) {
    return (
      <div>
        {isEmptyPhases && (
          <div style={{
            background: 'rgba(184, 134, 38, 0.08)',
            border: '1px solid rgba(184, 134, 38, 0.3)',
            borderRadius: 7,
            padding: '10px 12px',
            marginBottom: 10,
            fontSize: 12,
            color: '#785a1a',
          }}>
            ⚠ Le parcours actuel n&apos;a pas de phases configurées. Choisis un template
            ci-dessous pour redémarrer proprement.
          </div>
        )}
        <p style={mutedStyle}>
          Ce parcours apparaîtra dans l&apos;app cliente sous forme de timeline.
          La cliente verra où elle en est, ce qui se passe, et ce qui vient ensuite.
        </p>

        {/* Banner suggestion */}
        <div style={suggestionBannerStyle}>
          <div style={suggestionEyebrowStyle}>✨ SUGGESTION</div>
          <div style={suggestionTitleStyle}>
            {ALL_TEMPLATES[suggestion.templateId]?.label || suggestion.templateId}
          </div>
          <div style={suggestionReasonStyle}>{suggestion.reason}</div>
          <div style={btnRowStyle}>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleInitFromTemplate(suggestion.templateId)}
              style={primaryBtnStyle(saving)}
            >
              {saving ? "Initialisation…" : "Accepter"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowTemplatePicker(true)}
              style={ghostBtnStyle(saving)}
            >
              Choisir un autre
            </button>
          </div>
        </div>

        {/* Picker template manuel */}
        {showTemplatePicker && (
          <div style={pickerStyle}>
            {Object.values(ALL_TEMPLATES).map((tpl) => {
              const isCustom = tpl.id === 'custom';
              return (
                <button
                  key={tpl.id}
                  type="button"
                  disabled={saving || isCustom}
                  onClick={() => handleInitFromTemplate(tpl.id)}
                  style={{
                    ...pickerItemStyle,
                    opacity: isCustom ? 0.4 : 1,
                    cursor: isCustom ? 'not-allowed' : 'pointer',
                  }}
                  title={isCustom ? 'Pas encore configurable — disponible en V97.17.6' : ''}
                >
                  <div style={pickerLabelStyle}>
                    {tpl.label}
                    {isCustom && ' (bientot disponible)'}
                  </div>
                  <div style={pickerDescStyle}>{tpl.description}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── État 2 & 3 : configuré ───────────────────────────────────────────

  const totalPhases = protocolPhases.phases.length;
  const completedCount = protocolPhases.phases.filter((p) => p.status === "completed").length;
  const activeIdx = protocolPhases.phases.findIndex((p) => p.status === "active");

  // Progression globale en % pour la frise horizontale (curseur principal)
  const cursorPct = useMemo(() => {
    if (activeIdx < 0) {
      // Aucune phase active : 0% (pas demarre) ou 100% (toutes terminees)
      if (completedCount === totalPhases) return 100;
      return 0;
    }
    // Position de base = milieu de la phase active
    const phaseWidth = 100 / totalPhases;
    let pct = activeIdx * phaseWidth;
    // Affiner avec semaine dans la phase active si dispo
    if (weekInfo && activePhase?.duration_weeks_max > 0) {
      const phaseProgress = Math.min(1, weekInfo.weekNumber / activePhase.duration_weeks_max);
      pct += phaseProgress * phaseWidth;
    } else {
      pct += phaseWidth * 0.3; // par defaut 30% dans la phase
    }
    return Math.min(100, pct);
  }, [activeIdx, completedCount, totalPhases, weekInfo, activePhase]);

  return (
    <div>
      {/* Hero phase active (si une est active) */}
      {activePhase && (
        <div style={activeHeroStyle}>
          <div style={suggestionEyebrowStyle}>PHASE ACTIVE</div>
          <div style={activeTitleStyle}>
            Phase {activePhase.order} · {activePhase.client_name}
          </div>
          <div style={activeClinicalStyle}>
            Nom clinique : {activePhase.clinical_name}
          </div>
          {weekInfo && (
            <div style={activeWeekStyle}>
              Semaine {weekInfo.weekNumber}
              {weekInfo.maxWeeks > 0 ? ` sur ~${weekInfo.maxWeeks}` : " (phase ouverte)"}
            </div>
          )}
          {nextSuggestion.shouldSuggest && (
            <div style={transitionSuggestionStyle}>
              <div style={transitionLabelStyle}>💡 {nextSuggestion.reason}</div>
              <button
                type="button"
                disabled={saving}
                onClick={handleTransitionNext}
                style={{ ...primaryBtnStyle(saving), marginTop: 8 }}
              >
                {saving ? "Transition…" : "Passer à la phase suivante"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* V97.17.3 — VRAIE TIMELINE HORIZONTALE des phases */}
      <div style={timelineWrapperStyle}>
        <div style={timelineTrackContainerStyle}>
          {/* Segments par phase (base) */}
          <div style={segmentsRowStyle}>
            {protocolPhases.phases.map((phase, idx) => {
              const isCompleted = phase.status === "completed";
              const isActive = phase.status === "active";
              return (
                <div
                  key={phase.id}
                  style={{
                    ...segmentStyle,
                    background: isCompleted
                      ? "rgba(26, 46, 31, 0.45)"
                      : isActive
                      ? "rgba(26, 46, 31, 0.18)"
                      : "rgba(26, 46, 31, 0.05)",
                    borderRight:
                      idx < totalPhases - 1
                        ? "1px solid rgba(255, 255, 255, 0.6)"
                        : "none",
                  }}
                />
              );
            })}
          </div>

          {/* Curseur de progression (Vous etes ici dans la phase) */}
          {activePhase && (
            <div
              style={{
                ...cursorStyle,
                left: `${cursorPct}%`,
              }}
            >
              <div style={cursorDotStyle} />
            </div>
          )}

          {/* Marqueurs ronds entre les phases (separateurs visuels) */}
          {protocolPhases.phases.map((phase, idx) => {
            const isCompleted = phase.status === "completed";
            const isActive = phase.status === "active";
            const leftPct = (idx / totalPhases) * 100;
            return (
              <div
                key={`marker-${phase.id}`}
                style={{
                  ...timelineMarkerStyle,
                  left: `${leftPct}%`,
                  background: isCompleted
                    ? "#1A2E1F"
                    : isActive
                    ? "#1A2E1F"
                    : "white",
                  border: `2px solid ${
                    isCompleted || isActive ? "#1A2E1F" : "rgba(26,46,31,.25)"
                  }`,
                  color: isCompleted || isActive ? "white" : "rgba(26,46,31,.4)",
                }}
                title={`Phase ${phase.order} — ${phase.client_name} (${phase.status})`}
              >
                {phase.order}
              </div>
            );
          })}

          {/* Marqueur fin (apres la derniere phase) */}
          <div
            style={{
              ...timelineMarkerStyle,
              left: "100%",
              background: completedCount === totalPhases ? "#1A2E1F" : "white",
              border: "2px dashed rgba(26,46,31,.4)",
              color: "rgba(26,46,31,.4)",
              fontSize: 9,
            }}
            title="Fin du parcours"
          >
            ✓
          </div>
        </div>

        {/* Labels sous la frise (1 par phase, alignés au début de segment) */}
        <div style={labelsRowStyle}>
          {protocolPhases.phases.map((phase, idx) => {
            const isCompleted = phase.status === "completed";
            const isActive = phase.status === "active";
            const leftPct = (idx / totalPhases) * 100 + 100 / totalPhases / 2;
            return (
              <div
                key={`label-${phase.id}`}
                style={{
                  ...phaseLabelStyle,
                  left: `${leftPct}%`,
                  color: isActive
                    ? "#1A2E1F"
                    : isCompleted
                    ? "rgba(26,46,31,.7)"
                    : "rgba(26,46,31,.45)",
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                <div style={phaseLabelTopStyle}>Phase {phase.order}</div>
                <div style={phaseLabelBottomStyle}>{phase.client_name}</div>
                {isActive && weekInfo && (
                  <div style={phaseLabelMetaStyle}>
                    Semaine {weekInfo.weekNumber}
                    {weekInfo.maxWeeks > 0 ? `/${weekInfo.maxWeeks}` : " (ouverte)"}
                  </div>
                )}
                {isCompleted && phase.completed_at && (
                  <div style={phaseLabelMetaStyle}>
                    Terminée {formatDate(phase.completed_at)}
                  </div>
                )}
                {!isActive && !isCompleted && (
                  <div style={phaseLabelMetaStyle}>
                    {phase.duration_weeks_max > 0
                      ? `~${phase.duration_weeks_max} sem`
                      : "durée ouverte"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions principales (start parcours ou rien) */}
      {!activePhase && completedCount === 0 && (
        <div style={{ ...btnRowStyle, marginTop: 18 }}>
          <button
            type="button"
            disabled={saving}
            onClick={handleStartParcours}
            style={primaryBtnStyle(saving)}
          >
            {saving ? "Démarrage…" : "Démarrer le parcours (phase 1)"}
          </button>
        </div>
      )}

      {/* V97.17.3 — Options avancees REPLIES par defaut.
          Empeche Anissa de cliquer "Changer le template" par erreur. */}
      <div style={advancedToggleRowStyle}>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          style={advancedToggleBtnStyle}
        >
          {showAdvanced ? "▾ Masquer les options avancées" : "▸ Options avancées"}
        </button>
      </div>

      {showAdvanced && (
        <div style={advancedPanelStyle}>
          <div style={advancedWarningStyle}>
            ⚠️ Ces actions modifient le parcours en cours. À utiliser uniquement
            si tu sais ce que tu fais.
          </div>

          {/* Forcer passage phase suivante (avec confirmation) */}
          {activePhase && activeIdx < totalPhases - 1 && (
            <div style={advancedActionRowStyle}>
              {!pendingForceTransition ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setPendingForceTransition(true)}
                  style={ghostBtnStyle(saving)}
                >
                  Forcer passage à la phase suivante
                </button>
              ) : (
                <div style={confirmRowStyle}>
                  <span style={confirmTextStyle}>
                    Confirmer : passer de Phase {activePhase.order} (
                    {activePhase.client_name}) à Phase {activePhase.order + 1} ?
                  </span>
                  <div style={btnRowStyle}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleTransitionNext}
                      style={primaryBtnStyle(saving)}
                    >
                      {saving ? "Transition…" : "Oui, transitionner"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingForceTransition(false)}
                      style={ghostBtnStyle(false)}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Changer template (avec confirmation explicite) */}
          <div style={advancedActionRowStyle}>
            {!showTemplatePicker ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowTemplatePicker(true)}
                style={ghostBtnStyle(saving)}
              >
                Changer le template
              </button>
            ) : (
              <div>
                <div style={pickerWarningStyle}>
                  ⚠️ Changer le template <strong>écrase</strong> l&apos;état actuel
                  des phases. La cliente verra le nouveau parcours dès la prochaine
                  publication.
                </div>
                <div style={pickerStyle}>
                  {Object.values(ALL_TEMPLATES).map((tpl) => {
                    const isCurrent = tpl.id === protocolPhases.template;
                    const isPending = tpl.id === pendingTemplateId;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        disabled={saving || isCurrent}
                        onClick={() =>
                          isPending
                            ? handleInitFromTemplate(tpl.id)
                            : setPendingTemplateId(tpl.id)
                        }
                        style={{
                          ...pickerItemStyle,
                          opacity: isCurrent ? 0.4 : 1,
                          cursor: isCurrent ? "not-allowed" : "pointer",
                          background: isPending
                            ? "rgba(184, 134, 38, 0.08)"
                            : "white",
                          borderColor: isPending
                            ? "rgba(184, 134, 38, 0.5)"
                            : "rgba(26, 46, 31, 0.12)",
                        }}
                      >
                        <div style={pickerLabelStyle}>
                          {tpl.label}
                          {isCurrent && " (actuel)"}
                          {isPending && " · CLIQUE À NOUVEAU POUR CONFIRMER"}
                        </div>
                        <div style={pickerDescStyle}>{tpl.description}</div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ ...btnRowStyle, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTemplatePicker(false);
                      setPendingTemplateId(null);
                    }}
                    style={ghostBtnStyle(false)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDate(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("fr-CH", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

// ─── Styles (palette claire ivoire / vert sombre) ─────────────────────────

const mutedStyle = {
  fontSize: 13,
  color: "var(--jrn-text-muted, #6b6f6b)",
  margin: "0 0 12px 0",
  lineHeight: 1.55,
};

const suggestionBannerStyle = {
  background: "rgba(26, 46, 31, 0.04)",
  border: "1px solid rgba(26, 46, 31, 0.12)",
  borderRadius: 8,
  padding: "12px 14px",
  marginBottom: 8,
};

const suggestionEyebrowStyle = {
  fontSize: 10,
  letterSpacing: ".12em",
  fontWeight: 700,
  color: "#1A2E1F",
  textTransform: "uppercase",
};

const suggestionTitleStyle = {
  marginTop: 4,
  fontSize: 14,
  color: "#1A2E1F",
  fontWeight: 600,
};

const suggestionReasonStyle = {
  marginTop: 4,
  fontSize: 12,
  color: "var(--jrn-text-muted, #6b6f6b)",
  fontStyle: "italic",
};

const btnRowStyle = {
  marginTop: 10,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const pickerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 8,
};

const pickerItemStyle = {
  background: "white",
  border: "1px solid rgba(26, 46, 31, 0.12)",
  borderRadius: 7,
  padding: "10px 12px",
  textAlign: "left",
  cursor: "pointer",
  transition: "all 120ms ease",
};

const pickerLabelStyle = {
  fontWeight: 600,
  color: "#1A2E1F",
  fontSize: 13,
};

const pickerDescStyle = {
  marginTop: 2,
  fontSize: 11.5,
  color: "var(--jrn-text-muted, #6b6f6b)",
};

const pickerWarningStyle = {
  fontSize: 12,
  color: "#a04040",
  background: "rgba(160, 64, 64, 0.06)",
  border: "1px solid rgba(160, 64, 64, 0.2)",
  borderRadius: 6,
  padding: "8px 10px",
  marginBottom: 6,
};

function primaryBtnStyle(disabled) {
  return {
    background: disabled ? "rgba(26,46,31,.08)" : "#1A2E1F",
    border: "1px solid #1A2E1F",
    borderRadius: 7,
    padding: "8px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    color: disabled ? "#6b6f6b" : "#FAF9F6",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "all 120ms ease",
  };
}

function ghostBtnStyle(disabled) {
  return {
    background: "transparent",
    border: "1px solid rgba(26, 46, 31, 0.2)",
    borderRadius: 7,
    padding: "8px 14px",
    fontSize: 12.5,
    color: disabled ? "#9b9f9b" : "#1A2E1F",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "all 120ms ease",
  };
}

const activeHeroStyle = {
  background: "rgba(26, 46, 31, 0.06)",
  border: "1px solid rgba(26, 46, 31, 0.18)",
  borderRadius: 8,
  padding: "14px 16px",
  marginBottom: 10,
};

const activeTitleStyle = {
  marginTop: 4,
  fontSize: 15,
  color: "#1A2E1F",
  fontWeight: 700,
};

const activeClinicalStyle = {
  marginTop: 3,
  fontSize: 11.5,
  color: "var(--jrn-text-muted, #6b6f6b)",
  fontStyle: "italic",
};

const activeWeekStyle = {
  marginTop: 8,
  fontSize: 13,
  color: "#1A2E1F",
  fontWeight: 500,
};

const transitionSuggestionStyle = {
  marginTop: 12,
  padding: "10px 12px",
  background: "rgba(184, 134, 38, 0.08)",
  border: "1px solid rgba(184, 134, 38, 0.3)",
  borderRadius: 7,
};

const transitionLabelStyle = {
  fontSize: 12,
  color: "#785a1a",
  lineHeight: 1.4,
};

// ─── V97.17.3 — Timeline horizontale styles ───────────────────────────────

const timelineWrapperStyle = {
  position: "relative",
  padding: "22px 16px 80px 16px",
};

const timelineTrackContainerStyle = {
  position: "relative",
  height: 18,
};

const segmentsRowStyle = {
  display: "flex",
  width: "100%",
  height: 8,
  marginTop: 5,
  borderRadius: 4,
  overflow: "hidden",
  background: "rgba(26, 46, 31, 0.03)",
};

const segmentStyle = {
  flex: 1,
  height: "100%",
  transition: "background 240ms ease",
};

const timelineMarkerStyle = {
  position: "absolute",
  top: 0,
  transform: "translateX(-50%)",
  width: 18,
  height: 18,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 700,
  zIndex: 2,
};

const cursorStyle = {
  position: "absolute",
  top: -4,
  transform: "translateX(-50%)",
  zIndex: 3,
  pointerEvents: "none",
};

const cursorDotStyle = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  background: "#1A2E1F",
  border: "3px solid #FAF9F6",
  boxShadow: "0 0 0 1px rgba(26,46,31,.5), 0 2px 6px rgba(26,46,31,.3)",
};

const labelsRowStyle = {
  position: "relative",
  height: 60,
  marginTop: 18,
};

const phaseLabelStyle = {
  position: "absolute",
  transform: "translateX(-50%)",
  textAlign: "center",
  fontSize: 11,
  lineHeight: 1.35,
  minWidth: 80,
  maxWidth: 140,
};

const phaseLabelTopStyle = {
  fontSize: 9.5,
  textTransform: "uppercase",
  letterSpacing: ".05em",
  opacity: 0.7,
};

const phaseLabelBottomStyle = {
  fontSize: 12,
  marginTop: 2,
};

const phaseLabelMetaStyle = {
  fontSize: 10,
  marginTop: 3,
  fontWeight: 400,
  opacity: 0.75,
  fontStyle: "italic",
};

// ─── V97.17.3 — Options avancees (repliable) ──────────────────────────────

const advancedToggleRowStyle = {
  marginTop: 16,
  paddingTop: 10,
  borderTop: "1px solid rgba(26, 46, 31, 0.08)",
};

const advancedToggleBtnStyle = {
  background: "transparent",
  border: "none",
  padding: "4px 0",
  fontSize: 11,
  color: "var(--jrn-text-muted, #6b6f6b)",
  cursor: "pointer",
  letterSpacing: ".03em",
  textTransform: "uppercase",
  fontWeight: 600,
};

const advancedPanelStyle = {
  marginTop: 8,
  padding: "12px 14px",
  background: "rgba(26, 46, 31, 0.03)",
  border: "1px dashed rgba(26, 46, 31, 0.15)",
  borderRadius: 7,
};

const advancedWarningStyle = {
  fontSize: 11.5,
  color: "#785a1a",
  background: "rgba(184, 134, 38, 0.08)",
  border: "1px solid rgba(184, 134, 38, 0.25)",
  borderRadius: 6,
  padding: "8px 10px",
  marginBottom: 12,
  lineHeight: 1.4,
};

const advancedActionRowStyle = {
  marginBottom: 10,
};

const confirmRowStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "10px 12px",
  background: "rgba(184, 134, 38, 0.06)",
  border: "1px solid rgba(184, 134, 38, 0.3)",
  borderRadius: 6,
};

const confirmTextStyle = {
  fontSize: 12,
  color: "#1A2E1F",
  fontWeight: 500,
  lineHeight: 1.4,
};
