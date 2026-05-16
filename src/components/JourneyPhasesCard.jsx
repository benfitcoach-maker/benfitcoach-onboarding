// ─── JourneyPhasesCard ──────────────────────────────────────────────────
// V97.17.1 — Cockpit Parcours therapeutique (5 phases microbiote).
//
// Pensé pour vivre dans SuiviCockpitTimeline sur la page Suivi etape 8
// (palette claire ivoire / vert sombre, cf charte journey.css).
//
// Composant autonome : consomme consultation.protocol_phases et appelle
// onSavePhases(newProtocolPhases) en remontee. C'est le parent qui gere
// la persistance (store + cloudSync). Aucun side effect ici.
//
// 3 etats UI :
//   1. Pas configure → banner suggestion template + bouton "Initialiser"
//   2. Configure, aucune phase active → bouton "Demarrer le parcours"
//   3. Configure, phase active → timeline visuelle + bouton transition
//
// Cf spec : memory `spec_v2_parcours_home_permanente_2026_05_16.md`.
// Cf service : services/protocolPhases.js (logique pure).

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
    setSaving(true);
    try {
      const next = instanceFromTemplate(templateId);
      await onSavePhases(next);
      setShowTemplatePicker(false);
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
    } finally {
      setSaving(false);
    }
  }

  // ─── État 1 : pas configuré ───────────────────────────────────────────

  if (!protocolPhases) {
    return (
      <div>
        <p style={mutedStyle}>
          Ce parcours apparaîtra dans l&apos;app cliente sous forme de timeline 5 phases.
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
            {Object.values(ALL_TEMPLATES).map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                disabled={saving}
                onClick={() => handleInitFromTemplate(tpl.id)}
                style={pickerItemStyle}
              >
                <div style={pickerLabelStyle}>{tpl.label}</div>
                <div style={pickerDescStyle}>{tpl.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── État 2 & 3 : configuré ───────────────────────────────────────────

  const totalPhases = protocolPhases.phases.length;
  const completedCount = protocolPhases.phases.filter((p) => p.status === "completed").length;
  const activeIdx = protocolPhases.phases.findIndex((p) => p.status === "active");

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

      {/* Timeline des phases */}
      <div style={{ marginTop: 14 }}>
        {protocolPhases.phases.map((phase) => {
          const isCompleted = phase.status === "completed";
          const isActive = phase.status === "active";
          const isUpcoming = phase.status === "upcoming";

          return (
            <div key={phase.id} style={phaseRowStyle(isCompleted, isActive, isUpcoming)}>
              <div style={phaseMarkerStyle(isCompleted, isActive)}>
                {isCompleted ? "✓" : isActive ? "●" : "○"}
              </div>
              <div style={phaseBodyStyle}>
                <div style={phaseTitleStyle(isUpcoming, isActive)}>
                  Phase {phase.order} · {phase.client_name}
                </div>
                <div style={phaseMetaStyle}>
                  {isCompleted && phase.completed_at && `Terminée le ${formatDate(phase.completed_at)}`}
                  {isActive && phase.started_at && `Démarrée le ${formatDate(phase.started_at)}`}
                  {isUpcoming && (
                    phase.duration_weeks_max > 0
                      ? `À venir · ~${phase.duration_weeks_max} sem`
                      : `À venir · durée ouverte`
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions globales */}
      <div style={{ ...btnRowStyle, marginTop: 14 }}>
        {!activePhase && completedCount === 0 && (
          <button
            type="button"
            disabled={saving}
            onClick={handleStartParcours}
            style={primaryBtnStyle(saving)}
          >
            {saving ? "Démarrage…" : "Démarrer le parcours (phase 1)"}
          </button>
        )}
        {activePhase && !nextSuggestion.shouldSuggest && activeIdx < totalPhases - 1 && (
          <button
            type="button"
            disabled={saving}
            onClick={handleTransitionNext}
            style={ghostBtnStyle(saving)}
            title="Forcer la transition même si la durée minimale n'est pas atteinte"
          >
            Forcer passage à la phase suivante
          </button>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={() => setShowTemplatePicker((v) => !v)}
          style={ghostBtnStyle(saving)}
        >
          {showTemplatePicker ? "Annuler" : "Changer le template"}
        </button>
      </div>

      {/* Picker template (changement post-init) */}
      {showTemplatePicker && (
        <div style={{ ...pickerStyle, marginTop: 10 }}>
          <div style={pickerWarningStyle}>
            ⚠️ Changer le template écrasera l&apos;état actuel des phases.
          </div>
          {Object.values(ALL_TEMPLATES).map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              disabled={saving || tpl.id === protocolPhases.template}
              onClick={() => handleInitFromTemplate(tpl.id)}
              style={{
                ...pickerItemStyle,
                opacity: tpl.id === protocolPhases.template ? 0.4 : 1,
                cursor: tpl.id === protocolPhases.template ? "not-allowed" : "pointer",
              }}
            >
              <div style={pickerLabelStyle}>
                {tpl.label}
                {tpl.id === protocolPhases.template && " (actuel)"}
              </div>
              <div style={pickerDescStyle}>{tpl.description}</div>
            </button>
          ))}
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
  fontSize: 11.5,
  color: "#a04040",
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
  marginBottom: 4,
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

function phaseRowStyle(isCompleted, isActive) {
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "9px 4px",
    borderBottom: "1px solid rgba(26, 46, 31, 0.06)",
    opacity: isCompleted ? 0.75 : isActive ? 1 : 0.6,
  };
}

function phaseMarkerStyle(isCompleted, isActive) {
  return {
    width: 22,
    height: 22,
    minWidth: 22,
    borderRadius: "50%",
    background: isCompleted
      ? "rgba(26, 46, 31, 0.85)"
      : isActive
      ? "rgba(26, 46, 31, 1)"
      : "rgba(26, 46, 31, 0.04)",
    border: `1.5px solid ${
      isCompleted
        ? "rgba(26, 46, 31, 0.85)"
        : isActive
        ? "#1A2E1F"
        : "rgba(26, 46, 31, 0.2)"
    }`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    color: isCompleted || isActive ? "#FAF9F6" : "rgba(26,46,31,.4)",
    fontWeight: 700,
    marginTop: 2,
  };
}

const phaseBodyStyle = {
  flex: 1,
  minWidth: 0,
};

function phaseTitleStyle(isUpcoming, isActive) {
  return {
    fontSize: 13,
    color: isUpcoming ? "var(--jrn-text-muted, #6b6f6b)" : "#1A2E1F",
    fontWeight: isActive ? 700 : 500,
  };
}

const phaseMetaStyle = {
  fontSize: 11,
  color: "var(--jrn-text-muted, #6b6f6b)",
  marginTop: 2,
};
