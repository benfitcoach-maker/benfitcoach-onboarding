// ─── RepublicationNoticeBlock ───────────────────────────────────────────
// V97.46 — Lot 3 A−. Bloc LECTURE SEULE inséré juste au-dessus du
// PublishFooter dans ClientAppPreviewModal. Information de DÉCISION au
// moment de publier : « ce programme est-il déjà publié ? ».
//
// Source : describeRepublication(statusEntry) — uniquement les métadonnées
// déjà fournies par clients-status. Aucun diff, aucun contenu, aucun numéro
// de version. Si rien de fiable → ne rend rien.

import { describeRepublication } from "../services/republicationNotice";

export default function RepublicationNoticeBlock({ statusEntry }) {
  const notice = describeRepublication(statusEntry);
  if (!notice) return null;

  const dateLabel = formatDate(notice.dateISO);

  const text =
    notice.variant === "scheduled"
      ? `Programme programmé pour le ${dateLabel}. Une nouvelle publication mettra à jour la version prévue.`
      : `Programme déjà publié le ${dateLabel}. Une nouvelle publication créera une nouvelle version et archivera l'ancienne.`;

  return (
    <div style={wrapStyle}>
      <span style={iconStyle}>↻</span>
      <span style={textStyle}>{text}</span>
    </div>
  );
}

// Formatage date court FR, robuste (renvoie la chaîne brute si illisible).
function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" });
}

// ─── Styles (palette sombre de la modale) ────────────────────────────────

const wrapStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  background: "rgba(212,201,168,.05)",
  border: "1px solid rgba(212,201,168,.18)",
  borderRadius: 10,
  padding: "10px 16px",
  margin: "0 22px 10px",
};

const iconStyle = {
  color: "#d4c9a8",
  fontSize: ".9rem",
  lineHeight: 1.45,
};

const textStyle = {
  color: "#c8c2b0",
  fontSize: ".8rem",
  lineHeight: 1.45,
};
