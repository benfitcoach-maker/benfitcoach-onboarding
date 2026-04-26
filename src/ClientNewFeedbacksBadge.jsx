// ─── ClientNewFeedbacksBadge ───────────────────────────────────────────
// Badge "↻ X nouveaux" affiché à côté du statut quand au moins 1 feedback
// a été envoyé par la cliente APRÈS la dernière visite d'Anissa.
//
// Repose sur :
//   - clients.last_reviewed_at (set par /api/admin/client-mark-reviewed)
//   - count des feedbacks where created_at > last_reviewed_at
//
// Caché si :
//   - new_feedbacks_count === 0 (rien de neuf — pas de bruit)
//   - status === "absent" (pas pertinent)
//
// Couleur : vert tonal (signal positif "ya du nouveau à voir") — pas
// d'urgence rouge, on évite la pression.

import { useEffect, useState } from "react";
import { fetchClientsStatus } from "./services/fetchClientsStatus";

export default function ClientNewFeedbacksBadge({ email }) {
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!email) return;
    fetchClientsStatus([email]).then((map) => {
      if (cancelled) return;
      setEntry(map[email.toLowerCase()] || null);
    });
    return () => { cancelled = true; };
  }, [email]);

  if (!entry) return null;
  if (entry.status === "absent") return null;

  const count = entry.new_feedbacks_count ?? 0;
  if (count === 0) return null;

  return (
    <span
      title={`${count} nouveau${count > 1 ? "x" : ""} ressenti${count > 1 ? "s" : ""} depuis ta dernière visite`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: ".68rem",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 99,
        background: "rgba(106,191,138,.18)",
        border: "1px solid rgba(106,191,138,.4)",
        color: "#82c39e",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span aria-hidden style={{ fontSize: ".78rem", lineHeight: 1 }}>↻</span>
      {count} nouveau{count > 1 ? "x" : ""}
    </span>
  );
}
