// ─── ClientAppPanel ─────────────────────────────────────────────────────
// V94.41 : Hub centralise pour tout ce qui touche a l'app cliente d'une
// cliente donnee. Affiche dans un nouvel onglet 'app' de NutritionConsultation.
//
// Sous-onglets :
//   - Vue d'ensemble : statut app, mode, derniere connexion, feedbacks 7j
//   - Messages       : (V94.42) envoi messages + attachements PDF
//   - Ressources     : (V94.43) bibliotheque PDFs reutilisables
//   - Signaux        : (V94.44) upgrade interests, ouvertures attachements
//
// Source des donnees app cliente : appel admin a l'API client app
// (fetchClientsStatus, services existants). Aucun acces direct SaaS → DB cliente.
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { fetchClientsStatus } from "./services/fetchClientsStatus";
import { getNutritionPlanMode, planModeLabel } from "./services/nutritionPlanMode";

const SUB_TABS = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "messages", label: "Messages" },
  { id: "resources", label: "Ressources" },
  { id: "signals", label: "Signaux" },
];

export default function ClientAppPanel({ client, consultation }) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!client) {
    return (
      <div style={emptyStyle}>
        Selectionnez une cliente pour voir sa vue app.
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* Sub-tabs nav */}
      <div style={subTabsStyle}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            style={{
              ...subTabBtnStyle,
              ...(activeTab === t.id ? subTabBtnActiveStyle : {}),
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {activeTab === "overview" && (
          <OverviewTab client={client} consultation={consultation} />
        )}
        {activeTab === "messages" && <ComingSoon section="Messages" version="V94.42" />}
        {activeTab === "resources" && <ComingSoon section="Ressources" version="V94.43" />}
        {activeTab === "signals" && <ComingSoon section="Signaux" version="V94.44" />}
      </div>
    </div>
  );
}

// ─── Vue d'ensemble ─────────────────────────────────────────────────────

function OverviewTab({ client, consultation }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!client?.email) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchClientsStatus([client.email])
      .then((map) => {
        if (cancelled) return;
        setStatus(map[client.email.toLowerCase()] || null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client?.email]);

  const mode = getNutritionPlanMode(client);
  const modeLabel = planModeLabel(mode);
  const found = !!status?.found;
  const lastLoginAt = status?.last_login_at || null;
  const lastActivityAt = status?.last_activity_at || null;
  const feedbacks7d = status?.feedbacks_7d_count || 0;
  const newFeedbacks = status?.new_feedbacks_count || 0;

  if (loading) {
    return <div style={loadingStyle}>Chargement…</div>;
  }

  if (!found) {
    return (
      <div style={emptyStateStyle}>
        <div style={{ fontSize: "1rem", marginBottom: 6, color: "#cfcfc4" }}>
          Cette cliente n&apos;a pas encore d&apos;acces a l&apos;app.
        </div>
        <div style={{ fontSize: ".8rem", color: "#8a8a7a" }}>
          Publiez son plan dans l&apos;app cliente pour activer son compte.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Statut connexion */}
      <Row label="Statut">
        <Pill color={lastLoginAt ? "#82c39e" : "#8a8a7a"}>
          {lastLoginAt ? "Active" : "Invitee"}
        </Pill>
      </Row>

      {/* Mode (oneshot vs followup) */}
      <Row label="Type d'accompagnement">
        <span style={{ color: "#cfcfc4", fontWeight: 500 }}>{modeLabel}</span>
        <span style={{ color: "#8a8a7a", fontSize: ".7rem", marginLeft: 8 }}>
          ({mode === "followup" ? "suivi 6 mois" : "consultation unique"})
        </span>
      </Row>

      {/* Plan publie ? */}
      <Row label="Plan publie">
        <Pill color="#82c39e">Oui</Pill>
      </Row>

      {/* Dernieres connexions */}
      <Row label="Derniere connexion">
        <span style={timeStyle}>{formatRelative(lastLoginAt)}</span>
      </Row>

      <Row label="Derniere activite">
        <span style={timeStyle}>{formatRelative(lastActivityAt)}</span>
      </Row>

      {/* Engagement feedbacks */}
      <Row label="Ressentis 7 derniers jours">
        <span style={{ color: "#cfcfc4", fontWeight: 500 }}>{feedbacks7d}</span>
        {newFeedbacks > 0 && (
          <Pill color="#e8a040" small>
            {newFeedbacks} non lu{newFeedbacks > 1 ? "s" : ""}
          </Pill>
        )}
      </Row>

      {/* Consultation source */}
      {consultation?.id && (
        <Row label="Consultation source">
          <span style={{ color: "#8a8a7a", fontSize: ".75rem" }}>
            {String(consultation.id).slice(0, 8)}…
          </span>
        </Row>
      )}
    </div>
  );
}

// ─── Coming soon stub ────────────────────────────────────────────────────

function ComingSoon({ section, version }) {
  return (
    <div style={comingSoonStyle}>
      <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>🚧</div>
      <div style={{ fontSize: "0.9rem", color: "#cfcfc4", marginBottom: 4 }}>
        {section} — a venir
      </div>
      <div style={{ fontSize: "0.72rem", color: "#8a8a7a" }}>
        Cette section sera disponible en {version}.
      </div>
    </div>
  );
}

// ─── Atomes UI ──────────────────────────────────────────────────────────

function Row({ label, children }) {
  return (
    <div style={rowStyle}>
      <div style={rowLabelStyle}>{label}</div>
      <div style={rowValueStyle}>{children}</div>
    </div>
  );
}

function Pill({ color, small, children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: small ? "1px 7px" : "2px 9px",
        fontSize: small ? ".68rem" : ".72rem",
        fontWeight: 600,
        color: color,
        background: hexA(color, 0.12),
        border: `1px solid ${hexA(color, 0.25)}`,
        borderRadius: 999,
        textTransform: "uppercase",
        letterSpacing: ".05em",
      }}
    >
      {children}
    </span>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatRelative(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 1) return "a l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `il y a ${days} j`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch {
    return "—";
  }
}

