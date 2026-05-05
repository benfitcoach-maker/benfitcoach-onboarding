// ─── ClientStatusBadge ─────────────────────────────────────────────────
// Badge "Invitée / Connectée / Active / Hors app" affiché à côté du nom
// de chaque cliente dans la liste du dashboard Anissa.
//
// Auto-fetch via fetchClientsStatus (cache 60s côté service → multiples
// rendus simultanés ne re-fetchent pas l'email déjà connu).
//
// Strict minimum : 1 pastille colorée + label court + tooltip native.
// Aucun graph, aucun scoring, aucune action.

import { useEffect, useState } from "react";
import { fetchClientsStatus } from "./services/fetchClientsStatus";

const META = {
  active: {
    label: "Active",
    bg: "rgba(106,191,138,.18)",
    border: "rgba(106,191,138,.4)",
    color: "#82c39e",
    tip: "Activité dans les 7 derniers jours",
  },
  connected: {
    label: "Connectée",
    bg: "rgba(120,160,220,.15)",
    border: "rgba(120,160,220,.35)",
    color: "#9bbed8",
    tip: "S'est connectée mais aucune activité récente — à relancer",
  },
  invited: {
    label: "Invitée",
    bg: "rgba(220,180,80,.12)",
    border: "rgba(220,180,80,.3)",
    color: "#e5c878",
    tip: "Plan publié mais cliente jamais connectée",
  },
  absent: {
    label: "Hors app",
    bg: "var(--bg-card)",
    border: "var(--border)",
    color: "var(--text-muted)",
    tip: "Plan non encore publié dans l'app cliente",
  },
};

export default function ClientStatusBadge({ email, stagingClientId = null }) {
  const [status, setStatus] = useState(null); // null = loading

  useEffect(() => {
    let cancelled = false;
    if (!email && !stagingClientId) {
      setStatus("absent");
      return;
    }
    fetchClientsStatus([{ email, stagingClientId }]).then((map) => {
      if (cancelled) return;
      const key = stagingClientId
        ? `id:${stagingClientId}`
        : email?.toLowerCase();
      const entry = key ? map[key] : null;
      setStatus(entry?.status || "absent");
    });
    return () => { cancelled = true; };
  }, [email, stagingClientId]);

  if (status === null) return null; // pas de placeholder visuel pour éviter le flash

  const meta = META[status] || META.absent;
  return (
    <span
      title={meta.tip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: ".68rem",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 99,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.color,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: meta.color,
          opacity: status === "absent" ? 0.4 : 1,
        }}
      />
      {meta.label}
    </span>
  );
}
