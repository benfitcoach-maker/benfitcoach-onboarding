// ─── EditorialReadinessBlock ────────────────────────────────────────────
// V97.44 — Lot 1. Bloc LECTURE SEULE inséré sous le header de
// ClientAppPreviewModal. Répond à « le programme est-il prêt à envoyer ? ».
//
// Purement informatif : ne bloque pas la publication (le PublishFooter
// fail-closed reste le seul garde-fou), aucune écriture, aucun fetch.
// Complétude ÉDITORIALE uniquement — jamais clinique.

import { computeEditorialReadiness, READINESS_META } from "../services/editorialReadiness";

export default function EditorialReadinessBlock({ plan, cfgOk = true, hasEmail = true }) {
  const readiness = computeEditorialReadiness(plan, { cfgOk, hasEmail });
  const meta = READINESS_META[readiness.level];

  return (
    <div style={wrapStyle(readiness.level)}>
      <div style={headerRowStyle}>
        <span style={titleStyle}>État éditorial du programme</span>
        <span style={badgeStyle(readiness.level)}>
          {meta.icon} {meta.label}
        </span>
      </div>

      <ul style={listStyle}>
        {readiness.technical.map((t, i) => (
          <li key={`tech-${i}`} style={lineStyle("blocked")}>
            🔴 {t}
          </li>
        ))}
        {readiness.sections.map((s) => (
          <li key={s.key} style={lineStyle(s.filled ? "ok" : "review")}>
            {s.filled ? "✓" : "⚠"} {s.filled ? s.okLabel : s.emptyLabel}
          </li>
        ))}
      </ul>

      <p style={disclaimerStyle}>
        Complétude éditoriale uniquement — ne remplace pas votre validation clinique.
      </p>
    </div>
  );
}

// ─── Styles (palette sombre de la modale, cf capsCard) ────────────────────

const ACCENT = {
  blocked: { border: "rgba(220,80,80,.35)", bg: "rgba(220,80,80,.06)", text: "#f5c6c6" },
  review: { border: "rgba(220,180,80,.30)", bg: "rgba(220,180,80,.06)", text: "#e5c878" },
  ready: { border: "rgba(80,160,100,.30)", bg: "rgba(80,160,100,.06)", text: "#b6d8b8" },
};

function wrapStyle(level) {
  const a = ACCENT[level] || ACCENT.review;
  return {
    background: a.bg,
    border: `1px solid ${a.border}`,
    borderRadius: 10,
    padding: "12px 16px",
    margin: "14px 22px 0",
  };
}

const headerRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const titleStyle = {
  color: "#d4c9a8",
  fontSize: ".92rem",
  fontWeight: 700,
};

function badgeStyle(level) {
  const a = ACCENT[level] || ACCENT.review;
  return {
    padding: "3px 11px",
    background: a.bg,
    border: `1px solid ${a.border}`,
    borderRadius: 999,
    color: a.text,
    fontSize: ".74rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

const listStyle = {
  listStyle: "none",
  margin: "10px 0 0",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

function lineStyle(kind) {
  const color =
    kind === "ok" ? "#b6d8b8" : kind === "blocked" ? "#f5c6c6" : "#e5c878";
  return {
    fontSize: ".82rem",
    color,
    lineHeight: 1.4,
  };
}

const disclaimerStyle = {
  margin: "10px 0 0",
  paddingTop: 8,
  borderTop: "1px solid rgba(255,255,255,.06)",
  fontSize: ".72rem",
  fontStyle: "italic",
  color: "#8a8a7a",
  lineHeight: 1.4,
};
