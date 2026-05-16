// ─── JourneyPhasesCard ──────────────────────────────────────────────────
// V97.17 Phase B — Cockpit Parcours therapeutique (5 phases microbiote).
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

  // Suggestion template (lazy, recalculee si client change)
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
      <div style={cardStyle}>
        <div style={titleRowStyle}>
          <div style={titleStyle}>Parcours thérapeutique</div>
          <div style={pillStyle}>Non configuré</div>
        </div>

        <p style={mutedStyle}>
          Ce parcours apparaîtra dans l'app cliente sous forme de timeline 5 phases.
          Camille verra où elle en est, ce qui se passe, et ce qui vient ensuite.
        </p>

        {/* Banner suggestion */}
        <div style={suggestionBannerStyle}>
          <div style={{ fontSize: ".7rem", color: "#82c39e", fontWeight: 600, letterSpacing: ".05em" }}>
            ✨ SUGGESTION
          </div>
          <div style={{ marginTop: 4, fontSize: ".88rem", color: "#FAF9F6" }}>
            {ALL_TEMPLATES[suggestion.templateId]?.label || suggestion.templateId}
          </div>
          <div style={{ marginTop: 4, fontSize: ".75rem", color: "#8a8a7a", fontStyle: "italic" }}>
            {suggestion.reason}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                <div style={{ fontWeight: 600, color: "#FAF9F6" }}>{tpl.label}</div>
                <div style={{ marginTop: 2, fontSize: ".72rem", color: "#8a8a7a" }}>
                  {tpl.description}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── État 2 & 3 : configuré ───────────────────────────────────────────

  const template = ALL_TEMPLATES[protocolPhases.template];
  const totalPhases = protocolPhases.phases.length;
  const completedCount = protocolPhases.phases.filter((p) => p.status === "completed").length;
  const activeIdx = protocolPhases.phases.findIndex((p) => p.status === "active");

  return (
    <div style={cardStyle}>
      <div style={titleRowStyle}>
        <div style={titleStyle}>Parcours thérapeutique</div>
        <div style={pillStyle}>
          {template?.label || protocolPhases.template} · {totalPhases} phases
        </div>
      </div>

      {/* Hero phase active (si une est active) */}
      {activePhase && (
        <div style={activeHeroStyle}>
          <div style={{ fontSize: ".7rem", color: "#82c39e", fontWeight: 600, letterSpacing: ".05em" }}>
            PHASE ACTIVE
          </div>
          <div style={{ marginTop: 4, fontSize: "1rem", color: "#FAF9F6", fontWeight: 600 }}>
            Phase {activePhase.order} · {activePhase.client_name}
          </div>
          <div style={{ marginTop: 2, fontSize: ".72rem", color: "#8a8a7a", fontStyle: "italic" }}>
            Clinique : {activePhase.clinical_name}
          </div>
          {weekInfo && (
            <div style={{ marginTop: 8, fontSize: ".78rem", color: "#FAF9F6" }}>
              Semaine {weekInfo.weekNumber}
              {weekInfo.maxWeeks > 0 ? ` sur ~${weekInfo.maxWeeks}` : " (phase ouverte)"}
            </div>
          )}
          {nextSuggestion.shouldSuggest && (
            <div style={transitionSuggestionStyle}>
              <div style={{ fontSize: ".72rem", color: "#e0c87a" }}>
                💡 {nextSuggestion.reason}
              </div>
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
      <div style={{ marginTop: 12 }}>
        {protocolPhases.phases.map((phase, idx) => {
          const isCompleted = phase.status === "completed";
          const isActive = phase.status === "active";
          const isUpcoming = phase.status === "upcoming";

          return (
            <div key={phase.id} style={phaseRowStyle(isCompleted, isActive, isUpcoming)}>
              <div style={phaseMarkerStyle(isCompleted, isActive)}>
                {isCompleted ? "✓" : isActive ? "●" : "○"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: ".82rem", color: isUpcoming ? "#8a8a7a" : "#FAF9F6", fontWeight: isActive ? 600 : 400 }}>
                  Phase {phase.order} · {phase.client_name}
                </div>
                <div style={{ fontSize: ".68rem", color: "#666", marginTop: 1 }}>
                  {isCompleted && phase.completed_at && `Terminée le ${formatDate(phase.completed_at)}`}
                  {isActive && phase.started_at && `Démarrée le ${formatDate(phase.started_at)}`}
                  {isUpcoming && (
                    phase.duration_weeks_max > 0
                      ? `À venir · ~${phase.duration_weeks_max} sem`
                      : `À venir · durée ouverte`
                  )}
                </div>
              </div>
              {idx < protocolPhases.phases.length - 1 && (
                <div style={connectorStyle(isCompleted)} />
              )}
            </div>
          );
        })}
      </div>

      {/* Actions globales */}
      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
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
          <div style={{ fontSize: ".72rem", color: "#e87070", marginBottom: 8 }}>
            ⚠️ Changer le template écrasera l'état actuel des phases.
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
              <div style={{ fontWeight: 600, color: "#FAF9F6" }}>
                {tpl.label}
                {tpl.id === protocolPhases.template && " (actuel)"}
              </div>
              <div style={{ marginTop: 2, fontSize: ".72rem", color: "#8a8a7a" }}>
                {tpl.description}
              </div>
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

// ─── Styles ───────────────────────────────────────────────────────────────

const cardStyle = {
  background: "rgba(255,255,255,.02)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 10,
  padding: "14px 16px",
  marginBottom: 12,
};

const titleRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
  gap: 10,
  flexWrap: "wrap",
};

const titleStyle = {
  fontSize: ".9rem",
  fontWeight: 600,
  color: "#FAF9F6",
  letterSpacing: ".01em",
};

const pillStyle = {
  fontSize: ".68rem",
  color: "#8a8a7a",
  background: "rgba(255,255,255,.04)",
  padding: "3px 9px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,.06)",
};

const mutedStyle = {
  fontSize: ".78rem",
  color: "#8a8a7a",
  margin: "0 0 12px 0",
  lineHeight: 1.5,
};

const suggestionBannerStyle = {
  background: "rgba(130,195,158,.08)",
  border: "1px solid rgba(130,195,158,.25)",
  borderRadius: 8,
  padding: "10px 12px",
  marginBottom: 10,
};

const pickerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 8,
};

const pickerItemStyle = {
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 7,
  padding: "10px 12px",
  textAlign: "left",
  cursor: "pointer",
  transition: "all 120ms ease",
};

function primaryBtnStyle(disabled) {
  return {
    background: disabled ? "rgba(255,255,255,.04)" : "rgba(130,195,158,0.15)",
    border: `1px solid ${disabled ? "rgba(255,255,255,.08)" : "rgba(130,195,158,0.35)"}`,
    borderRadius: 7,
    padding: "7px 14px",
    fontSize: ".78rem",
    fontWeight: 600,
    color: disabled ? "#8a8a7a" : "#82c39e",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "all 120ms ease",
  };
}

function ghostBtnStyle(disabled) {
  return {
    background: "transparent",
    border: `1px solid ${disabled ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)"}`,
    borderRadius: 7,
    padding: "7px 14px",
    fontSize: ".78rem",
    color: disabled ? "#666" : "#8a8a7a",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "all 120ms ease",
  };
}

const activeHeroStyle = {
  background: "rgba(130,195,158,.06)",
  border: "1px solid rgba(130,195,158,.18)",
  borderRadius: 8,
  padding: "12px 14px",
  marginBottom: 6,
};

const transitionSuggestionStyle = {
  marginTop: 10,
  padding: "10px 12px",
  background: "rgba(224,200,122,.08)",
  border: "1px solid rgba(224,200,122,.25)",
  borderRadius: 7,
};

function phaseRowStyle(isCompleted, isActive) {
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "8px 4px",
    borderBottom: "1px solid rgba(255,255,255,.04)",
    opacity: isCompleted ? 0.7 : isActive ? 1 : 0.55,
  };
}

function phaseMarkerStyle(isCompleted, isActive) {
  return {
    width: 22,
    height: 22,
    minWidth: 22,
    borderRadius: "50%",
    background: isCompleted
      ? "rgba(130,195,158,.2)"
      : isActive
      ? "rgba(130,195,158,.35)"
      : "rgba(255,255,255,.04)",
    border: `1px solid ${
      isCompleted
        ? "rgba(130,195,158,.4)"
        : isActive
        ? "#82c39e"
        : "rgba(255,255,255,.1)"
    }`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: ".7rem",
    color: isCompleted || isActive ? "#82c39e" : "#666",
    fontWeight: 600,
    marginTop: 2,
  };
}

function connectorStyle() {
  return {}; // visual connector via borderBottom de phaseRowStyle
}
