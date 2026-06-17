// ─── PublishedJourneyBlock ──────────────────────────────────────────────
// V97.45 — Lot 2. Bloc LECTURE SEULE inséré sous EditorialReadinessBlock dans
// ClientAppPreviewModal. Répond à « qu'est-ce que la cliente va vivre ? ».
//
// Source UNIQUE : plan.journey_phases (= payload réellement envoyé à
// /api/admin/publish-plan). Jamais consultation.protocol_phases ni
// pending_protocol_phases. Aucune logique métier, aucun recalcul de
// progression, aucune écriture.

import { mapPublishedJourney } from "../services/publishedJourney";

export default function PublishedJourneyBlock({ journeyPhases }) {
  const phases = mapPublishedJourney(journeyPhases);

  return (
    <div style={wrapStyle}>
      <div style={titleStyle}>Parcours thérapeutique publié</div>
      <p style={subStyle}>
        Aperçu du parcours qui sera envoyé dans l'app cliente après publication.
      </p>

      {phases.length === 0 ? (
        <p style={emptyStyle}>
          Aucun parcours thérapeutique configuré pour cette publication.
        </p>
      ) : (
        <ul style={listStyle}>
          {phases.map((p) => (
            <li key={p.key} style={lineStyle(p.status)}>
              <span style={markerStyle(p.status)}>{p.marker}</span>
              <span style={numStyle}>Phase {p.order}</span>
              <span style={nameStyle(p.status)}>{p.name}</span>
              <span style={badgeStyle(p.status)}>{p.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Styles (palette sombre de la modale, cf EditorialReadinessBlock) ─────

const wrapStyle = {
  background: "rgba(255,255,255,.02)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 10,
  padding: "12px 16px",
  margin: "12px 22px 0",
};

const titleStyle = {
  color: "#d4c9a8",
  fontSize: ".92rem",
  fontWeight: 700,
};

const subStyle = {
  margin: "4px 0 0",
  color: "#8a8a7a",
  fontSize: ".74rem",
  lineHeight: 1.4,
};

const emptyStyle = {
  margin: "10px 0 0",
  color: "#8a8a7a",
  fontSize: ".82rem",
  fontStyle: "italic",
  lineHeight: 1.4,
};

const listStyle = {
  listStyle: "none",
  margin: "10px 0 0",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const ACTIVE_TEXT = "#e6dcc0";
const MUTED_TEXT = "#9a9686";
const DONE_TEXT = "#b6d8b8";

function lineStyle(status) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    borderRadius: 8,
    background:
      status === "active" ? "rgba(212,201,168,.07)" : "transparent",
    border:
      status === "active"
        ? "1px solid rgba(212,201,168,.20)"
        : "1px solid transparent",
  };
}

function markerStyle(status) {
  const color =
    status === "completed" ? DONE_TEXT : status === "active" ? ACTIVE_TEXT : MUTED_TEXT;
  return {
    width: 16,
    textAlign: "center",
    color,
    fontSize: ".9rem",
  };
}

const numStyle = {
  color: MUTED_TEXT,
  fontSize: ".74rem",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

function nameStyle(status) {
  return {
    flex: 1,
    color: status === "active" ? ACTIVE_TEXT : "#c8c2b0",
    fontSize: ".84rem",
    fontWeight: status === "active" ? 700 : 500,
  };
}

function badgeStyle(status) {
  const color =
    status === "completed" ? DONE_TEXT : status === "active" ? ACTIVE_TEXT : MUTED_TEXT;
  return {
    fontSize: ".7rem",
    color,
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}
