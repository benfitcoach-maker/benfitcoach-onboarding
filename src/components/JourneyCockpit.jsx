// ─── JourneyCockpit ─────────────────────────────────────────────────────
// Cockpit "Parcours cliente" — affiche les 7 étapes du journey côté
// app cliente et permet à Anissa de faire avancer manuellement le statut.
//
// B1 : timeline + avancement manuel
// B2 : encart "Activer l'app cliente" si la cliente n'existe pas encore

import { useState } from "react";
import { clientAppFetch } from "../services/clientAppFetch";

// ─── Données des 7 étapes ────────────────────────────────────────────────

const JOURNEY_STEPS = [
  { id: "welcome",            label: "Invitée",                  labelFr: "Invitée" },
  { id: "questionnaire",      label: "Questionnaire",            labelFr: "Pré-questionnaire" },
  { id: "rdv_scheduled",      label: "RDV programmé",            labelFr: "RDV anamnèse programmé" },
  { id: "rdv_done",           label: "Anamnèse faite",           labelFr: "Anamnèse réalisée" },
  { id: "analyses",           label: "Analyses en attente",      labelFr: "Analyses sanguines" },
  { id: "program_in_progress",label: "Programme en préparation", labelFr: "Programme en préparation" },
  { id: "program_active",     label: "Programme actif",          labelFr: "Programme actif" },
];

function getStepIndex(status) {
  const idx = JOURNEY_STEPS.findIndex((s) => s.id === status);
  return idx === -1 ? 0 : idx;
}

// ─── Composant principal ────────────────────────────────────────────────