/** Convertit #RRGGBB + alpha en rgba string. Pour les Pill backgrounds. */
function hexA(hex, alpha) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Styles ─────────────────────────────────────────────────────────────

const panelStyle = {
  marginBottom: 16,
  padding: 14,
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 10,
};

const subTabsStyle = {
  display: "flex",
  gap: 4,
  marginBottom: 14,
  paddingBottom: 10,
  borderBottom: "1px solid rgba(255,255,255,.06)",
  flexWrap: "wrap",
};

const subTabBtnStyle = {
  padding: "5px 11px",
  fontSize: ".75rem",
  fontWeight: 500,
  color: "#8a8a7a",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 6,
  cursor: "pointer",
  transition: "all 120ms ease",
};

const subTabBtnActiveStyle = {
  color: "#cfcfc4",
  background: "rgba(130, 195, 158, 0.08)",
  border: "1px solid rgba(130, 195, 158, 0.2)",
};

const contentStyle = {
  minHeight: 220,
};

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px solid rgba(255,255,255,.04)",
  flexWrap: "wrap",
};

const rowLabelStyle = {
  flex: "0 0 200px",
  fontSize: ".72rem",
  color: "#8a8a7a",
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const rowValueStyle = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const timeStyle = {
  fontSize: ".82rem",
  color: "#cfcfc4",
};

const emptyStyle = {
  padding: 16,
  fontSize: ".8rem",
  color: "#8a8a7a",
  textAlign: "center",
  background: "rgba(255,255,255,.025)",
  borderRadius: 10,
};

const emptyStateStyle = {
  padding: 24,
  textAlign: "center",
};

const loadingStyle = {
  padding: 24,
  textAlign: "center",
  fontSize: ".8rem",
  color: "#8a8a7a",
};

const comingSoonStyle = {
  padding: "32px 16px",
  textAlign: "center",
  background: "rgba(255,255,255,.015)",
  borderRadius: 8,
};