export default function JourneyCockpit({ email, clientId, journey, onUpdated, clientPrenom, clientFormule }) {
  const [acting, setActing]       = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [activating, setActivating] = useState(false);
  const [showRdvPicker, setShowRdvPicker] = useState(false);
  const [rdvDate, setRdvDate]     = useState("");

  // Pas d'email = impossible d'agir
  if (!email) {
    return (
      <div style={noEmailStyle}>
        <span style={{ opacity: 0.55, fontSize: ".8rem" }}>
          Cliente sans email — impossible de gérer le parcours.
        </span>
      </div>
    );
  }

  // ── B2 : cliente non encore activée ──────────────────────────────────
  if (!journey) {
    async function handleActivate() {
      setActivating(true);
      setActionError(null);
      setActionSuccess(null);
      try {
        await clientAppFetch("/api/admin/invite-client", {
          method: "POST",
          payload: {
            email,
            first_name: clientPrenom || "",
            mode: clientFormule === "suivi" ? "followup" : "oneshot",
          },
        });
        setActionSuccess("App activée — compte créé et lien de connexion envoyé.");
        onUpdated?.();
      } catch (e) {
        setActionError(e?.message || "Erreur lors de l'activation.");
      } finally {
        setActivating(false);
      }
    }

    return (
      <div style={cockpitContainerStyle}>
        <div style={sectionTitleStyle}>Parcours cliente</div>
        <div style={activationEncartStyle}>
          <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>📱</div>
          <div style={{ fontSize: ".85rem", color: "#cfcfc4", fontWeight: 600, marginBottom: 4 }}>
            Cette cliente n&apos;est pas encore activée sur l&apos;app
          </div>
          <div style={{ fontSize: ".75rem", color: "#8a8a7a", marginBottom: 14 }}>
            Crée le compte sur l&apos;app et envoie le lien de connexion
          </div>
          {actionError && <div style={errorBannerStyle}>{actionError}</div>}
          {actionSuccess && <div style={successBannerStyle}>{actionSuccess}</div>}
          {!actionSuccess && (
            <button
              type="button"
              onClick={handleActivate}
              disabled={activating}
              style={activateBtnStyle(activating)}
            >
              {activating ? "Activation…" : "📱 Activer l'app cliente"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── B1 : timeline + avancement ───────────────────────────────────────

  const currentStatus = journey?.status || "welcome";
  const currentIndex  = getStepIndex(currentStatus);

  async function applyTransition(newStatus, extraPayload = {}) {
    setActing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await clientAppFetch("/api/admin/client-journey-status", {
        method: "POST",
        payload: { email, status: newStatus, ...extraPayload },
      });
      setActionSuccess(null);
      onUpdated?.();
    } catch (e) {
      setActionError(e?.message || "Erreur lors de la mise à jour.");
    } finally {
      setActing(false);
      setShowRdvPicker(false);
    }
  }

  async function handleGoBack() {
    if (currentIndex === 0) return;
    const prevStep = JOURNEY_STEPS[currentIndex - 1];
    await applyTransition(prevStep.id);
  }

  // Détermine l'action disponible pour l'étape courante
  function renderAction() {
    if (currentStatus === "program_in_progress") {
      return (
        <div style={infoHintStyle}>
          Cliquez sur &quot;Publier le programme&quot; en haut de l&apos;onglet pour passer à l&apos;étape suivante.
        </div>
      );
    }
    if (currentStatus === "program_active") {
      return (
        <div style={doneBannerStyle}>
          Programme actif — parcours terminé.
        </div>
      );
    }

    if (currentStatus === "rdv_done") {
      return (
        <button
          type="button"
          disabled={acting}
          onClick={() => applyTransition("analyses")}
          style={actionBtnStyle(acting)}
        >
          {acting ? "Mise à jour…" : "Analyses demandées →"}
        </button>
      );
    }

    if (currentStatus === "rdv_scheduled") {
      return (
        <button
          type="button"
          disabled={acting}
          onClick={() => applyTransition("rdv_done", { rdv_done_at: new Date().toISOString() })}
          style={actionBtnStyle(acting)}
        >
          {acting ? "Mise à jour…" : "RDV fait →"}
        </button>
      );
    }

    if (currentStatus === "questionnaire") {
      if (showRdvPicker) {
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={fieldLabelStyle}>Date & heure du RDV</label>
            <input
              type="datetime-local"
              value={rdvDate}
              onChange={(e) => setRdvDate(e.target.value)}
              style={dateInputStyle}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                disabled={acting || !rdvDate}
                onClick={() =>
                  applyTransition("rdv_scheduled", {
                    rdv_scheduled_at: rdvDate ? new Date(rdvDate).toISOString() : undefined,
                  })
                }
                style={actionBtnStyle(acting || !rdvDate)}
              >
                {acting ? "Enregistrement…" : "Confirmer le RDV"}
              </button>
              <button
                type="button"
                onClick={() => setShowRdvPicker(false)}
                style={cancelBtnStyle}
              >
                Annuler
              </button>
            </div>
          </div>
        );
      }
      return (
        <button
          type="button"
          disabled={acting}
          onClick={() => setShowRdvPicker(true)}
          style={actionBtnStyle(acting)}
        >
          RDV programmé →
        </button>
      );
    }

    if (currentStatus === "welcome") {
      return (
        <button
          type="button"
          disabled={acting}
          onClick={() => applyTransition("questionnaire")}
          style={actionBtnStyle(acting)}
        >
          {acting ? "Mise à jour…" : "Questionnaire reçu →"}
        </button>
      );
    }

    if (currentStatus === "analyses") {
      return (
        <button
          type="button"
          disabled={acting}
          onClick={() =>
            applyTransition("program_in_progress", {
              analyses_received_at: new Date().toISOString(),
            })
          }
          style={actionBtnStyle(acting)}
        >
          {acting ? "Mise à jour…" : "Analyses reçues →"}
        </button>
      );
    }

    return null;
  }

  return (
    <div style={cockpitContainerStyle}>
      {/* En-tête : badge étape + libellé */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={sectionTitleStyle}>Parcours cliente</div>
        <div style={stepBadgeStyle}>
          Étape {currentIndex + 1}/7 — {JOURNEY_STEPS[currentIndex]?.labelFr}
        </div>
      </div>

      {/* Timeline verticale des 7 étapes */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 12 }}>
        {JOURNEY_STEPS.map((step, idx) => {
          const isDone    = idx < currentIndex;
          const isActive  = idx === currentIndex;
          const isPending = idx > currentIndex;
          return (
            <div key={step.id} style={stepRowStyle(isDone, isActive, isPending)}>
              {/* Connecteur vertical */}
              <div style={stepConnectorStyle(isDone, isActive)}>
                <div style={stepDotStyle(isDone, isActive)} />
                {idx < JOURNEY_STEPS.length - 1 && (
                  <div style={stepLineStyle(isDone)} />
                )}
              </div>
              {/* Libellé + pulse indicator */}
              <div style={{ flex: 1, paddingBottom: idx < JOURNEY_STEPS.length - 1 ? 14 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={stepLabelStyle(isDone, isActive, isPending)}>
                    {step.labelFr}
                  </span>
                  {isActive && !isPending && (
                    <span style={activePulseStyle}>●</span>
                  )}
                  {isDone && (
                    <span style={{ fontSize: ".65rem", color: "#82c39e" }}>✓</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Zone d'action */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {actionError && <div style={errorBannerStyle}>{actionError}</div>}
        {renderAction()}

        {/* Bouton retour arrière — si pas au début et pas program_active */}
        {currentIndex > 0 && currentStatus !== "program_active" && (
          <button
            type="button"
            disabled={acting}
            onClick={handleGoBack}
            style={backBtnStyle}
          >
            ← Revenir à l&apos;étape précédente
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const cockpitContainerStyle = {
  padding: 12,
  background: "rgba(130,195,158,0.04)",
  border: "1px solid rgba(130,195,158,0.15)",
  borderRadius: 10,
  marginBottom: 12,
};

const sectionTitleStyle = {
  fontSize: ".75rem",
  color: "#82c39e",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const stepBadgeStyle = {
  fontSize: ".72rem",
  color: "#cfcfc4",
  background: "rgba(130,195,158,0.1)",
  border: "1px solid rgba(130,195,158,0.25)",
  borderRadius: 999,
  padding: "2px 10px",
};

function stepRowStyle() {
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  };
}

function stepConnectorStyle() {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: 18,
    flexShrink: 0,
  };
}

function stepDotStyle(isDone, isActive) {
  return {
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: isDone
      ? "#82c39e"
      : isActive
      ? "rgba(130,195,158,0.35)"
      : "rgba(255,255,255,0.06)",
    border: isDone
      ? "2px solid #82c39e"
      : isActive
      ? "2px solid rgba(130,195,158,0.7)"
      : "2px solid rgba(255,255,255,0.12)",
    flexShrink: 0,
    marginTop: 2,
    transition: "all 200ms ease",
  };
}

function stepLineStyle(isDone) {
  return {
    width: 2,
    flex: 1,
    minHeight: 12,
    background: isDone ? "rgba(130,195,158,0.45)" : "rgba(255,255,255,0.06)",
    borderRadius: 1,
    marginTop: 2,
  };
}

function stepLabelStyle(isDone, isActive, isPending) {
  return {
    fontSize: ".8rem",
    fontWeight: isActive ? 600 : 400,
    color: isDone
      ? "#6abf8a"
      : isActive
      ? "#cfcfc4"
      : "#8a8a7a",
    opacity: isPending ? 0.6 : 1,
  };
}

const activePulseStyle = {
  fontSize: ".55rem",
  color: "#82c39e",
  animation: "jc-pulse 1.6s ease-in-out infinite",
};

function actionBtnStyle(disabled) {
  return {
    background: disabled ? "rgba(255,255,255,.04)" : "rgba(130,195,158,0.15)",
    border: `1px solid ${disabled ? "rgba(255,255,255,.08)" : "rgba(130,195,158,0.35)"}`,
    borderRadius: 7,
    padding: "7px 14px",
    fontSize: ".8rem",
    fontWeight: 600,
    color: disabled ? "#8a8a7a" : "#82c39e",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "all 120ms ease",
    textAlign: "left",
  };
}

const backBtnStyle = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 7,
  padding: "5px 12px",
  fontSize: ".75rem",
  color: "#8a8a7a",
  cursor: "pointer",
  transition: "all 120ms ease",
  textAlign: "left",
};

const activationEncartStyle = {
  textAlign: "center",
  padding: "16px 12px",
};

function activateBtnStyle(disabled) {
  return {
    background: disabled ? "rgba(255,255,255,.04)" : "#2E4E38",
    border: `1px solid ${disabled ? "rgba(255,255,255,.08)" : "#2E4E38"}`,
    borderRadius: 8,
    padding: "9px 18px",
    fontSize: ".82rem",
    fontWeight: 600,
    color: disabled ? "#8a8a7a" : "#FAF9F6",
    cursor: disabled ? "wait" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "all 120ms ease",
  };
}

const noEmailStyle = {
  padding: "10px 12px",
  background: "rgba(255,255,255,.02)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 8,
  textAlign: "center",
  marginBottom: 12,
};

const errorBannerStyle = {
  padding: "7px 10px",
  background: "rgba(220,80,80,0.1)",
  border: "1px solid rgba(220,80,80,0.2)",
  borderRadius: 6,
  fontSize: ".78rem",
  color: "#e87070",
};

const successBannerStyle = {
  padding: "7px 10px",
  background: "rgba(130,195,158,0.1)",
  border: "1px solid rgba(130,195,158,0.25)",
  borderRadius: 6,
  fontSize: ".78rem",
  color: "#82c39e",
};

const infoHintStyle = {
  padding: "8px 12px",
  background: "rgba(232,160,64,0.08)",
  border: "1px solid rgba(232,160,64,0.2)",
  borderRadius: 7,
  fontSize: ".78rem",
  color: "#e8a040",
  lineHeight: 1.4,
};

const doneBannerStyle = {
  padding: "8px 12px",
  background: "rgba(130,195,158,0.1)",
  border: "1px solid rgba(130,195,158,0.25)",
  borderRadius: 7,
  fontSize: ".8rem",
  color: "#82c39e",
  fontWeight: 500,
};

const fieldLabelStyle = {
  fontSize: ".7rem",
  color: "#8a8a7a",
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const dateInputStyle = {
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 7,
  padding: "6px 10px",
  color: "#d4c9a8",
  fontSize: ".82rem",
  fontFamily: "inherit",
  colorScheme: "dark",
};

const cancelBtnStyle = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 7,
  padding: "7px 12px",
  fontSize: ".78rem",
  color: "#8a8a7a",
  cursor: "pointer",
};
